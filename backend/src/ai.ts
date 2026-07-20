import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import { resumeParseResult, type ResumeParseResult } from './data.js'

// ANT_KEY is this app's config name; ANTHROPIC_API_KEY is the standard SDK var.
const apiKey = process.env.ANT_KEY || process.env.ANTHROPIC_API_KEY
const client = apiKey ? new Anthropic({ apiKey }) : null

export const aiEnabled = !!client

/** Thrown when parsing fails for a reason the user can act on. */
export class ResumeParseError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// Must stay in sync with DOMAINS / EMPLOYMENT_TYPES in frontend/src/types.ts.
// "" means "could not tell from the resume" — the form keeps its own value then.
const DOMAINS = ['Cloud', 'AI/ML', 'Cybersecurity', 'DevOps', 'Data', 'Web Dev', 'Mobile', 'UI/UX', '']
const EMPLOYMENT_TYPES = ['Employed', 'Freelancer', 'Entrepreneur', 'Looking for opportunity', '']

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
    employmentType: { type: 'string', enum: EMPLOYMENT_TYPES, description: 'Current employment status, "" if unclear' },
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
    'batchYear', 'course', 'experienceYears', 'domain', 'employmentType',
    'experience', 'skills',
  ],
}

const PROMPT =
  'Extract this resume into structured data for an alumni-network profile. ' +
  'Work experience is listed newest-first. ' +
  'Use only information present in the document — never invent employers, contact details, or dates. ' +
  'Use "" (or []) for anything the document does not state. ' +
  'For domain and employmentType, pick the closest allowed value based on the overall profile.'

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

/**
 * Parse a resume with Claude (real extraction for PDF and DOCX).
 * Demo mode: with no ANT_KEY configured, returns a fixed sample result marked
 * source: 'fallback' so the UI can say so. With a key configured, failures
 * throw ResumeParseError — no silently invented profile data.
 */
export async function parseResume(
  dataBase64?: string,
  mediaType?: string,
): Promise<ResumeParseResult> {
  if (!client) return resumeParseResult

  if (!dataBase64) {
    throw new ResumeParseError(400, 'No file received — please re-upload your resume.')
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
  'You are Roo, the friendly assistant inside RooConnect — the Rooman Technologies alumni network. ' +
  'Answer questions using ONLY the network data snapshot provided below. Never invent people, jobs, ' +
  'events or numbers. Be brief (2-4 sentences), warm and practical. When it helps, tell the user ' +
  'where to click: the Jobs page for openings, Mentorship for booking sessions, Events for RSVPs, ' +
  'My Network to connect, or a person\u2019s profile. If the data does not contain the answer, say so ' +
  'plainly and suggest the closest thing it does contain.'

export interface RooTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Ask Claude a question grounded in a snapshot of the network's data. */
export async function askRoo(question: string, history: RooTurn[], context: string): Promise<string> {
  if (!client) {
    throw new Error('AI is not configured on this server (ANT_KEY missing).')
  }
  const res = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: `${ROO_SYSTEM}\n\n=== NETWORK DATA SNAPSHOT ===\n${context}`,
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
