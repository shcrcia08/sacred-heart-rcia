import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

function buildWhatsAppLink(item) {
  const dateStr = new Date(item.event_date).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const message =
    `📅 *Sacred Heart RCIA — Save the Date*\n\n` +
    `*${item.title}*\n${dateStr}${item.location ? `\n📍 ${item.location}` : ''}\n\n` +
    `${item.description ?? ''}\n\n` +
    `View this and other dates anytime, no login needed:\n${window.location.origin}/dates`
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

export default function ImportantDates() {
  const { profile, role } = useAuth()
  const canManage = role === 'admin' || role === 'core_team'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', event_date: '', location: '', description: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('important_dates')
      .select('*')
      .order('event_date', { ascending: true })
    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('important_dates').insert({
      ...form,
      created_by: profile.id,
    })
    if (error) {
      setError(error.message)
    } else {
      setForm({ title: '', event_date: '', location: '', description: '' })
      setShowForm(false)
      load()
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this date?')) return
    const { error } = await supabase.from('important_dates').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const isPast = (d) => new Date(d) < new Date(new Date().toDateString())

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Important Dates</h1>
          <p className="subtitle">RCIA sessions, rites, and key milestones</p>
        </div>
        {canManage && (
          <button className="btn" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : '+ New Date'}
          </button>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {showForm && (
        <form className="card" onSubmit={handleCreate}>
          <label>Title</label>
          <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="field-row">
            <div>
              <label>Date</label>
              <input type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div>
              <label>Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
          <label>Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          <button className="btn gold" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add Date'}
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty-state card">
          <h3>No dates scheduled</h3>
          <p>Sessions and milestones added by Core Team will appear here.</p>
        </div>
      ) : (
        items.map((item) => (
          <div className="card" key={item.id} style={{ opacity: isPast(item.event_date) ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3 style={{ marginBottom: 4 }}>{item.title}</h3>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--wine)' }}>
                {new Date(item.event_date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            {item.location && <p style={{ margin: '4px 0', color: 'var(--ink-soft)' }}>📍 {item.location}</p>}
            {item.description && <p style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>}
            {canManage && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <a className="btn whatsapp small" href={buildWhatsAppLink(item)} target="_blank" rel="noreferrer">
                  Share to WhatsApp
                </a>
                <button className="btn danger small" onClick={() => handleDelete(item.id)}>Delete</button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
