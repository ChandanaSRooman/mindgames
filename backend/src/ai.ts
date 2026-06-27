import Anthropic from '@anthropic-ai/sdk'
import { resumeParseResult, type ResumeParseResult } from './data.js'

const apiKey = process.env.ANT_KEY
const client = apiKey ? new Anthropic({ apiKey }) : null

export const aiEnabled = !!client

// JSON Schema the model must fill — mirrors ResumeParseResult.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string' },
          company: { type: 'string' },
          period: { type: 'string' },
          summary: { type: 'string' },
        },
        required: ['role', 'company', 'period', 'summary'],
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
  },
  required: ['headline', 'experience', 'skills'],
}

const PROMPT =
  'Extract this resume into structured data. Write a one-line professional headline, ' +
  'list work experience newest-first (role, company, period like "2022 — Present", and a ' +
  'one-sentence achievement-focused summary), and a flat list of concrete skills. ' +
  'Infer reasonable values only from the document; do not invent employers.'

/**
 * Parse a resume with Claude. Real extraction for PDFs when ANT_KEY is set;
 * otherwise (no key, non-PDF, or any error) falls back to the mock result so
 * the onboarding flow always works.
 * ponytail: PDF only for real parsing — DOCX needs text extraction first
 * (add `mammoth` and pass the text as a content block to lift this ceiling).
 */
export async function parseResume(
  dataBase64?: string,
  mediaType?: string,
): Promise<ResumeParseResult> {
  if (!client || !dataBase64 || mediaType !== 'application/pdf') return resumeParseResult
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: dataBase64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming)

    if (res.stop_reason === 'refusal') return resumeParseResult
    const text = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text
    return text ? (JSON.parse(text) as ResumeParseResult) : resumeParseResult
  } catch (err) {
    console.error('Resume parse failed, using fallback:', err instanceof Error ? err.message : err)
    return resumeParseResult
  }
}
