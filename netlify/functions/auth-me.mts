import { json, methodNotAllowed, readBearer, verifyUser } from './_lib/supabase.mts'
export default async (request: Request) => {
  if (request.method !== 'GET') return methodNotAllowed('GET')
  const token = readBearer(request)
  if (!token) return json({ error: 'missing_bearer_token' }, 401)
  try {
    const r = await verifyUser(token)
    if ('error' in r) return json({ error: r.error }, r.error === 'server_not_configured' ? 503 : 401)
    return json({ user: r.user })
  } catch { return json({ error: 'authentication_service_unavailable' }, 503) }
}