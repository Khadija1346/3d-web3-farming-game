import { json, methodNotAllowed, readBearer, supabaseConfig } from './_lib/supabase.mts'
export default async (request: Request) => {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  const token = readBearer(request), c = supabaseConfig()
  if (!token) return json({ error: 'missing_bearer_token' }, 401)
  if (!c) return json({ error: 'server_not_configured' }, 503)
  try {
    const r = await fetch(c.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: c.anonKey, Authorization: 'Bearer ' + token } })
    return r.ok ? json({ loggedOut: true }) : json({ error: 'logout_failed' }, r.status)
  } catch { return json({ error: 'authentication_service_unavailable' }, 503) }
}