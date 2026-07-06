import { useEffect, useState, Fragment } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  admin: 'Admin',
  core_team: 'Core Team',
  sponsor: 'Sponsor',
  catechumen: 'Catechumen',
}

export default function Attendance() {
  const { profile, role } = useAuth()
  const isAdmin = role === 'admin'
  const isCoreTeam = role === 'core_team'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Attendance</h1>
          <p className="subtitle">RCIA runs every Monday (except public holidays)</p>
        </div>
      </div>

      <MyAttendance profile={profile} />

      {isAdmin && (
        <>
          <div className="divider-heart">Dashboard</div>
          <AbsenceDashboard />

          <div className="divider-heart">Session Management</div>
          <ManagerView isAdmin={isAdmin} />
        </>
      )}

      {isCoreTeam && (
        <>
          <div className="divider-heart">Attendance by Session</div>
          <ManagerView isAdmin={false} />
        </>
      )}
    </div>
  )
}

// ---------- Everyone: mark own absence ----------

function MyAttendance({ profile }) {
  const [dates, setDates] = useState([])
  const [myRecords, setMyRecords] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [noteDrafts, setNoteDrafts] = useState({})

  const load = async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: dateRows, error: dateErr }, { data: attRows, error: attErr }] = await Promise.all([
      supabase.from('important_dates').select('*').eq('is_session', true).gte('event_date', today).order('event_date'),
      supabase.from('attendance').select('*').eq('person_id', profile.id),
    ])
    if (dateErr) setError(dateErr.message)
    else setDates(dateRows)
    if (attErr) setError(attErr.message)
    else {
      const map = {}
      attRows.forEach((r) => { map[r.important_date_id] = r })
      setMyRecords(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const markAbsent = async (dateId) => {
    const note = noteDrafts[dateId] ?? ''
    const { error } = await supabase.from('attendance').upsert(
      { important_date_id: dateId, person_id: profile.id, status: 'absent', note },
      { onConflict: 'important_date_id,person_id' }
    )
    if (error) setError(error.message)
    else load()
  }

  const markPresent = async (dateId) => {
    const { error } = await supabase.from('attendance').upsert(
      { important_date_id: dateId, person_id: profile.id, status: 'present', note: '' },
      { onConflict: 'important_date_id,person_id' }
    )
    if (error) setError(error.message)
    else load()
  }

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <p>Loading…</p>
      ) : dates.length === 0 ? (
        <div className="empty-state card">
          <h3>No upcoming sessions</h3>
          <p>Once Admin schedules the next RCIA session, you can mark your attendance here.</p>
        </div>
      ) : (
        <div className="scroll-cards">
          {dates.map((d) => {
            const rec = myRecords[d.id]
            const status = rec?.status ?? 'present'
            return (
              <div className="card" key={d.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3 style={{ marginBottom: 4 }}>{d.title}</h3>
                  <span className={`status-pill status-${status}`}>
                    {status === 'absent' ? 'Marked Absent' : 'Attending'}
                  </span>
                </div>
                <p style={{ color: 'var(--ink-soft)', margin: '4px 0 12px 0' }}>
                  {new Date(d.event_date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {d.location ? ` · ${d.location}` : ''}
                </p>

                {status === 'present' ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      style={{ marginBottom: 0 }}
                      value={noteDrafts[d.id] ?? ''}
                      onChange={(e) => setNoteDrafts({ ...noteDrafts, [d.id]: e.target.value })}
                    />
                    <button className="btn danger" onClick={() => markAbsent(d.id)}>Mark Absent</button>
                  </div>
                ) : (
                  <div>
                    {rec?.note && <p style={{ fontStyle: 'italic', color: 'var(--ink-soft)' }}>Reason: {rec.note}</p>}
                    <button className="btn secondary" onClick={() => markPresent(d.id)}>I'll be there after all</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Admin only: absence dashboard ----------

function AbsenceDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalAbsences, setTotalAbsences] = useState(0)
  const [sessionsHeld, setSessionsHeld] = useState(0)
  const [breakdown, setBreakdown] = useState([])
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const today = new Date().toISOString().slice(0, 10)
      const [{ data: absentRows, error: aErr }, { data: profileRows, error: pErr }, { count: sessionCount, error: sErr }] = await Promise.all([
        supabase.from('attendance').select('person_id, note, important_dates(title, event_date)').eq('status', 'absent'),
        supabase.from('profiles').select('id, full_name, role'),
        supabase.from('important_dates').select('id', { count: 'exact', head: true }).eq('is_session', true).lte('event_date', today),
      ])
      if (aErr) setError(aErr.message)
      if (pErr) setError(pErr.message)
      if (sErr) setError(sErr.message)

      if (absentRows) {
        setTotalAbsences(absentRows.length)
        const grouped = {}
        absentRows.forEach((r) => {
          if (!grouped[r.person_id]) grouped[r.person_id] = []
          grouped[r.person_id].push({
            title: r.important_dates?.title ?? 'Session',
            event_date: r.important_dates?.event_date,
            note: r.note,
          })
        })
        const profileMap = {}
        ;(profileRows ?? []).forEach((p) => { profileMap[p.id] = p })
        const rows = Object.entries(grouped)
          .map(([personId, records]) => ({
            id: personId,
            full_name: profileMap[personId]?.full_name ?? 'Unknown',
            role: profileMap[personId]?.role ?? '—',
            count: records.length,
            records: records.sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? '')),
          }))
          .sort((a, b) => b.count - a.count)
        setBreakdown(rows)
      }
      setSessionsHeld(sessionCount ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  const toggleExpanded = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="card">
      {error && <div className="error-msg">{error}</div>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--ink)' }}>{totalAbsences}</div>
              <div style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>Total absences marked to date</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--ink)' }}>{sessionsHeld}</div>
              <div style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>Sessions held so far</div>
            </div>
          </div>

          {breakdown.length === 0 ? (
            <p style={{ color: 'var(--ink-soft)' }}>No absences recorded yet.</p>
          ) : (
            <div className="scroll-table">
              <table>
                <thead><tr><th></th><th>Name</th><th>Role</th><th>Absences</th></tr></thead>
                <tbody>
                  {breakdown.map((p) => (
                    <Fragment key={p.id}>
                      <tr onClick={() => toggleExpanded(p.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ width: 20, color: 'var(--ink-soft)' }}>{expanded[p.id] ? '▾' : '▸'}</td>
                        <td>{p.full_name}</td>
                        <td><span className={`role-badge role-${p.role}`}>{ROLE_LABELS[p.role] ?? p.role}</span></td>
                        <td>{p.count}</td>
                      </tr>
                      {expanded[p.id] && (
                        <tr>
                          <td></td>
                          <td colSpan={3} style={{ paddingTop: 0, paddingBottom: 12 }}>
                            {p.records.map((r, i) => (
                              <div key={i} style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', padding: '3px 0' }}>
                                {r.event_date
                                  ? new Date(r.event_date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                                  : r.title}
                                {r.note ? ` — ${r.note}` : ''}
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------- Admin / Core Team: session tools + roll-up ----------

function ManagerView({ isAdmin }) {
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [people, setPeople] = useState([])
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // single ad-hoc session
  const [singleTitle, setSingleTitle] = useState('RCIA Session')
  const [singleDate, setSingleDate] = useState('')
  const [addingSingle, setAddingSingle] = useState(false)

  // bulk weekly generator
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [preview, setPreview] = useState(null)
  const [creatingBulk, setCreatingBulk] = useState(false)

  const [groupMap, setGroupMap] = useState({}) // person_id -> group name
  const [groupOrder, setGroupOrder] = useState([]) // group names in creation order

  const loadGroups = async () => {
    const [{ data: groupRows }, { data: memberRows }] = await Promise.all([
      supabase.from('groups').select('*').order('name'),
      supabase.from('group_members').select('group_id, person_id'),
    ])
    const groupNameById = {}
    ;(groupRows ?? []).forEach((g) => { groupNameById[g.id] = g.name })
    const map = {}
    ;(memberRows ?? []).forEach((m) => {
      if (!(m.person_id in map)) map[m.person_id] = groupNameById[m.group_id] ?? 'Ungrouped'
    })
    setGroupMap(map)
    setGroupOrder((groupRows ?? []).map((g) => g.name))
  }

  const loadSessions = async () => {
    const { data, error } = await supabase
      .from('important_dates')
      .select('*')
      .eq('is_session', true)
      .order('event_date', { ascending: true })
    if (error) setError(error.message)
    else {
      setDates(data)
      if (data.length > 0 && !selectedDate) setSelectedDate(data[0].id)
    }
  }

  useEffect(() => {
    loadSessions().finally(() => setLoading(false))
    loadGroups()
  }, [])

  const loadRollup = async () => {
    if (!selectedDate) return
    const [{ data: peopleRows, error: pErr }, { data: attRows, error: aErr }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('attendance').select('*').eq('important_date_id', selectedDate),
    ])
    if (pErr) setError(pErr.message)
    else setPeople(peopleRows)
    if (aErr) setError(aErr.message)
    else {
      const map = {}
      attRows.forEach((r) => { map[r.person_id] = r })
      setRecords(map)
    }
  }

  useEffect(() => {
    loadRollup()
  }, [selectedDate])

  const absentCount = people.filter((p) => records[p.id]?.status === 'absent').length

  const handleOverrideAbsent = async (personId) => {
    const note = window.prompt('Reason (optional):') ?? ''
    const { error } = await supabase.from('attendance').upsert(
      { important_date_id: selectedDate, person_id: personId, status: 'absent', note },
      { onConflict: 'important_date_id,person_id' }
    )
    if (error) setError(error.message)
    else loadRollup()
  }

  const handleOverridePresent = async (personId) => {
    const { error } = await supabase.from('attendance').upsert(
      { important_date_id: selectedDate, person_id: personId, status: 'present', note: '' },
      { onConflict: 'important_date_id,person_id' }
    )
    if (error) setError(error.message)
    else loadRollup()
  }

  const handleAddSingle = async (e) => {
    e.preventDefault()
    if (!singleDate) return
    setAddingSingle(true)
    setError('')
    const { error } = await supabase.from('important_dates').insert({
      title: singleTitle || 'RCIA Session',
      event_date: singleDate,
      is_session: true,
    })
    if (error) setError(error.message)
    else {
      setSingleDate('')
      await loadSessions()
    }
    setAddingSingle(false)
  }

  const toLocalISODate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const buildMondays = (startStr, endStr) => {
    const start = new Date(startStr + 'T00:00:00')
    const end = new Date(endStr + 'T00:00:00')
    const mondays = []
    const cursor = new Date(start)
    const day = cursor.getDay()
    const diffToMonday = (8 - day) % 7
    cursor.setDate(cursor.getDate() + diffToMonday)
    while (cursor <= end) {
      mondays.push(toLocalISODate(cursor))
      cursor.setDate(cursor.getDate() + 7)
    }
    return mondays
  }

  const handlePreview = (e) => {
    e.preventDefault()
    if (!rangeStart || !rangeEnd) return
    const mondays = buildMondays(rangeStart, rangeEnd)
    setPreview(mondays.map((date) => ({ date, include: true })))
  }

  const toggleIncluded = (index) => {
    setPreview((prev) => prev.map((p, i) => (i === index ? { ...p, include: !p.include } : p)))
  }

  const handleCreateBulk = async () => {
    const toCreate = preview.filter((p) => p.include).map((p) => ({
      title: 'RCIA Session',
      event_date: p.date,
      is_session: true,
    }))
    if (toCreate.length === 0) return
    setCreatingBulk(true)
    setError('')
    const { error } = await supabase.from('important_dates').insert(toCreate)
    if (error) setError(error.message)
    else {
      setPreview(null)
      setRangeStart('')
      setRangeEnd('')
      await loadSessions()
    }
    setCreatingBulk(false)
  }

  const handleDeleteSession = async (id) => {
    if (!confirm('Delete this session? Any attendance records for it will also be removed.')) return
    const { error } = await supabase.from('important_dates').delete().eq('id', id)
    if (error) setError(error.message)
    else {
      if (selectedDate === id) setSelectedDate('')
      await loadSessions()
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = dates.filter((d) => d.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date))

  return (
    <div>
      {error && <div className="error-msg">{error}</div>}

      {isAdmin && (
        <div className="card">
          <h3>Generate Weekly Sessions</h3>
          <p className="hint" style={{ marginTop: -2 }}>
            Creates a session for every Monday in the range — uncheck any that fall on a public holiday before creating.
          </p>
          <form onSubmit={handlePreview} className="field-row" style={{ alignItems: 'flex-end' }}>
            <div>
              <label>From</label>
              <input type="date" required value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </div>
            <div>
              <label>To</label>
              <input type="date" required value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <button className="btn secondary" type="submit" style={{ marginBottom: 14 }}>Preview Mondays</button>
            </div>
          </form>

          {preview && (
            <div>
              {preview.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)' }}>No Mondays found in that range.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', margin: '10px 0' }}>
                    {preview.map((p, i) => (
                      <label key={p.date} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, fontSize: '0.9rem' }}>
                        <input type="checkbox" checked={p.include} onChange={() => toggleIncluded(i)} style={{ marginBottom: 0 }} />
                        {new Date(p.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </label>
                    ))}
                  </div>
                  <button className="btn gold" onClick={handleCreateBulk} disabled={creatingBulk}>
                    {creatingBulk ? 'Creating…' : `Create ${preview.filter(p => p.include).length} Session(s)`}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="divider-heart">Add a Single Session</div>
          <form onSubmit={handleAddSingle} className="field-row" style={{ alignItems: 'flex-end' }}>
            <div>
              <label>Title</label>
              <input type="text" value={singleTitle} onChange={(e) => setSingleTitle(e.target.value)} />
            </div>
            <div>
              <label>Date</label>
              <input type="date" required value={singleDate} onChange={(e) => setSingleDate(e.target.value)} />
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <button className="btn secondary" type="submit" disabled={addingSingle} style={{ marginBottom: 14 }}>
                {addingSingle ? 'Adding…' : '+ Add Session'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isAdmin && upcoming.length > 0 && (
        <div className="card">
          <h3>Upcoming Sessions</h3>
          <div className="scroll-table">
            <table>
              <thead><tr><th>Date</th><th>Title</th><th></th></tr></thead>
              <tbody>
                {upcoming.map((d) => (
                  <tr key={d.id}>
                    <td>{new Date(d.event_date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>{d.title}</td>
                    <td><button className="btn danger small" onClick={() => handleDeleteSession(d.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : dates.length === 0 ? (
        <div className="empty-state card">
          <h3>No sessions yet</h3>
          <p>{isAdmin ? 'Generate weekly sessions above to start tracking attendance.' : 'Once Admin schedules sessions, attendance can be tracked here.'}</p>
        </div>
      ) : (
        <div className="card">
          <label>Session</label>
          <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
            {dates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} — {new Date(d.event_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </option>
            ))}
          </select>

          <p style={{ color: 'var(--ink-soft)', marginTop: -6 }}>
            {absentCount} of {people.length} have marked themselves absent
          </p>

          <div className="scroll-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Role</th><th>Status</th><th>Reason</th>{isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {[...groupOrder, 'Ungrouped'].map((groupName) => {
                  const groupPeople = people.filter((p) => (groupMap[p.id] ?? 'Ungrouped') === groupName)
                  if (groupPeople.length === 0) return null
                  return (
                    <Fragment key={groupName}>
                      <tr>
                        <td colSpan={isAdmin ? 5 : 4} style={{ background: 'var(--parchment-dim, #F0EDE4)', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--ink-soft)' }}>
                          {groupName}
                        </td>
                      </tr>
                      {groupPeople.map((p) => {
                        const rec = records[p.id]
                        const status = rec?.status ?? 'present'
                        return (
                          <tr key={p.id}>
                            <td>{p.full_name}</td>
                            <td><span className={`role-badge role-${p.role}`}>{ROLE_LABELS[p.role] ?? p.role}</span></td>
                            <td><span className={`status-pill status-${status}`}>{status === 'absent' ? 'Absent' : 'Attending'}</span></td>
                            <td>{rec?.note || '—'}</td>
                            {isAdmin && (
                              <td>
                                {status === 'absent' ? (
                                  <button className="btn secondary small" onClick={() => handleOverridePresent(p.id)}>Mark Present</button>
                                ) : (
                                  <button className="btn danger small" onClick={() => handleOverrideAbsent(p.id)}>Mark Absent</button>
                                )}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {isAdmin && (
            <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
              As Admin, you can mark or correct attendance on someone's behalf if they haven't done it themselves.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
