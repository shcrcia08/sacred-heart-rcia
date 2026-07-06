import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function People() {
  const [sponsors, setSponsors] = useState([])
  const [catechumens, setCatechumens] = useState([])
  const [pairs, setPairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSponsor, setSelectedSponsor] = useState('')
  const [selectedCatechumen, setSelectedCatechumen] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const [{ data: profiles, error: pErr }, { data: pairRows, error: prErr }] = await Promise.all([
      supabase.from('profiles').select('*').in('role', ['sponsor', 'catechumen']).order('full_name'),
      supabase.from('sponsor_catechumen').select('*, sponsor:sponsor_id(full_name), catechumen:catechumen_id(full_name)'),
    ])
    if (pErr) setError(pErr.message)
    else {
      setSponsors(profiles.filter((p) => p.role === 'sponsor'))
      setCatechumens(profiles.filter((p) => p.role === 'catechumen'))
    }
    if (prErr) setError(prErr.message)
    else setPairs(pairRows)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handlePair = async (e) => {
    e.preventDefault()
    if (!selectedSponsor || !selectedCatechumen) return
    setSaving(true)
    setError('')
    const { error } = await supabase.from('sponsor_catechumen').insert({
      sponsor_id: selectedSponsor,
      catechumen_id: selectedCatechumen,
    })
    if (error) setError(error.message)
    else {
      setSelectedSponsor('')
      setSelectedCatechumen('')
      load()
    }
    setSaving(false)
  }

  const handleUnpair = async (id) => {
    if (!confirm('Remove this pairing?')) return
    const { error } = await supabase.from('sponsor_catechumen').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sponsors &amp; Catechumens</h1>
          <p className="subtitle">Directory and sponsor pairings</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="card">
        <h3>Pair a Sponsor with a Catechumen</h3>
        <form onSubmit={handlePair} className="field-row" style={{ alignItems: 'flex-end' }}>
          <div>
            <label>Sponsor</label>
            <select value={selectedSponsor} onChange={(e) => setSelectedSponsor(e.target.value)}>
              <option value="">Select sponsor…</option>
              {sponsors.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
          <div>
            <label>Catechumen</label>
            <select value={selectedCatechumen} onChange={(e) => setSelectedCatechumen(e.target.value)}>
              <option value="">Select catechumen…</option>
              {catechumens.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <button className="btn gold" type="submit" disabled={saving} style={{ marginBottom: 14 }}>
              {saving ? 'Pairing…' : 'Pair Up'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Current Pairings</h3>
        {loading ? <p>Loading…</p> : pairs.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)' }}>No pairings yet.</p>
        ) : (
          <table>
            <thead><tr><th>Sponsor</th><th>Catechumen</th><th></th></tr></thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={p.id}>
                  <td>{p.sponsor?.full_name}</td>
                  <td>{p.catechumen?.full_name}</td>
                  <td><button className="btn danger small" onClick={() => handleUnpair(p.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="divider-heart">Full Directory</div>

      <div className="card">
        <h3>Sponsors ({sponsors.length})</h3>
        <table>
          <thead><tr><th>Name</th><th>Phone</th></tr></thead>
          <tbody>
            {sponsors.map((s) => <tr key={s.id}><td>{s.full_name}</td><td>{s.phone}</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Catechumens ({catechumens.length})</h3>
        <table>
          <thead><tr><th>Name</th><th>Phone</th></tr></thead>
          <tbody>
            {catechumens.map((c) => <tr key={c.id}><td>{c.full_name}</td><td>{c.phone}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
