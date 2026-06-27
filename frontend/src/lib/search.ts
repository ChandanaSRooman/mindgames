import type { Community, Post, User } from '../types'

export function matchesPostQuery(post: Post, users: User[], query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const author = users.find((u) => u.id === post.authorId)
  return [
    post.content,
    post.type,
    post.domain,
    post.city,
    post.role,
    post.company,
    author?.name,
    author?.designation,
    author?.company,
  ]
    .filter(Boolean)
    .some((s) => (s as string).toLowerCase().includes(q))
}

export function matchesUserQuery(user: User, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [
    user.name,
    user.designation,
    user.company,
    user.city,
    user.domain,
    ...user.expertise,
  ]
    .filter(Boolean)
    .some((s) => s.toLowerCase().includes(q))
}

export function matchesCommunityQuery(c: Community, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [c.name, c.description, c.tag, c.category].some((s) => s.toLowerCase().includes(q))
}
