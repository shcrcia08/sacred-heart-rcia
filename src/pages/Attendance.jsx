import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Attendance() {
  const { profile, role } = useAuth()
  const isManager = role === 'admin' || role === 'core_team'

  return isManager ? <ManagerView /> : <SelfServiceView profile={profile} />
}

// ---------- Sponsors / Catechumens: mark own absence ----------

function SelfServiceView({ profile }) {
  const [dates, setDates] = useState([])
  const [myRecords, setMyRecords] = useState({}) // important_date_id -> record
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [noteDrafts, setNoteDrafts] = useState({})

  const load = async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: dateRows, error: dateErr }, { data: attRows, error: attErr }] = await Promise.all([
      supabase.from('important_dates').select('*').gte('event_date', today).order('event_date'),
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
      <div className="page-header">
        <div>
          <h1>Attendance</h1>
          <p className="subtitle">Let Core Team know if you'll be away for an upcoming session</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <p>Loading…</p>
      ) : dates.length === 0 ? (
        <div className="empty-state card">
          <h3>No upcoming dates</h3>
          <p>Once Core Team schedules a session, you can mark your attendance here.</p>
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

// ---------- Admin / Core Team: roll-up view ----------

function ManagerView() {
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [people, setPeople] = useState([])
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDates = async () => {
      const { data, error } = await supabase.from('important_dates').select('*').order('event_date', { ascending: false })
      if (error) setError(error.message)
      else {
        setDates(data)
        if (data.length > 0) setSelectedDate(data[0].id)
      }
      setLoading(false)
    }
    loadDates()
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    const loadRollup = async () => {
      const [{ data: peopleRows, error: pErr }, { data: attRows, error: aErr }] = await Promise.all([
        supabase.from('profiles').select('*').in('role', ['sponsor', 'catechumen']).order('full_name'),
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Attendance</h1>
          <p className="subtitle">Track who's marked themselves absent for each session</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <p>Loading…</p>
      ) : dates.length === 0 ? (
        <div className="empty-state card">
          <h3>No dates yet</h3>
          <p>Add an important date first, then attendance can be tracked against it.</p>
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
                    <td><span className={`role-badge role-${p.role}`}>{p.role === 'sponsor' ? 'Sponsor' : 'Catechumen'}</span></td>
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
