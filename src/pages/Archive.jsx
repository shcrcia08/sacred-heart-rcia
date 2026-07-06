import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Archive() {
  const [cycles, setCycles] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('cycles')
        .select('*')
        .eq('is_current', false)
        .order('created_at', { ascending: false })
      if (error) setError(error.message)
      else setCycles(data)
      setLoading(false)
    }
    load()
  }, [])

  const viewCycle = async (id) => {
    setSelectedId(id)
    setLoadingDetail(true)
    const [{ data: a }, { data: s }] = await Promise.all([
      supabase.from('announcements').select('*, profiles:created_by(full_name)').eq('cycle_id', id).order('created_at', { ascending: false }),
      supabase.from('schedules').select('*, profiles:uploaded_by(full_name)').eq('cycle_id', id).order('created_at', { ascending: false }),
    ])
    setAnnouncements(a ?? [])
    setSchedules(s ?? [])
    setLoadingDetail(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Archive</h1>
          <p className="subtitle">Announcements and schedules from past RCIA cycles</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <p>Loading…</p>
      ) : cycles.length === 0 ? (
        <div className="empty-state card">
          <h3>No archived cycles yet</h3>
          <p>When Admin starts a new cycle, the previous one's announcements and schedules will appear here.</p>
        </div>
      ) : (
        <>
          <div className="card">
            <label>Select a past cycle</label>
            <select value={selectedId ?? ''} onChange={(e) => viewCycle(e.target.value)}>
              <option value="" disabled>Choose a cycle…</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {selectedId && (
            loadingDetail ? <p>Loading…</p> : (
              <>
                <div className="divider-heart">Announcements</div>
                {announcements.length === 0 ? (
                  <p style={{ color: 'var(--ink-soft)' }}>No announcements in this cycle.</p>
                ) : (
                  announcements.map((item) => (
                    <div className="card" key={item.id}>
                      <h3 style={{ marginBottom: 4 }}>{item.title}</h3>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{item.body}</p>
                      {item.attachment_url && (
                        <a className="btn secondary small" href={item.attachment_url} target="_blank" rel="noreferrer">
                          📎 {item.attachment_name ?? 'Attachment'}
                        </a>
                      )}
                      <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: 8, marginBottom: 0 }}>
                        {new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        {item.profiles?.full_name ? ` · ${item.profiles.full_name}` : ''}
                      </p>
                    </div>
                  ))
                )}

                <div className="divider-heart">Schedules</div>
                {schedules.length === 0 ? (
                  <p style={{ color: 'var(--ink-soft)' }}>No schedule PDFs in this cycle.</p>
                ) : (
                  schedules.map((item) => (
                    <div className="card" key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <h3 style={{ marginBottom: 4 }}>{item.title}</h3>
                        <span style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
                          {new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <a className="btn gold small" href={item.file_url} target="_blank" rel="noreferrer">View / Download PDF</a>
                    </div>
                  ))
                )}
              </>
            )
          )}
        </>
      )}
    </div>
  )
}
