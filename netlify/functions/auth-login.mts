import { authRequest, json, methodNotAllowed } from './_lib/supabase.mts'
export default async (request: Request) => {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  try {
    const b = await request.json() as { email?: string; password?: string }
    const email = b.email?.trim().toLowerCase()
    if (!email || !b.password || b.password.length > 128) return json({ error: 'invalid_credentials' }, 400)
    const r = await authRequest('token?grant_type=password', { email, password: b.password })
    const data = await r.json().catch(() => ({}))
    return r.ok ? json({ user: data.user, session: data }) : json({ error: 'login_failed', details: data }, r.status)
  } catch (e) {
    const config = e instanceof Error && e.message === 'server_not_configured'
    return json({ error: config ? 'server_not_configured' : 'invalid_request' }, config ? 503 : 400)
  }
}