import { adminRequest, json, methodNotAllowed, readBearer, verifyUser } from './_lib/supabase.mts'
export default async (request: Request) => {
  if (request.method !== 'GET') return methodNotAllowed('GET')
  const token = readBearer(request)
  if (!token) return json({ error: 'missing_bearer_token' }, 401)
  try {
    const auth = await verifyUser(token)
    if ('error' in auth) return json({ error: auth.error }, auth.error === 'server_not_configured' ? 503 : 401)
    const query = 'player_game_states?user_id=eq.' + encodeURIComponent(auth.user.id) + '&select=schema_version,state,revision,updated_at&limit=1'
    const r = await adminRequest(query)
    if (!r.ok) return json({ error: 'state_read_failed' }, 502)
    const rows = await r.json() as unknown[]
    return json({ state: rows[0] ?? null })
  } catch (e) {
    return json({ error: e instanceof Error && e.message === 'server_not_configured' ? 'server_not_configured' : 'backend_unavailable' }, 503)
  }
}