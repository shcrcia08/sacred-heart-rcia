import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentCycle } from '../hooks/useCurrentCycle'

export default function Login() {
  const { cycle } = useCurrentCycle()
  const [mode, setMode] = useState('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
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

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setError(error.message)
    else setNotice('Check your email for a link to reset your password.')
    setBusy(false)
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    // full_name and role are passed as user metadata. A database trigger
    // (see supabase/schema.sql) reads this metadata and creates the matching
    // row in `profiles` automatically — this works whether or not email
    // confirmation is required, since it runs server-side on signup.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
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
          <span className="ministry" style={{ display: 'block', marginTop: 10 }}>
            RCIA Ministry Portal{cycle ? ` · ${cycle.label}` : ''}
          </span>
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
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(''); setNotice('') }}
                style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        ) : mode === 'forgot' ? (
          <form onSubmit={handleForgotPassword}>
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="hint">We'll email you a link to set a new password.</div>
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? 'Sending…' : 'Send Reset Link'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setNotice('') }}
                style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ← Back to Sign In
              </button>
            </div>
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
