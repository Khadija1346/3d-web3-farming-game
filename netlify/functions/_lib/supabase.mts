const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers })
}
export function methodNotAllowed(allowed: string) { return json({ error: 'method_not_allowed', allowed }, 405) }
export function readBearer(request: Request): string | null {
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}
function publicConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const anonKey = process.env.SUPABASE_ANON_KEY
  return url && anonKey ? { url, anonKey } : null
}
export function supabaseConfig() {
  const c = publicConfig(), serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return c && serviceKey ? { ...c, serviceKey } : null
}
export async function verifyUser(token: string) {
  const c = publicConfig()
  if (!c) return { error: 'server_not_configured' as const }
  const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.anonKey, Authorization: 'Bearer ' + token } })
  if (!r.ok) return { error: 'unauthorized' as const }
  const u = await r.json() as { id?: string; email?: string }
  return u.id ? { user: { id: u.id, email: u.email ?? null } } : { error: 'unauthorized' as const }
}
export async function adminRequest(path: string) {
  const c = supabaseConfig()
  if (!c) throw new Error('server_not_configured')
  return fetch(c.url + '/rest/v1/' + path, { headers: { apikey: c.serviceKey, Authorization: 'Bearer ' + c.serviceKey } })
}
export async function authRequest(path: string, body: unknown) {
  const c = publicConfig()
  if (!c) throw new Error('server_not_configured')
  return fetch(c.url + '/auth/v1/' + path, { method: 'POST', headers: { apikey: c.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}