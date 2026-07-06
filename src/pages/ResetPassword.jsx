import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else setDone(true)
    setBusy(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/church-logo-full.png" alt="Church of the Sacred Heart" style={{ maxWidth: 240, width: '100%' }} />
          <span className="ministry" style={{ display: 'block', marginTop: 10 }}>Reset Your Password</span>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {done ? (
          <>
            <div className="success-msg">Your password has been updated.</div>
            <a className="btn" href="/login" style={{ width: '100%', justifyContent: 'center' }}>
              Go to Sign In
            </a>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>New password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            <label>Confirm new password</label>
            <input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? 'Saving…' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
