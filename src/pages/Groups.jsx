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
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  // ---- shared handlers, used by both Groups and Sub-Ministries sections ----

  const handleCreateGroup = async (name, groupType) => {
    if (!name.trim()) return
    const { error } = await supabase.from('groups').insert({ name: name.trim(), group_type: groupType })
    if (error) setError(error.message)
    else load()
  }

  const handleDeleteGroup = async (id) => {
    if (!confirm('Delete this group and remove all its member assignments?')) return
    const { error } = await supabase.from('groups').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const handleRename = async (id, newName) => {
    if (!newName.trim()) return
    const { error } = await supabase.from('groups').update({ name: newName.trim() }).eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const handleAddMember = async (groupId, personId, groupRole) => {
    if (!personId) return
    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      person_id: personId,
      group_role: groupRole || 'member',
    })
    if (error) setError(error.message)
    else load()
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Groups</h1>
          <p className="subtitle">Sponsors and Catechumens organized into groups and sub-ministries — members can belong to more than one</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <GroupTypeSection
        title="Groups"
        groupType="group"
        createLabel="+ New Group"
        namePlaceholder="e.g. Group A"
        isAdmin={isAdmin}
        loading={loading}
        groups={groups.filter((g) => g.group_type === 'group')}
        profiles={profiles}
        membersForGroup={membersForGroup}
        onCreate={handleCreateGroup}
        onDelete={handleDeleteGroup}
        onRename={handleRename}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        onChangeRole={handleChangeRole}
      />

      <div className="divider-heart">Sub-Ministries</div>

      <GroupTypeSection
        title="Sub-Ministries"
        groupType="sub_ministry"
        createLabel="+ New Sub-Ministry"
        namePlaceholder="e.g. Music Ministry"
        isAdmin={isAdmin}
        loading={loading}
        groups={groups.filter((g) => g.group_type === 'sub_ministry')}
        profiles={profiles}
        membersForGroup={membersForGroup}
        onCreate={handleCreateGroup}
        onDelete={handleDeleteGroup}
        onRename={handleRename}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        onChangeRole={handleChangeRole}
      />
    </div>
  )
}

function GroupTypeSection({
  groupType, createLabel, namePlaceholder, isAdmin, loading, groups, profiles,
  membersForGroup, onCreate, onDelete, onRename, onAddMember, onRemoveMember, onChangeRole,
}) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [editName, setEditName] = useState('')
  const [addDrafts, setAddDrafts] = useState({})

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setCreating(true)
    await onCreate(newName, groupType)
    setNewName('')
    setCreating(false)
  }

  const startRename = (g) => {
    setEditingGroupId(g.id)
    setEditName(g.name)
  }

  const submitRename = async (id) => {
    await onRename(id, editName)
    setEditingGroupId(null)
  }

  return (
    <div>
      {isAdmin && (
        <form className="card" onSubmit={handleCreateSubmit} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>{groupType === 'group' ? 'New group name' : 'New sub-ministry name'}</label>
            <input
              type="text"
              placeholder={namePlaceholder}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <button className="btn gold" type="submit" disabled={creating} style={{ marginBottom: 14 }}>
            {creating ? 'Creating…' : createLabel}
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : groups.length === 0 ? (
        <div className="empty-state card">
          <h3>{groupType === 'group' ? 'No groups yet' : 'No sub-ministries yet'}</h3>
          <p>{isAdmin ? 'Create the first one above.' : 'Once Admin creates one, it will appear here.'}</p>
        </div>
      ) : (
        groups.map((g) => {
          const groupMembers = membersForGroup(g.id)
          const assigned = new Set(groupMembers.map((m) => m.person_id))
          const availableProfiles = profiles.filter((p) => !assigned.has(p.id))
          const draft = addDrafts[g.id] ?? { personId: '', groupRole: 'member' }

          return (
            <div className="card" key={g.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
                {editingGroupId === g.id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ marginBottom: 0 }}
                    />
                    <button className="btn gold small" onClick={() => submitRename(g.id)}>Save</button>
                    <button className="btn secondary small" onClick={() => setEditingGroupId(null)}>Cancel</button>
                  </div>
                ) : (
                  <h3 style={{ marginBottom: 0 }}>{g.name}</h3>
                )}
                {isAdmin && editingGroupId !== g.id && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn secondary small" onClick={() => startRename(g)}>Rename</button>
                    <button className="btn danger small" onClick={() => onDelete(g.id)}>Delete</button>
                  </div>
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
                              onChange={(e) => onChangeRole(m.id, e.target.value)}
                              style={{ marginBottom: 0 }}
                            >
                              {GROUP_ROLE_ORDER.map((r) => <option key={r} value={r}>{GROUP_ROLE_LABELS[r]}</option>)}
                            </select>
                          ) : (
                            <span className="role-badge role-core_team">{GROUP_ROLE_LABELS[m.group_role]}</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td><button className="btn danger small" onClick={() => onRemoveMember(m.id)}>Remove</button></td>
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
                    <label>Role</label>
                    <select
                      value={draft.groupRole}
                      onChange={(e) => setAddDrafts((prev) => ({ ...prev, [g.id]: { ...draft, groupRole: e.target.value } }))}
                    >
                      {GROUP_ROLE_ORDER.map((r) => <option key={r} value={r}>{GROUP_ROLE_LABELS[r]}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: '0 0 auto' }}>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        onAddMember(g.id, draft.personId, draft.groupRole)
                        setAddDrafts((prev) => ({ ...prev, [g.id]: { personId: '', groupRole: 'member' } }))
                      }}
                      style={{ marginBottom: 14 }}
                    >
                      + Add
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
