import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Announcements from './pages/Announcements'
import ImportantDates from './pages/ImportantDates'
import Attendance from './pages/Attendance'
import People from './pages/People'
import Users from './pages/Users'

function RequireRole({ allowed, children }) {
  const { role } = useAuth()
  if (!allowed.includes(role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#6E1423' }}>
        Loading…
      </div>
    )
  }

  if (!session) return <Login />

  if (!profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', flexDirection: 'column', gap: 12 }}>
        <p>We couldn't find a profile for your account.</p>
        <p style={{ color: '#6B5D4F', fontSize: '0.9rem' }}>
          If you just signed up, check your email to confirm your account, then sign in again.
        </p>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Announcements />} />
        <Route path="dates" element={<ImportantDates />} />
        <Route path="attendance" element={<Attendance />} />
        <Route
          path="people"
          element={<RequireRole allowed={['admin', 'core_team']}><People /></RequireRole>}
        />
        <Route
          path="users"
          element={<RequireRole allowed={['admin']}><Users /></RequireRole>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
