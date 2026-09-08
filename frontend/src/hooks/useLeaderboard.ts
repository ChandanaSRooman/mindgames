import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type Leaders = Awaited<ReturnType<typeof api.getLeaderboard>>

/**
 * Top contributors, shared by both sidebars so the fetch logic can't drift.
 * Fails quiet: the leaderboard is decorative, so a failed request just leaves
 * the list empty rather than surfacing an error.
 *
 * Only one sidebar mounts at a time (AppLayout picks HomeRightSidebar on /home,
 * RightSidebar elsewhere), so this does not double-fetch.
 */
export function useLeaderboard(): Leaders {
  const [leaders, setLeaders] = useState<Leaders>([])
  useEffect(() => {
    api.getLeaderboard().then(setLeaders, () => {})
  }, [])
  return leaders
}
