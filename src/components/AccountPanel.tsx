import { FormEvent, useEffect, useState } from 'react'
import { getSession, signIn, signOut, signUp, verifySession } from '../lib/auth'

export default function AccountPanel() {
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(getSession()?.user ?? null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { let active = true; verifySession().then(value => { if (active) setUser(value) }); return () => { active = false } }, [])
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (mode === 'login') {
        const session = await signIn(email, password); setUser(session.user); setMessage('You are signed in. Your account is ready.')
      } else {
        const result = await signUp(email, password, displayName)
        if (result.session) { setUser(result.session.user); setMessage('Account created. You are signed in.') }
        else setMessage('Account created. Check your email to confirm, then sign in here.')
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not complete account request.') }
    finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true)
    try { await signOut(); setUser(null); setMessage('You have signed out.') }
    catch { setUser(null); setMessage('Signed out on this device.') }
    finally { setBusy(false) }
  }
  return (
    <section className="account-card" id="farmer-account">
      <div className="account-copy">
        <p className="eyebrow">Farmer account</p>
        <h2>{user ? 'Welcome back, farmer' : 'Create your farmer account'}</h2>
        <p className="muted">Create an email account or sign in to use server-backed farming and save your progress. Google and X sign-in are not connected yet.</p>
      </div>
      {user ? (
        <div className="account-signed">
          <strong>{user.email || 'Signed-in farmer'}</strong>
          <span className="muted">Account verified with Supabase Auth</span>
          <button className="btn btn-ghost" disabled={busy} onClick={logout}>{busy ? 'Please wait…' : 'Sign out'}</button>
        </div>
      ) : (
        <form className="account-form" onSubmit={submit}>
          <div className="account-tabs">
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setMessage('') }}>Create account</button>
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setMessage('') }}>Sign in</button>
          </div>
          {mode === 'register' && <label>Farmer name<input value={displayName} onChange={e => setDisplayName(e.target.value)} minLength={1} maxLength={32} placeholder="Your display name" /></label>}
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create farmer account'}</button>
        </form>
      )}
      {message && <p className="account-message" role="status">{message}</p>}
    </section>
  )
}
