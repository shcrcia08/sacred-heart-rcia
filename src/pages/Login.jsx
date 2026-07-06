import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('catechumen')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    // full_name, phone, and role are passed as user metadata. A database
    // trigger (see supabase/schema.sql) reads this metadata and creates the
    // matching row in `profiles` automatically — this works whether or not
    // email confirmation is required, since it runs server-side on signup.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, role } },
    })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    setNotice(
      'Account created. If email confirmation is required, check your inbox before signing in.'
    )
    setMode('signin')
    setBusy(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/church-logo-full.png" alt="Church of the Sacred Heart" style={{ maxWidth: 240, width: '100%' }} />
          <span className="ministry" style={{ display: 'block', marginTop: 10 }}>RCIA Ministry Portal</span>
        </div>

        <div className="login-toggle">
          <button
            type="button"
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => { setMode('signin'); setError(''); setNotice('') }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => { setMode('signup'); setError(''); setNotice('') }}
          >
            Register
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}
        {notice && <div className="success-msg">{notice}</div>}

        {mode === 'signin' ? (
          <form onSubmit={handleSignIn}>
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp}>
            <label>Full name</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <label>I am registering as a</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="catechumen">Catechumen</option>
              <option value="sponsor">Sponsor</option>
            </select>
            <div className="hint">Core Team and Admin accounts are set up by an administrator.</div>
            <label>WhatsApp phone number</label>
            <input type="tel" placeholder="+65 9123 4567" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label>Password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/" style={{ fontSize: '0.85rem' }}>← Back to Announcements</a>
        </div>
      </div>
    </div>
  )
}
