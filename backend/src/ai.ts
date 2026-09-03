import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import { type ResumeParseResult } from './data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// pdf-parse ships an old bundled pdf.js that throws at module-init time when
// loaded under tsx — tsx installs a process-wide require-transform hook (not
// just for top-level imports) that this legacy webpack bundle doesn't survive.
// Running the extraction in a genuine plain `node` child process (no tsx hook
// active there at all) sidesteps this entirely — confirmed working standalone.
function extractPdfText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // The bundled pdf.js writes font warnings ("Warning: TT: undefined
    // function: 32", emitted for many real-world PDFs with embedded TrueType
    // fonts) to STDOUT, not stderr — which would corrupt the JSON we read back.
    // So the child silences stdout while parsing, then restores it to emit only
    // the JSON result.
    const script =
      "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{" +
      'const w=process.stdout.write.bind(process.stdout);' +
      'process.stdout.write=()=>true;' +
      'const done=o=>{process.stdout.write=w;w(JSON.stringify(o))};' +
      "require('pdf-parse')(Buffer.concat(c))" +
      '.then(r=>done({text:r.text}))' +
      '.catch(e=>done({error:e.message}))})'
    const child = spawn(process.execPath, ['-e', script], {
      cwd: path.join(__dirname, '..'), // backend/ — so require('pdf-parse') resolves via its node_modules
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    let errOut = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (errOut += d))
    child.on('error', reject)
    child.stdin.on('error', reject) // e.g. EPIPE if the child dies mid-write
    child.on('close', () => {
      try {
        // Defensive: slice to the JSON object in case anything still leaks to
        // stdout ahead of/after it.
        const start = out.indexOf('{')
        const end = out.lastIndexOf('}')
        const json = start !== -1 && end > start ? out.slice(start, end + 1) : out
        const parsed = JSON.parse(json) as { text?: string; error?: string }
        if (parsed.error) return reject(new Error(parsed.error))
        resolve(parsed.text ?? '')
      } catch {
        reject(new Error(errOut || 'pdf extraction process returned no usable output'))
      }
    })
    child.stdin.write(buffer)
    child.stdin.end()
  })
}

// ANT_KEY is this app's config name; ANTHROPIC_API_KEY is the standard SDK var.
const apiKey = process.env.ANT_KEY || process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic({ apiKey }) : null

const openRouterApiKey = process.env.OPENROUTER_API_KEY
// Ask Roo: small/fast model — free chat, works well, no reason to use anything bigger.
const OPENROUTER_ASKROO_MODEL = 'nvidia/nemotron-3.5-lightning:free'
// Resume parsing: needs reliable structured JSON. Unlike Lightning and Ultra
// (neither supports `response_format`, so both needed prompt-and-pray JSON with
// defensive parsing — Lightning echoed prose, Ultra's free endpoint is routinely
// "temporarily overloaded"), Nemotron 3 Super natively supports json_schema
// enforcement, which makes the output structurally guaranteed. It's also far
// faster in testing (~1-2s vs. 30-60s+ on Ultra).
const OPENROUTER_RESUME_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free'

// Which provider actually answers AI calls.
// 'anthropic'  = paid Claude via ANT_KEY. The DEFAULT, and what production
//   runs: no rate ceiling, enforced JSON-schema output.
// 'openrouter' = free NVIDIA Nemotron (dev only) — no cost, but capped at ~50
//   requests/day on OpenRouter's free tier and frequently overloaded upstream.
//   Strictly opt-in via AI_PROVIDER=openrouter.
//
// Opt-in rather than opt-out on purpose: defaulting to OpenRouter would have
// silently downgraded any existing deployment that has ANT_KEY but no
// AI_PROVIDER set, and — with no OPENROUTER_API_KEY — would have flipped
// aiEnabled off and served demo data as if it were a real parse.
const AI_PROVIDER = process.env.AI_PROVIDER === 'openrouter' ? 'openrouter' : 'anthropic'

export const aiEnabled = AI_PROVIDER === 'anthropic' ? !!client : !!openRouterApiKey

/** Thrown when parsing fails for a reason the user can act on. */
export class ResumeParseError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// Must stay in sync with DOMAINS / EMPLOYMENT_TYPES in frontend/src/types.ts.
// "" means "could not tell from the resume" — the form keeps its own value then.
const DOMAINS = ['Cloud', 'AI/ML', 'Cybersecurity', 'DevOps', 'Data', 'Web Dev', 'Mobile', 'UI/UX', '']
const EMPLOYMENT_TYPES = [
  'Employed',
  'Freelancer',
  'Entrepreneur',
  'Looking for opportunity',
  'Student',
  'Just looking around',
  '',
]

// JSON Schema the model must fill — mirrors ResumeParseResult minus `source`.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', description: "Candidate's full name" },
    email: { type: 'string', description: 'Email address exactly as written, "" if absent' },
    phone: { type: 'string', description: 'Phone number exactly as written, "" if absent' },
    linkedin: { type: 'string', description: 'Full LinkedIn URL, "" if absent' },
    city: { type: 'string', description: 'Current city, "" if absent' },
    headline: { type: 'string', description: 'One-line professional headline, e.g. "Senior Backend Engineer · 6 years experience"' },
    bio: { type: 'string', description: 'A 2-3 sentence first-person professional bio grounded strictly in the resume' },
    batchYear: { type: 'string', description: '4-digit year the candidate finished their most relevant training/degree, "" if unclear' },
    course: { type: 'string', description: 'Name of that course/degree/certification, "" if unclear' },
    experienceYears: { type: 'string', description: 'Total years of professional experience as digits, "" if unclear' },
    domain: { type: 'string', enum: DOMAINS, description: 'Closest expertise domain, "" only if none fits' },
    employmentType: { type: 'string', enum: EMPLOYMENT_TYPES, description: 'Current employment status, "" if unclear. Use "Student" if currently enrolled in further education with no job, "Looking for opportunity" if job-hunting with no current role.' },
    college: { type: 'string', description: 'Name of the college/institution currently being attended, only if employmentType is "Student" — "" otherwise' },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string' },
          company: { type: 'string' },
          period: { type: 'string', description: 'Like "2022 — Present"' },
          summary: { type: 'string', description: 'One achievement-focused sentence' },
        },
        required: ['role', 'company', 'period', 'summary'],
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'name', 'email', 'phone', 'linkedin', 'city', 'headline', 'bio',
    'batchYear', 'course', 'experienceYears', 'domain', 'employmentType', 'college',
    'experience', 'skills',
  ],
}

const PROMPT =
  'Extract this resume into structured data for an alumni-network profile. ' +
  'Work experience is listed newest-first. ' +
  'Use only information present in the document — never invent employers, contact details, or dates. ' +
  'Use "" (or []) for anything the document does not state. ' +
  'For domain and employmentType, pick the closest allowed value based on the overall profile. ' +
  'If currently a student, also fill college with the institution name.'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

type UserContent = Anthropic.MessageParam['content']

/** Turn the uploaded file into message content Claude can read. */
async function buildContent(dataBase64: string, mediaType?: string): Promise<UserContent> {
  const clean = dataBase64.replace(/\s/g, '')

  if (mediaType === 'application/pdf') {
    return [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: clean } },
      { type: 'text', text: PROMPT },
    ]
  }

  if (mediaType === DOCX_MIME) {
    let text = ''
    try {
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(clean, 'base64') })
      text = value.trim()
    } catch {
      throw new ResumeParseError(422, 'Could not read that Word document. Please export it as a PDF and try again.')
    }
    if (!text) {
      throw new ResumeParseError(422, 'That Word document appears to be empty. Please check the file or upload a PDF.')
    }
    return [{ type: 'text', text: `Resume text extracted from the uploaded document:\n\n${text}\n\n---\n\n${PROMPT}` }]
  }

  if (mediaType === 'application/msword') {
    throw new ResumeParseError(415, 'Legacy .doc files are not supported. Please save your resume as PDF or .docx and try again.')
  }

  throw new ResumeParseError(415, 'Unsupported file type. Please upload a PDF or .docx resume.')
}

// ---------------------------------------------------------------------------
// OpenRouter (free, dev-only) — plain fetch, no SDK. OpenAI-compatible REST API.
// ---------------------------------------------------------------------------

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/** Minimal OpenRouter chat-completions call. Returns the assistant's raw text.
 * `reasoningEnabled` is model-specific: Lightning writes its chain-of-thought
 * straight into `content` unless reasoning is explicitly disabled (garbles
 * Ask Roo's answers) — pass `false` for it. Nemotron 3 Ultra's JSON output
 * only worked in testing with the `reasoning` field omitted entirely (passing
 * an explicit `enabled: true` produced empty responses, not equivalent to
 * omitting it) — pass `undefined` for it. */
/** Marks an error as worth retrying — the free NVIDIA endpoints are frequently
 * "temporarily overloaded", which OpenRouter reports as a transient upstream
 * failure rather than a problem with the request itself. */
class TransientOpenRouterError extends Error {}

/** The provider refused the call because a usage limit was hit. A distinct type
 * rather than a message substring: callers need to map this to 503 (and show
 * the reason verbatim), and matching on wording silently broke the moment the
 * message said "free tier limit" instead of "rate limit". */
export class AiRateLimitError extends Error {}

async function callOpenRouterOnce(
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  reasoningEnabled: boolean | undefined,
  jsonSchema?: object,
): Promise<string> {
  if (!openRouterApiKey) throw new Error('OPENROUTER_API_KEY is not configured.')

  let res: Response
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000) // free-tier can be slow; fail clearly rather than hang
  try {
    const payload: Record<string, unknown> = { model, messages, max_tokens: maxTokens }
    if (reasoningEnabled !== undefined) payload.reasoning = { enabled: reasoningEnabled }
    // Native schema enforcement, when the model supports it — structurally
    // guarantees parseable output instead of relying on the prompt alone.
    if (jsonSchema) {
      payload.response_format = {
        type: 'json_schema',
        json_schema: { name: 'result', strict: true, schema: jsonSchema },
      }
    }
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TransientOpenRouterError('OpenRouter took too long to respond (over 60s) — the free tier can be slow or congested.')
    }
    throw new TransientOpenRouterError('Could not reach OpenRouter.')
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    if (res.status === 401) throw new Error('OpenRouter rejected the API key. Check OPENROUTER_API_KEY.')
    if (res.status === 429) {
      throw new AiRateLimitError(
        "OpenRouter's free tier limit was reached. Please try again later, or unset AI_PROVIDER to use Claude via ANT_KEY instead.",
      )
    }
    const body = await res.text().catch(() => '')
    if (res.status >= 500) throw new TransientOpenRouterError(`OpenRouter upstream error (${res.status}).`)
    throw new Error(`OpenRouter request failed (${res.status}): ${body.slice(0, 200)}`)
  }

  // OpenRouter reports upstream provider failures as HTTP 200 with an `error`
  // field in the body (e.g. {"message":"Upstream error from Nvidia: Service
  // temporarily overloaded","code":502}) — so a 200 alone does not mean success.
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    error?: { message?: string; code?: number }
  }
  if (data.error) {
    const message = data.error.message ?? 'Unknown OpenRouter error'
    const code = data.error.code ?? 0
    if (code >= 500 || /overloaded|timeout|temporarily/i.test(message)) {
      throw new TransientOpenRouterError(message)
    }
    throw new Error(`OpenRouter error: ${message}`)
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) throw new TransientOpenRouterError('OpenRouter returned an empty response.')
  return text
}

/** Calls OpenRouter, retrying a couple of times when the free upstream endpoint
 * reports a transient failure (very common on the free NVIDIA tier). */
async function callOpenRouter(
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  reasoningEnabled: boolean | undefined,
  jsonSchema?: object,
): Promise<string> {
  const MAX_ATTEMPTS = 3
  let lastTransient: Error | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callOpenRouterOnce(model, messages, maxTokens, reasoningEnabled, jsonSchema)
    } catch (err) {
      if (!(err instanceof TransientOpenRouterError)) throw err
      lastTransient = err
      console.warn(`OpenRouter attempt ${attempt}/${MAX_ATTEMPTS} failed (transient): ${err.message}`)
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
  throw new Error(
    `${lastTransient?.message ?? 'OpenRouter request failed.'} The free tier is busy — please try again in a moment, or unset AI_PROVIDER to use Claude via ANT_KEY.`,
  )
}

/** Extracts the JSON object from a free-form model response, defensively:
 * strips a ```json ... ``` fence if present, then — since a small free model
 * may still wrap the object in a sentence or two despite instructions —
 * slices from the first `{` to the matching last `}` rather than requiring
 * the entire response to be nothing but JSON. */
function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced ? fenced[1] : text).trim()
  const end = body.lastIndexOf('}')
  if (end === -1) return body
  // Try each '{' as a start position until one parses. A plain first-brace slice
  // isn't enough: some models emit a stray leading brace or a line of prose
  // before the real object (Nemotron 3 Super reliably prefixes an extra "{"),
  // which would make the whole slice unparseable.
  for (let i = body.indexOf('{'); i !== -1 && i < end; i = body.indexOf('{', i + 1)) {
    const candidate = body.slice(i, end + 1)
    try {
      JSON.parse(candidate)
      return candidate
    } catch {
      // not a valid object starting here — try the next brace
    }
  }
  return body
}

/** Calls OpenRouter and parses the response as JSON, defensively — the free
 * model has no enforced schema, so retry once with a corrective follow-up
 * before giving up. Throws if still invalid after the retry. */
async function callOpenRouterJson(
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  jsonSchema?: object,
  reasoningEnabled?: boolean,
): Promise<unknown> {
  const first = await callOpenRouter(model, messages, maxTokens, reasoningEnabled, jsonSchema)
  try {
    return JSON.parse(extractJsonObject(first))
  } catch {
    // Only reachable when the model has no real schema enforcement; kept as a
    // safety net for models where response_format is advisory.
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: first },
      {
        role: 'user',
        content: 'Your entire reply must be ONLY the JSON object — starting with { and ending with }. No words before or after it, no markdown, no code fence. Output the JSON object now.',
      },
    ]
    const second = await callOpenRouter(model, retryMessages, maxTokens, reasoningEnabled, jsonSchema)
    return JSON.parse(extractJsonObject(second)) // still invalid → let it throw, caller maps to a clean error
  }
}

// A concrete filled-in example (rather than a formal JSON Schema definition)
// — smaller free models follow a shown example far more reliably than an
// abstract schema, and putting it AFTER the resume text (closest to where
// generation starts) keeps the instruction from getting "lost" in a long
// prompt.
const OPENROUTER_RESUME_EXAMPLE = JSON.stringify(
  {
    name: 'Full Name',
    email: 'name@example.com (or "" if not stated)',
    phone: '+91 98765 43210 (or "")',
    linkedin: 'https://linkedin.com/in/... (or "")',
    city: 'City (or "")',
    headline: 'One-line professional headline',
    bio: '2-3 sentence first-person professional bio grounded in the resume',
    batchYear: '4-digit year, e.g. "2018" (or "")',
    course: 'Degree/course name (or "")',
    experienceYears: 'Total years as digits, e.g. "6" (or "")',
    domain: `one of: ${DOMAINS.filter(Boolean).join(', ')} (or "")`,
    employmentType: `one of: ${EMPLOYMENT_TYPES.filter(Boolean).join(', ')} (or "")`,
    college: 'Institution name if currently a Student, else ""',
    experience: [{ role: 'Job title', company: 'Company name', period: '2022 — Present', summary: 'One achievement-focused sentence' }],
    skills: ['skill one', 'skill two'],
  },
  null,
  2,
)

function buildOpenRouterResumePrompt(resumeText: string): string {
  return (
    `Resume text:\n\n${resumeText}\n\n---\n\n${PROMPT}\n\n` +
    `Fill in real values from the resume above into exactly this JSON shape:\n${OPENROUTER_RESUME_EXAMPLE}\n\n` +
    'Your entire response must be ONLY that JSON object — starting with { and ending with }. No markdown, no code fence, no explanation, no text before or after it.'
  )
}

/** Extracts plain text from the uploaded resume — used by the OpenRouter path,
 * which (unlike Claude) has no confirmed native PDF/document understanding. */
async function extractResumeText(dataBase64: string, mediaType?: string): Promise<string> {
  const clean = dataBase64.replace(/\s/g, '')
  const buffer = Buffer.from(clean, 'base64')

  if (mediaType === 'application/pdf') {
    try {
      const text = await extractPdfText(buffer)
      const trimmed = text.trim()
      if (!trimmed) {
        throw new ResumeParseError(422, 'Could not read text from that PDF — it may be a scanned image. Please fill in your details manually.')
      }
      return trimmed
    } catch (err) {
      if (err instanceof ResumeParseError) throw err
      console.error('extractResumeText (PDF) failed:', err instanceof Error ? err.stack ?? err.message : err)
      throw new ResumeParseError(422, 'Could not read that PDF. Please check the file or fill in your details manually.')
    }
  }

  if (mediaType === DOCX_MIME) {
    let text = ''
    try {
      const { value } = await mammoth.extractRawText({ buffer })
      text = value.trim()
    } catch {
      throw new ResumeParseError(422, 'Could not read that Word document. Please export it as a PDF and try again.')
    }
    if (!text) {
      throw new ResumeParseError(422, 'That Word document appears to be empty. Please check the file or upload a PDF.')
    }
    return text
  }

  if (mediaType === 'application/msword') {
    throw new ResumeParseError(415, 'Legacy .doc files are not supported. Please save your resume as PDF or .docx and try again.')
  }

  throw new ResumeParseError(415, 'Unsupported file type. Please upload a PDF or .docx resume.')
}

async function parseResumeOpenRouter(dataBase64: string, mediaType?: string): Promise<ResumeParseResult> {
  const text = await extractResumeText(dataBase64, mediaType)
  const messages: ChatMessage[] = [{ role: 'user', content: buildOpenRouterResumePrompt(text) }]

  let parsed: unknown
  try {
    // reasoning disabled: with it on, this model spent ~1,000-1,900 of its token
    // budget on internal reasoning and got truncated mid-JSON (finish_reason
    // "length"), which is what produced the malformed/garbled output. Off, it
    // completes in ~650 tokens, runs ~3x faster, and extracts more accurately.
    // 4096 is generous headroom over that real ~650-token need.
    parsed = await callOpenRouterJson(OPENROUTER_RESUME_MODEL, messages, 4096, SCHEMA, false)
  } catch (err) {
    console.error('Resume parse (OpenRouter) failed:', err instanceof Error ? err.message : err)
    // Usage limits are actionable, so pass the reason through verbatim.
    if (err instanceof AiRateLimitError) throw new ResumeParseError(503, err.message)
    throw new ResumeParseError(502, 'Resume parsing failed. Please try again, or fill in your details manually.')
  }

  // Never trust the free model's JSON blindly — a minimal shape check before use.
  if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { name?: unknown }).name !== 'string') {
    throw new ResumeParseError(502, 'The AI returned an unexpected response. Please try again or fill in your details manually.')
  }

  return { ...(parsed as Omit<ResumeParseResult, 'source'>), source: 'ai' }
}

/**
 * Parse a resume — real extraction for PDF and DOCX via whichever provider is
 * configured (see AI_PROVIDER above).
 *
 * There is no demo mode. An unconfigured server fails loudly instead of
 * returning the sample profile: the caller merges whatever comes back straight
 * into the onboarding form, so canned data would land in a real member's
 * profile as if it had been read off their resume.
 */
export async function parseResume(
  dataBase64?: string,
  mediaType?: string,
): Promise<ResumeParseResult> {
  if (!aiEnabled) {
    throw new ResumeParseError(
      503,
      AI_PROVIDER === 'openrouter'
        ? 'Resume parsing is not configured on this server (OPENROUTER_API_KEY missing). Please fill in your details manually.'
        : 'Resume parsing is not configured on this server (ANT_KEY missing). Please fill in your details manually.',
    )
  }

  if (!dataBase64) {
    throw new ResumeParseError(400, 'No file received — please re-upload your resume.')
  }

  if (AI_PROVIDER === 'openrouter') {
    return parseResumeOpenRouter(dataBase64, mediaType)
  }

  // aiEnabled already guarantees a client on the anthropic path; this keeps the
  // narrowing explicit rather than asserting non-null.
  if (!client) {
    throw new ResumeParseError(503, 'Resume parsing is not configured on this server (ANT_KEY missing).')
  }

  const content = await buildContent(dataBase64, mediaType)

  try {
    const res = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8192,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content }],
    } as Anthropic.MessageCreateParamsNonStreaming)

    if (res.stop_reason === 'refusal') {
      throw new ResumeParseError(422, 'The AI declined to process this document. Please fill in your details manually.')
    }
    if (res.stop_reason === 'max_tokens') {
      throw new ResumeParseError(422, 'This resume is too long to parse. Please upload a shorter version.')
    }

    const text = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text
    if (!text) {
      throw new ResumeParseError(502, 'The AI returned an empty response. Please try again.')
    }
    const parsed = JSON.parse(text) as Omit<ResumeParseResult, 'source'>
    return { ...parsed, source: 'ai' }
  } catch (err) {
    if (err instanceof ResumeParseError) throw err
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('Resume parse: ANT_KEY rejected by the API')
      throw new ResumeParseError(502, 'The AI service rejected the server API key. Contact the administrator.')
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new ResumeParseError(503, 'The AI service is busy right now. Please try again in a minute.')
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new ResumeParseError(502, 'Could not reach the AI service. Please try again.')
    }
    console.error('Resume parse failed:', err instanceof Error ? err.message : err)
    throw new ResumeParseError(502, 'Resume parsing failed. Please try again, or fill in your details manually.')
  }
}

const ROO_SYSTEM =
  'You are Roo, the friendly assistant inside Root Connect — the Rooman Technologies alumni network. ' +
  'Answer questions using ONLY the network data snapshot provided below. Never invent people, jobs, ' +
  'events or numbers. Be brief (2-4 sentences), warm and practical. When it helps, tell the user ' +
  'where to click: the Jobs page for openings, Mentorship for booking sessions, Events for RSVPs, ' +
  'My Network to connect, or a person’s profile. If the data does not contain the answer, say so ' +
  'plainly and suggest the closest thing it does contain.'

export interface RooTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Ask the configured AI provider a question grounded in a snapshot of the
 * network's data (see AI_PROVIDER above). */
export async function askRoo(question: string, history: RooTurn[], context: string): Promise<string> {
  const systemWithContext = `${ROO_SYSTEM}\n\n=== NETWORK DATA SNAPSHOT ===\n${context}`

  if (AI_PROVIDER === 'openrouter') {
    if (!openRouterApiKey) {
      throw new Error('AI is not configured on this server (OPENROUTER_API_KEY missing).')
    }
    const messages: ChatMessage[] = [
      { role: 'system', content: systemWithContext },
      ...history.slice(-6).map((h): ChatMessage => ({ role: h.role, content: h.content })),
      { role: 'user', content: question },
    ]
    // Reasoning OFF — Lightning writes its chain-of-thought straight into
    // `content` otherwise, garbling the visible answer (confirmed in testing).
    return callOpenRouter(OPENROUTER_ASKROO_MODEL, messages, 1024, false)
  }

  if (!client) {
    throw new Error('AI is not configured on this server (ANT_KEY missing).')
  }
  const res = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: systemWithContext,
    messages: [...history.slice(-6), { role: 'user', content: question }],
  } as Anthropic.MessageCreateParamsNonStreaming)
  if (res.stop_reason === 'refusal') {
    return "Sorry — I can't help with that one."
  }
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
  return text || 'Sorry — I came up empty. Try rephrasing?'
}
