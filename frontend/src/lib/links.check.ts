import assert from 'node:assert'
import { isHttpUrl } from './links'

for (const ok of ['https://meet.google.com/abc-defg-hij', 'http://example.com', 'https://zoom.us/j/123?pwd=x', 'HTTPS://Example.com/a'])
  assert.strictEqual(isHttpUrl(ok), true, ok)

for (const bad of [
  '', 'meet.google.com/abc', 'javascript:alert(1)', 'data:text/html,hi', 'mailto:a@b.c', 'ftp://x.com',
  'https://', 'https://exa[mple', 'https:// spaced.com',
])
  assert.strictEqual(isHttpUrl(bad), false, bad)

console.log('links.check.ts — all assertions passed')
