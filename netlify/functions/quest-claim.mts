import { adminPost, json, methodNotAllowed, readBearer, verifyUser } from './_lib/supabase.mts'

export default async (request: Request) => {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  const token = readBearer(request)
  if (!token) return json({ error: 'missing_bearer_token' }, 401)
  try {
    const auth = await verifyUser(token)
    if ('error' in auth) return json({ error: auth.error }, auth.error === 'server_not_configured' ? 503 : 401)
    const body = await request.json() as { questId?: string; periodKey?: string; idempotencyKey?: string; expectedRevision?: number }
    if (typeof body.questId !== 'string' || typeof body.periodKey !== 'string') return json({ error: 'invalid_quest_claim' }, 400)
    if (typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 128) return json({ error: 'invalid_idempotency_key' }, 400)
    if (body.expectedRevision === undefined || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) return json({ error: 'invalid_revision' }, 400)
    const response = await adminPost('rpc/claim_garriverse_quest', {
      p_user_id: auth.user.id,
      p_quest_id: body.questId,
      p_period_key: body.periodKey,
      p_idempotency_key: body.idempotencyKey,
      p_expected_revision: body.expectedRevision ?? null,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const message = typeof data?.message === 'string' ? data.message : ''
      if (message === 'revision_conflict') return json({ error: message }, 409)
      const known = new Set(['invalid_quest_claim','invalid_idempotency_key','quest_period_expired','quest_not_complete','quest_already_claimed','unknown_quest'])
      if (known.has(message)) return json({ error: message }, 409)
      return json({ error: 'quest_claim_failed' }, 502)
    }
    return json(data)
  } catch (error) {
    const config = error instanceof Error && error.message === 'server_not_configured'
    return json({ error: config ? 'server_not_configured' : 'invalid_request' }, config ? 503 : 400)
  }
}
