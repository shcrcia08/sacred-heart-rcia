import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

function buildWhatsAppLink(title, body) {
  const message =
    `📢 *Sacred Heart RCIA — Announcement*\n\n` +
    `*${title}*\n\n${body}\n\n` +
    `View this and other updates anytime, no login needed:\n${window.location.origin}`
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

export default function Announcements() {
  const { profile, role } = useAuth()
  const canPost = role === 'admin' || role === 'core_team'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('announcements')
      .select('*, profiles:created_by(full_name)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('announcements').insert({
      title,
      body,
      created_by: profile.id,
    })
    if (error) {
      setError(error.message)
    } else {
      setTitle('')
      setBody('')
      setShowForm(false)
      load()
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this announcement?')) return
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Announcements</h1>
          <p className="subtitle">News and updates for the RCIA community</p>
        </div>
        {canPost && (
          <button className="btn" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : '+ New Announcement'}
          </button>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {showForm && (
        <form className="card" onSubmit={handleCreate}>
          <label>Title</label>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <label>Message</label>
          <textarea required value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          <button className="btn gold" type="submit" disabled={saving}>
            {saving ? 'Posting…' : 'Post Announcement'}
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty-state card">
          <h3>No announcements yet</h3>
          <p>When Core Team posts an update, it will appear here.</p>
        </div>
      ) : (
        items.map((item) => (
          <div className="card" key={item.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3 style={{ marginBottom: 4 }}>{item.title}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                {new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{item.body}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
                Posted by {item.profiles?.full_name ?? 'Core Team'}
              </span>
              {canPost && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    className="btn whatsapp small"
                    href={buildWhatsAppLink(item.title, item.body)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Share to WhatsApp
                  </a>
                  <button className="btn danger small" onClick={() => handleDelete(item.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
