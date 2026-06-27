import type { Alumni, ContactRow, Post, ResumeParseResult, StatusTag } from '../types'

async function http<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  getAlumni: () => http<Alumni[]>('/api/alumni'),

  addAlumni: (row: { name: string; phone: string; email: string }) =>
    http<Alumni>('/api/alumni', { method: 'POST', body: JSON.stringify(row) }),

  bulkAddAlumni: (rows: ContactRow[]) =>
    http<{ added: Alumni[]; skipped: Array<{ email?: string; reason: string }> }>(
      '/api/alumni/bulk',
      { method: 'POST', body: JSON.stringify({ rows }) },
    ),

  sendInvites: (invites: Array<{ id: string; email: boolean; whatsapp: boolean }>) =>
    http<{ emailCount: number; whatsappCount: number; total: number; message: string }>(
      '/api/invites/batch',
      { method: 'POST', body: JSON.stringify({ invites }) },
    ),

  signup: (email: string, password: string) =>
    http<{ token: string; email: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  social: (provider: 'google' | 'linkedin') =>
    http<{ token: string; provider: string }>(`/api/auth/social/${provider}`, { method: 'POST' }),

  parseResume: () => http<ResumeParseResult>('/api/resume/parse', { method: 'POST', body: '{}' }),

  getFeed: (tags: StatusTag[] = []) =>
    http<Post[]>(`/api/feed${tags.length ? `?tags=${encodeURIComponent(tags.join(','))}` : ''}`),

  createPost: (content: string, authorTags: StatusTag[]) =>
    http<Post>('/api/feed', { method: 'POST', body: JSON.stringify({ content, authorTags }) }),
}
