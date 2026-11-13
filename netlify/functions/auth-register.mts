import { authRequest, json, methodNotAllowed } from './_lib/supabase.mts'
export default async (request: Request) => {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  try {
    const b = await request.json() as { email?: string; password?: string; displayName?: string }
    const email = b.email?.trim().toLowerCase(), password = b.password, name = b.displayName?.trim()
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid_email' }, 400)
    if (!password || password.length < 8 || password.length > 128) return json({ error: 'password_must_be_8_to_128_characters' }, 400)
    if (name && (name.length < 1 || name.length > 32)) return json({ error: 'invalid_display_name' }, 400)
    const r = await authRequest('signup', { email, password, data: name ? { display_name: name } : {} })
    const data = await r.json().catch(() => ({}))
    return r.ok ? json({ user: data.user ?? null, session: data.session ?? null, confirmationRequired: !data.session }) : json({ error: 'registration_failed' }, r.status)
  } catch (e) {
    const config = e instanceof Error && e.message === 'server_not_configured'
    return json({ error: config ? 'server_not_configured' : 'invalid_request' }, config ? 503 : 400)
  }
}