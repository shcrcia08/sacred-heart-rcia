import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCurrentCycle } from '../hooks/useCurrentCycle'

const ROLE_LABELS = {
  admin: 'Admin',
  core_team: 'Core Team',
  sponsor: 'Sponsor',
  catechumen: 'Catechumen',
}

export default function Layout() {
  const { session, profile, role, signOut } = useAuth()
  const { cycle } = useCurrentCycle()

  return (
    <div>
      {cycle && (
        <div className="cycle-banner">
          ✦ RCIA Journey · {cycle.label} ✦
        </div>
      )}
      <div className="app-shell">
        <nav className="sidebar">
          <div className="sidebar-brand">
            <img src="/church-mark.png" alt="Church of the Sacred Heart crest" className="sacred-heart-mark" />
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
            <NavLink to="/schedule" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              Schedule
            </NavLink>

            {session && (
              <NavLink to="/attendance" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                Attendance
              </NavLink>
            )}
            <NavLink to="/prayer-booklet" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              Prayer Booklet
            </NavLink>
            {session && (
              <NavLink to="/groups" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                Groups
              </NavLink>
            )}
            {role === 'admin' && (
              <NavLink to="/users" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                Administrator
              </NavLink>
            )}
            {role === 'admin' && (
              <NavLink to="/archive" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                Archive
              </NavLink>
            )}

            {session ? (
              <button className="nav-link mobile-only-nav-item" onClick={signOut}>Sign Out</button>
            ) : (
              <NavLink to="/login" className={({ isActive }) => 'nav-link mobile-only-nav-item' + (isActive ? ' active' : '')}>
                Sign In
              </NavLink>
            )}
          </div>

          <div className="sidebar-footer">
            {session ? (
              <>
                <div>{profile?.full_name}</div>
                {role && <span className={`role-badge role-${role}`}>{ROLE_LABELS[role] ?? role}</span>}
                <div>
                  <button className="sign-out-btn" onClick={signOut}>Sign Out</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.85rem', opacity: 0.85, marginBottom: 8 }}>
                  Viewing as a guest. Sign in to mark your attendance.
                </div>
                <Link to="/login" className="btn gold small" style={{ width: '100%', justifyContent: 'center' }}>
                  Sign In / Register
                </Link>
              </>
            )}
          </div>
        </nav>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
