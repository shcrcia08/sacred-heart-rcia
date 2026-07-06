import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function PrayerBooklet() {
  const { profile, role } = useAuth()
  const canUpload = role === 'admin'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('prayer_booklets')
      .select('*, profiles:uploaded_by(full_name)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')

    const filePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`

    const { error: uploadError } = await supabase.storage.from('prayer-booklets').upload(filePath, file, {
      contentType: 'application/pdf',
    })
    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('prayer-booklets').getPublicUrl(filePath)

    const { error: insertError } = await supabase.from('prayer_booklets').insert({
      title: title || file.name,
      file_path: filePath,
      file_url: urlData.publicUrl,
      uploaded_by: profile.id,
    })
    if (insertError) {
      setError(insertError.message)
    } else {
      setTitle('')
      setFile(null)
      setShowForm(false)
      load()
    }
    setUploading(false)
  }

  const handleDelete = async (item) => {
    if (!confirm(`Remove "${item.title}"?`)) return
    await supabase.storage.from('prayer-booklets').remove([item.file_path])
    const { error } = await supabase.from('prayer_booklets').delete().eq('id', item.id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Prayer Booklet</h1>
          <p className="subtitle">Prayers and reflections for the RCIA journey</p>
        </div>
        {canUpload && (
          <button className="btn" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancel' : '+ Upload Booklet'}
          </button>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {showForm && (
        <form className="card" onSubmit={handleUpload}>
          <label>Title</label>
          <input
            type="text"
            placeholder="e.g. RCIA Prayer Booklet 2026/2027"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label>PDF file</label>
          <input
            type="file"
            accept="application/pdf"
            required
            onChange={(e) => setFile(e.target.files[0])}
          />
          <button className="btn gold" type="submit" disabled={uploading || !file}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty-state card">
          <h3>No prayer booklet uploaded yet</h3>
          <p>Once Admin uploads a booklet, it will appear here.</p>
        </div>
      ) : (
        <>
          {/* Current booklet — embedded inline */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>{items[0].title}</h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
                  Uploaded {new Date(items[0].created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {items[0].profiles?.full_name ? ` by ${items[0].profiles.full_name}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a className="btn secondary small" href={items[0].file_url} target="_blank" rel="noreferrer">
                  Open in New Tab
                </a>
                {canUpload && (
                  <button className="btn danger small" onClick={() => handleDelete(items[0])}>Delete</button>
                )}
              </div>
            </div>
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(items[0].file_url)}&embedded=true`}
              title={items[0].title}
              style={{ width: '100%', height: '75vh', border: '1px solid var(--line)', borderRadius: 8 }}
            />
            <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
              Not showing correctly? Use "Open in New Tab" instead.
            </p>
          </div>

          {/* Older versions */}
          {items.length > 1 && (
            <>
              <div className="divider-heart">Previous Versions</div>
              {items.slice(1).map((item) => (
                <div className="card" key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{item.title}</h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
                      Uploaded {new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {item.profiles?.full_name ? ` by ${item.profiles.full_name}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a className="btn gold small" href={item.file_url} target="_blank" rel="noreferrer">
                      View / Download PDF
                    </a>
                    {canUpload && (
                      <button className="btn danger small" onClick={() => handleDelete(item)}>Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
