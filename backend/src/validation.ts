import { z } from 'zod'

/**
 * zod's .url() accepts any scheme — javascript:, data:, mailto:, ftp:. Every
 * link here is later rendered as a clickable href for someone ELSE (a meeting
 * link the mentee joins, evidence the mentor opens, a public resource), so
 * only web links are allowed.
 */
export const HTTP_URL = /^https?:\/\//i
export const HTTP_URL_MESSAGE = 'Links must start with http:// or https://'

/** For hand-rolled checks outside a zod schema. */
export function isHttpUrl(value: string): boolean {
  return HTTP_URL.test(value) && z.string().url().safeParse(value).success
}
