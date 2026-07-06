import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

const GROUP_ROLE_LABELS = {
  leader: 'Leader',
  co_leader: 'Co-Leader',
  mentor: 'Mentor',
  member: 'Member',
}

const GROUP_ROLE_ORDER = ['leader', 'co_leader', 'mentor', 'member']

export default function Groups() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([]) // all group_members rows, joined with profile
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)

  // per-group "add person" draft state, keyed by group id
  const [addDrafts, setAddDrafts] = useState({})

  const load = async () => {
    setLoading(true)
    const [{ data: groupRows, error: gErr }, { data: memberRows, error: mErr }, { data: profileRows, error: pErr }] = await Promise.all([
      supabase.from('groups').select('*').order('name'),
      supabase.from('group_members').select('*, profiles:person_id(id, full_name, role)'),
      supabase.from('profiles').select('id, full_name, role').order('full_name'),
    ])
    if (gErr) setError(gErr.message)
    else setGroups(groupRows)
    if (mErr) setError(mErr.message)
    else setMembers(memberRows)
    if (pErr) setError(pErr.message)
    else setProfiles(profileRows)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    setError('')
    const { error } = await supabase.from('groups').insert({ name: newGroupName.trim() })
    if (error) setError(error.message)
    else {
      setNewGroupName('')
      load()
    }
    setCreatingGroup(false)
  }

  const handleDeleteGroup = async (id) => {
    if (!confirm('Delete this group and remove all its member assignments?')) return
    const { error } = await supabase.from('groups').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const handleAddMember = async (groupId) => {
    const draft = addDrafts[groupId]
    if (!draft?.personId) return
    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      person_id: draft.personId,
      group_role: draft.groupRole || 'member',
    })
    if (error) setError(error.message)
    else {
      setAddDrafts((prev) => ({ ...prev, [groupId]: { personId: '', groupRole: 'member' } }))
      load()
    }
  }

  const handleRemoveMember = async (memberRowId) => {
    const { error } = await supabase.from('group_members').delete().eq('id', memberRowId)
    if (error) setError(error.message)
    else load()
  }

  const handleChangeRole = async (memberRowId, newRole) => {
    const { error } = await supabase.from('group_members').update({ group_role: newRole }).eq('id', memberRowId)
    if (error) setError(error.message)
    else load()
  }

  const membersForGroup = (groupId) =>
    members
      .filter((m) => m.group_id === groupId)
      .sort((a, b) => GROUP_ROLE_ORDER.indexOf(a.group_role) - GROUP_ROLE_ORDER.indexOf(b.group_role))

  const assignedPersonIds = (groupId) => new Set(membersForGroup(groupId).map((m) => m.person_id))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Groups</h1>
          <p className="subtitle">Sponsors and Catechumens organized into groups, with a Leader, Co-Leader, and Mentor each</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {isAdmin && (
        <form className="card" onSubmit={handleCreateGroup} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>New group name</label>
            <input
              type="text"
              placeholder="e.g. Group A"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
          </div>
          <button className="btn gold" type="submit" disabled={creatingGroup} style={{ marginBottom: 14 }}>
            {creatingGroup ? 'Creating…' : '+ New Group'}
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : groups.length === 0 ? (
        <div className="empty-state card">
          <h3>No groups yet</h3>
          <p>{isAdmin ? 'Create your first group above.' : 'Once Admin creates groups, they will appear here.'}</p>
        </div>
      ) : (
        groups.map((g) => {
          const groupMembers = membersForGroup(g.id)
          const assigned = assignedPersonIds(g.id)
          const availableProfiles = profiles.filter((p) => !assigned.has(p.id))
          const draft = addDrafts[g.id] ?? { personId: '', groupRole: 'member' }

          return (
            <div className="card" key={g.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <h3 style={{ marginBottom: 0 }}>{g.name}</h3>
                {isAdmin && (
                  <button className="btn danger small" onClick={() => handleDeleteGroup(g.id)}>Delete Group</button>
                )}
              </div>

              {groupMembers.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)' }}>No one assigned yet.</p>
              ) : (
                <table>
                  <thead><tr><th>Name</th><th>Role</th>{isAdmin && <th></th>}</tr></thead>
                  <tbody>
                    {groupMembers.map((m) => (
                      <tr key={m.id}>
                        <td>{m.profiles?.full_name ?? 'Unknown'}</td>
                        <td>
                          {isAdmin ? (
                            <select
                              value={m.group_role}
                              onChange={(e) => handleChangeRole(m.id, e.target.value)}
                              style={{ marginBottom: 0 }}
                            >
                              {GROUP_ROLE_ORDER.map((r) => <option key={r} value={r}>{GROUP_ROLE_LABELS[r]}</option>)}
                            </select>
                          ) : (
                            <span className="role-badge role-core_team">{GROUP_ROLE_LABELS[m.group_role]}</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td><button className="btn danger small" onClick={() => handleRemoveMember(m.id)}>Remove</button></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {isAdmin && (
                <div className="field-row" style={{ alignItems: 'flex-end', marginTop: 14 }}>
                  <div>
                    <label>Add person</label>
                    <select
                      value={draft.personId}
                      onChange={(e) => setAddDrafts((prev) => ({ ...prev, [g.id]: { ...draft, personId: e.target.value } }))}
                    >
                      <option value="">Select a member…</option>
                      {availableProfiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Role in group</label>
                    <select
                      value={draft.groupRole}
                      onChange={(e) => setAddDrafts((prev) => ({ ...prev, [g.id]: { ...draft, groupRole: e.target.value } }))}
                    >
                      {GROUP_ROLE_ORDER.map((r) => <option key={r} value={r}>{GROUP_ROLE_LABELS[r]}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: '0 0 auto' }}>
                    <button className="btn secondary" onClick={() => handleAddMember(g.id)} style={{ marginBottom: 14 }}>
                      + Add to Group
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
