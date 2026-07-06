import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Announcements from './pages/Announcements'
import ImportantDates from './pages/ImportantDates'
import Schedule from './pages/Schedule'
import Archive from './pages/Archive'
import Attendance from './pages/Attendance'
import People from './pages/People'
import Users from './pages/Users'

// Wraps a route that requires the person to be signed in at all.
function RequireAuth({ children }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <p>Loading…</p>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) {
    return (
      <div className="card">
        <h3>Setting up your account…</h3>
        <p>
          If you just registered, check your email to confirm your account
          (if required), then sign in again. If this persists, contact an Admin.
        </p>
      </div>
    )
  }
  return children
}

// Wraps a route that additionally requires a specific role.
function RequireRole({ allowed, children }) {
  const { role } = useAuth()
  if (!allowed.includes(role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { loading, session } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#1C1C1A' }}>
        Loading…
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={<Layout />}>
        {/* Public: no login required, so WhatsApp links open straight to content */}
        <Route index element={<Announcements />} />
        <Route path="dates" element={<ImportantDates />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="archive" element={<Archive />} />

        {/* Requires an account */}
        <Route path="attendance" element={<RequireAuth><Attendance /></RequireAuth>} />
        <Route
          path="people"
          element={<RequireAuth><RequireRole allowed={['admin', 'core_team']}><People /></RequireRole></RequireAuth>}
        />
        <Route
          path="users"
          element={<RequireAuth><RequireRole allowed={['admin']}><Users /></RequireRole></RequireAuth>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
