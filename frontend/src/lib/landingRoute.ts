import { needsOnboarding, type User } from '../types'

/**
 * Where a member goes immediately after signing in. Shared by Login and the
 * post-invite password screen so the two can't disagree about it.
 *
 * Admins land on the console; members with unfinished setup resume the
 * onboarding wizard; everyone else lands on their feed.
 */
export function landingRoute(user: User): string {
  if (user.isAdmin) return '/admin'
  if (needsOnboarding(user)) return '/onboarding'
  return '/home'
}
