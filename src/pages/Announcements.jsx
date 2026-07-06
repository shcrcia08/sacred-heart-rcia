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
  const [file, setFile] = useState(null)
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

    let attachment_url = null
    let attachment_name = null
    let attachment_type = null

    if (file) {
      const filePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
      const { error: uploadError } = await supabase.storage.from('announcements').upload(filePath, file)
      if (uploadError) {
        setError(uploadError.message)
        setSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from('announcements').getPublicUrl(filePath)
      attachment_url = urlData.publicUrl
      attachment_name = file.name
      attachment_type = file.type
    }

    const { error } = await supabase.from('announcements').insert({
      title,
      body,
      attachment_url,
      attachment_name,
      attachment_type,
      created_by: profile.id,
    })
    if (error) {
      setError(error.message)
    } else {
      setTitle('')
      setBody('')
      setFile(null)
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
          <label>Attach a picture or document (optional)</label>
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xlsx,.pptx"
            onChange={(e) => setFile(e.target.files[0] ?? null)}
          />
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

            {item.attachment_url && (
              <div style={{ margin: '10px 0' }}>
                {item.attachment_type?.startsWith('image/') ? (
                  <a href={item.attachment_url} target="_blank" rel="noreferrer">
                    <img
                      src={item.attachment_url}
                      alt={item.attachment_name ?? 'Attachment'}
                      style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8, border: '1px solid var(--line)' }}
                    />
                  </a>
                ) : (
                  <a className="btn secondary small" href={item.attachment_url} target="_blank" rel="noreferrer">
                    📎 {item.attachment_name ?? 'Download attachment'}
                  </a>
                )}
              </div>
            )}

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
