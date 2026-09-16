import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { CompanyRoadmaps } from '../../types'

// Shared loader for a company's roadmaps, used by both the section on the
// company page and the full roadmaps page. One copy, so the two can never
// disagree about when data is stale.
//
// Refreshes on mount and whenever the tab becomes visible again — which is what
// "close the app and open it later" looks like to a browser — throttled so
// flicking between tabs does not hammer the endpoint. That is the whole of the
// "no sync button" promise: there is nothing to press because there is nothing
// to press for.
//
// A hook rather than a lib/ helper because it owns React state and effects, and
// lib/ is for pure functions with no React in them.
const STALE_AFTER_MS = 5 * 60 * 1000

export function useCompanyRoadmaps(companyId: string | undefined) {
  const [data, setData] = useState<CompanyRoadmaps | null>(null)
  const [failed, setFailed] = useState(false)
  const fetchedAt = useRef(0)
  // Guards against a refetch landing after the component has unmounted.
  const alive = useRef(true)
  // Which company the latest request is for. A plain boolean is not enough:
  // navigating between two company pages tears down and re-runs the effect,
  // which sets the boolean back to true, so a slow response for the PREVIOUS
  // company still passes the check and renders under the new company's name.
  // Comparing the id the request was made with closes that window.
  const wantedId = useRef(companyId)

  const load = useCallback(
    async (force = false) => {
      if (!companyId) return
      if (!force && Date.now() - fetchedAt.current < STALE_AFTER_MS) return
      fetchedAt.current = Date.now()
      wantedId.current = companyId
      try {
        const next = await api.getCompanyRoadmaps(companyId)
        if (!alive.current || wantedId.current !== companyId) return
        setData(next)
        setFailed(false)
      } catch {
        if (!alive.current || wantedId.current !== companyId) return
        // Reset the clock so the next visibility change retries rather than
        // being throttled out by a failed attempt.
        fetchedAt.current = 0
        setFailed(true)
      }
    },
    [companyId],
  )

  useEffect(() => {
    alive.current = true
    // A different company means the cached response is not just stale, it is
    // the wrong company's — clear it so no roadmap renders under the new name.
    setData(null)
    void load(true)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive.current = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  return { data, failed, reload: () => load(true) }
}

/**
 * The roadmaps to render, viewer's own first.
 *
 * The API returns the viewer separately from the list (they need their own
 * copy to edit, and it belongs in its own card), so anything showing a single
 * feed has to put the two back together — forgetting to is why a freshly
 * shared roadmap appears nowhere.
 */
export function roadmapFeed(data: CompanyRoadmaps | null) {
  if (!data) return []
  const mine = data.mine
  // Only show their own once it says something. A bare profile-derived timeline
  // for the viewer is not news to the viewer.
  const includeMine = mine && (mine.contributed || mine.steps.length > 0)
  return [
    ...(includeMine ? [{ roadmap: mine, isMine: true }] : []),
    ...data.roadmaps.map((roadmap) => ({ roadmap, isMine: false })),
  ]
}
