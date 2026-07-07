import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AppProvider, useApp } from './store/AppStore'
import { Toaster } from './components/ui/Toaster'
import { AppLayout } from './components/layout/AppLayout'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { AcceptInvite } from './pages/AcceptInvite'
import { Onboarding } from './pages/Onboarding'
import { Home } from './pages/Home'
import { MyNetwork } from './pages/MyNetwork'
import { Jobs } from './pages/Jobs'
import { Mentorship } from './pages/Mentorship'
import { StartupVarsity } from './pages/StartupVarsity'
import { News } from './pages/News'
import { ExploreCommunities } from './pages/ExploreCommunities'
import { CommunityPage } from './pages/CommunityPage'
import { Profile } from './pages/Profile'
import { Settings } from './pages/Settings'
import { Notifications } from './pages/Notifications'
import { AdminDashboard } from './pages/AdminDashboard'

// Gate for authenticated areas. Shows a spinner while the session hydrates,
// then redirects to /login if there's no valid session.
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useApp()
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f6f7f8]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff4500] border-t-transparent" />
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Admin console gate: must be signed in as the admin account
// (network@rooman.com); everyone else lands back on their feed.
function RequireAdmin({ children }: { children: ReactNode }) {
  const { currentUser } = useApp()
  if (!currentUser.isAdmin) return <Navigate to="/home" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public / full-screen (no app chrome) */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminDashboard />
                </RequireAdmin>
              </RequireAuth>
            }
          />

          {/* App shell (navbar + sidebars) — requires a session */}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/home" element={<Home />} />
            <Route path="/network" element={<MyNetwork />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/mentorship" element={<Mentorship />} />
            <Route path="/startupvarsity" element={<StartupVarsity />} />
            <Route path="/news" element={<News />} />
            <Route path="/explore" element={<ExploreCommunities />} />
            <Route path="/community/:id" element={<CommunityPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AppProvider>
  )
}
