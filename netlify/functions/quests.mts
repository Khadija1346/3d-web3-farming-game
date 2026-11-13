import { adminPost, json, methodNotAllowed, readBearer, verifyUser } from './_lib/supabase.mts'

export default async (request: Request) => {
  if (request.method !== 'GET') return methodNotAllowed('GET')
  const token = readBearer(request)
  if (!token) return json({ error: 'missing_bearer_token' }, 401)
  try {
    const auth = await verifyUser(token)
    if ('error' in auth) return json({ error: auth.error }, auth.error === 'server_not_configured' ? 503 : 401)
    const response = await adminPost('rpc/get_garriverse_quests', { p_user_id: auth.user.id })
    const data = await response.json().catch(() => null)
    if (!response.ok) return json({ error: 'quests_unavailable' }, 502)
    return json(data)
  } catch (error) {
    const config = error instanceof Error && error.message === 'server_not_configured'
    return json({ error: config ? 'server_not_configured' : 'quests_unavailable' }, config ? 503 : 502)
  }
}
