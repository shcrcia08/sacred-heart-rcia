import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SacredHeartMark } from './SacredHeartMark'

const ROLE_LABELS = {
  admin: 'Admin',
  core_team: 'Core Team',
  sponsor: 'Sponsor',
  catechumen: 'Catechumen',
}

export default function Layout() {
  const { profile, role, signOut } = useAuth()

  const canManage = role === 'admin' || role === 'core_team'

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <SacredHeartMark size={30} color="#E8D5A0" />
          <div className="sidebar-brand-text">
            <span className="parish">Sacred Heart</span>
            <span className="ministry">RCIA Ministry</span>
          </div>
        </div>

        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Announcements
          </NavLink>
          <NavLink to="/dates" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Important Dates
          </NavLink>
          <NavLink to="/attendance" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Attendance
          </NavLink>
          {canManage && (
            <NavLink to="/people" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              Sponsors &amp; Catechumens
            </NavLink>
          )}
          {role === 'admin' && (
            <NavLink to="/users" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              Manage Users
            </NavLink>
          )}
        </div>

        <div className="sidebar-footer">
          <div>{profile?.full_name}</div>
          <span className={`role-badge role-${role}`}>{ROLE_LABELS[role] ?? role}</span>
          <div>
            <button className="sign-out-btn" onClick={signOut}>Sign Out</button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
