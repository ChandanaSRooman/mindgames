import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './store/AppStore'
import { Toaster } from './components/ui/Toaster'
import { AppLayout } from './components/layout/AppLayout'
import { Landing } from './pages/Landing'
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
import { Notifications } from './pages/Notifications'
import { AdminDashboard } from './pages/AdminDashboard'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public / full-screen (no app chrome) */}
          <Route path="/" element={<Landing />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/admin" element={<AdminDashboard />} />

          {/* App shell (navbar + sidebars) */}
          <Route element={<AppLayout />}>
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
            <Route path="/notifications" element={<Notifications />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AppProvider>
  )
}
