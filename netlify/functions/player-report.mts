import { adminPost, json, methodNotAllowed, readBearer, verifyUser } from './_lib/supabase.mts'

export default async (request: Request) => {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  const token = readBearer(request)
  if (!token) return json({ error: 'missing_bearer_token' }, 401)
  try {
    const auth = await verifyUser(token)
    if ('error' in auth) return json({ error: auth.error }, auth.error === 'server_not_configured' ? 503 : 401)
    const body = await request.json() as { targetUserId?: string; category?: string; details?: string }
    const category = body.category
    const details = typeof body.details === 'string' ? body.details.trim() : ''
    const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : null
    if (!['abuse', 'cheating', 'impersonation', 'scam', 'other'].includes(category || '') || details.length < 10 || details.length > 2000) {
      return json({ error: 'invalid_report' }, 400)
    }
    if (targetUserId && !/^[0-9a-f-]{36}$/i.test(targetUserId)) return json({ error: 'invalid_target_user' }, 400)
    const response = await adminPost('moderation_reports', {
      reporter_user_id: auth.user.id,
      target_user_id: targetUserId,
      category,
      details,
    })
    if (!response.ok) return json({ error: 'report_submission_failed' }, 502)
    const rows = await response.json() as Array<{ id: string; status: string; created_at: string }>
    return json({ report: rows[0] ?? null }, 201)
  } catch (error) {
    return json({ error: error instanceof Error && error.message === 'server_not_configured' ? 'server_not_configured' : 'report_service_unavailable' }, 503)
  }
}
