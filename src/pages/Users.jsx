import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const ROLES = ['admin', 'core_team', 'sponsor', 'catechumen']
const ROLE_LABELS = { admin: 'Admin', core_team: 'Core Team', sponsor: 'Sponsor', catechumen: 'Catechumen' }

export default function Users() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').order('full_name')
    if (error) setError(error.message)
    else setProfiles(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleRoleChange = async (id, newRole) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Manage Users</h1>
          <p className="subtitle">Assign roles for everyone registered in the portal</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      <div className="hint">
        New Core Team or Admin members must first register normally (as a Sponsor or Catechumen), then be promoted here.
      </div>

      <div className="card">
        {loading ? <p>Loading…</p> : (
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Role</th></tr></thead>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
