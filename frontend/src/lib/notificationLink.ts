import type { AppNotification } from '../types'

// Where a notification should take you.
//
// Before this, routing was per TYPE: every "X commented on your post" landed on
// the top of the feed, whichever post it was, because the row did not record
// what it was about. The backend now stores a target, and this turns that pair
// into a URL.
//
// Two rules keep it honest:
//
// 1. THE FALLBACK IS PASSED IN, not imported. The per-type routes live in a
//    layout component (NOTIFICATION_ROUTES), and lib/ must not import from
//    components/ — that dependency would point the wrong way and make this
//    module untestable on its own.
//
// 2. A TARGET WE CANNOT LINK TO FALLS BACK, never breaks. `event`, `startup`
//    and `session` are stored but have no per-item page to land on yet, so they
//    return the fallback. The same happens for a deleted target, whose id still
//    sits on the notification: a stale link to a list page, never a dead one.

/** Deep link for a notification, or `fallback` when there is nothing to link to. */
export function notificationLink(n: AppNotification, fallback: string): string {
  if (!n.targetType || !n.targetId) return fallback
  switch (n.targetType) {
    // Home already resolves this anchor: it pulls the post into the feed even
    // when it falls outside the ranked window, scrolls to it and highlights it.
    case 'post':
      return `/home#post-${n.targetId}`
    case 'community':
      return `/community/${n.targetId}`
    case 'user':
      return `/profile/${n.targetId}`
    case 'company':
      return `/companies/${n.targetId}`
    // No per-item route exists for these yet. Storing the target now means
    // adding one later is a change to this function alone.
    case 'event':
    case 'startup':
    case 'session':
    case 'conversation':
      return fallback
    default:
      return fallback
  }
}

/**
 * True when the notification should open the chat panel rather than navigate.
 *
 * A message notification has a conversation target, but the chat is a panel
 * over the current page, not a route — so the caller opens it with the actor's
 * id instead of pushing a URL.
 */
export function opensChat(n: AppNotification): boolean {
  return n.targetType === 'conversation' && !!n.actorId
}
