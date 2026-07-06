import { useEffect, useState } from 'react'
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
  const isManager = role === 'admin' || role === 'core_team'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Attendance</h1>
          <p className="subtitle">RCIA runs every Monday (except public holidays)</p>
        </div>
      </div>

      <MyAttendance profile={profile} />

      {isManager && (
        <>
          <div className="divider-heart">Session Management</div>
          <ManagerView isAdmin={role === 'admin'} />
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
        dates.map((d) => {
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
        })
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
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    const loadRollup = async () => {
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
    loadRollup()
  }, [selectedDate])

  const absentCount = people.filter((p) => records[p.id]?.status === 'absent').length

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

          <table>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Status</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const rec = records[p.id]
                const status = rec?.status ?? 'present'
                return (
                  <tr key={p.id}>
                    <td>{p.full_name}</td>
                    <td><span className={`role-badge role-${p.role}`}>{ROLE_LABELS[p.role] ?? p.role}</span></td>
                    <td><span className={`status-pill status-${status}`}>{status === 'absent' ? 'Absent' : 'Attending'}</span></td>
                    <td>{rec?.note || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
