import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './store/AppStore'
import { Toaster } from './components/ui/Toaster'
import { AdminDashboard } from './pages/AdminDashboard'
import { AcceptInvite } from './pages/AcceptInvite'
import { Onboarding } from './pages/Onboarding'
import { Feed } from './pages/Feed'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AppProvider>
  )
}
