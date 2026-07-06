import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

const ROLES = ['admin', 'core_team', 'sponsor', 'catechumen']
const ROLE_LABELS = { admin: 'Admin', core_team: 'Core Team', sponsor: 'Sponsor', catechumen: 'Catechumen' }

export default function Users() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [cycles, setCycles] = useState([])
  const [newCycleLabel, setNewCycleLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingCycle, setSavingCycle] = useState(false)

  const load = async () => {
    setLoading(true)
    const [{ data: profileRows, error: pErr }, { data: cycleRows, error: cErr }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('cycles').select('*').order('created_at', { ascending: false }),
    ])
    if (pErr) setError(pErr.message)
    else setProfiles(profileRows)
    if (cErr) setError(cErr.message)
    else setCycles(cycleRows)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleRoleChange = async (id, newRole) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const handleDeleteUser = async (p) => {
    const confirmed = confirm(
      `Remove ${p.full_name} from the app?\n\n` +
      `This deletes their profile — their name, role, group assignments, and attendance records will be removed. ` +
      `Anything they posted (announcements, etc.) stays, just no longer credited to them.\n\n` +
      `Note: this does NOT delete their login. If you also want to fully remove their account so the email ` +
      `can be reused, go to Supabase → Authentication → Users and delete them there too.`
    )
    if (!confirmed) return
    const { error } = await supabase.from('profiles').delete().eq('id', p.id)
    if (error) setError(error.message)
    else load()
  }

  const handleCreateCycle = async (e) => {
    e.preventDefault()
    if (!newCycleLabel.trim()) return
    setSavingCycle(true)
    setError('')
    const { error } = await supabase.from('cycles').insert({ label: newCycleLabel.trim() })
    if (error) setError(error.message)
    else {
      setNewCycleLabel('')
      load()
    }
    setSavingCycle(false)
  }

  const handleSetCurrent = async (id, label) => {
    const confirmed = confirm(
      `Set "${label}" as the current cycle?\n\n` +
      `This will archive all current announcements and schedule PDFs under the previous cycle. ` +
      `They won't be deleted — they'll move to the Archive page, and only new posts will show on the main pages from now on.`
    )
    if (!confirmed) return
    const { error } = await supabase.from('cycles').update({ is_current: true }).eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const handleDeleteCycle = async (id) => {
    if (!confirm('Delete this cycle? This does not delete any announcements or records.')) return
    const { error } = await supabase.from('cycles').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Administrator</h1>
          <p className="subtitle">Manage RCIA cycles and member roles</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* ---------- Cycles ---------- */}
      <div className="card">
        <h3>RCIA Cycles</h3>
        <p className="hint" style={{ marginTop: -2 }}>
          The current cycle is shown as a banner across the whole site for everyone.
        </p>

        <form onSubmit={handleCreateCycle} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <label>New cycle label</label>
            <input
              type="text"
              placeholder="e.g. 2027/2028"
              value={newCycleLabel}
              onChange={(e) => setNewCycleLabel(e.target.value)}
            />
          </div>
          <button className="btn gold" type="submit" disabled={savingCycle} style={{ marginBottom: 14 }}>
            {savingCycle ? 'Creating…' : '+ New Cycle'}
          </button>
        </form>

        {loading ? <p>Loading…</p> : cycles.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)' }}>No cycles yet — create your first one above.</p>
        ) : (
          <table>
            <thead><tr><th>Label</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id}>
                  <td>{c.label}</td>
                  <td>
                    {c.is_current ? (
                      <span className="status-pill status-present">Current</span>
                    ) : (
                      <span style={{ color: 'var(--ink-soft)' }}>—</span>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    {!c.is_current && (
                      <button className="btn secondary small" onClick={() => handleSetCurrent(c.id, c.label)}>Set as Current</button>
                    )}
                    <button className="btn danger small" onClick={() => handleDeleteCycle(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="divider-heart">Members &amp; Roles</div>

      {/* ---------- User roles ---------- */}
      <div className="hint">
        New Core Team or Admin members must first register normally (as a Sponsor or Catechumen), then be promoted here.
      </div>

      <div className="card">
        {loading ? <p>Loading…</p> : (
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.full_name}</td>
                  <td>{p.phone}</td>
                  <td>
                    <select value={p.role} onChange={(e) => handleRoleChange(p.id, e.target.value)} style={{ marginBottom: 0 }}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td>
                    {p.id !== user?.id && (
                      <button className="btn danger small" onClick={() => handleDeleteUser(p)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
