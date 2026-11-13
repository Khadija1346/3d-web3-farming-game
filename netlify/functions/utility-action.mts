import { adminPost, json, methodNotAllowed, readBearer, verifyUser } from './_lib/supabase.mts'

const allowed = new Set(['water_tanker', 'refill_tanker'])

export default async (request: Request) => {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  const token = readBearer(request)
  if (!token) return json({ error: 'missing_bearer_token' }, 401)
  try {
    const auth = await verifyUser(token)
    if ('error' in auth) return json({ error: auth.error }, auth.error === 'server_not_configured' ? 503 : 401)
    const body = await request.json() as { action?: string; plotId?: number; idempotencyKey?: string; expectedRevision?: number }
    if (!body.action || !allowed.has(body.action)) return json({ error: 'invalid_action' }, 400)
    if (typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 128) return json({ error: 'invalid_idempotency_key' }, 400)
    if (body.action === 'water_tanker' && (!Number.isInteger(body.plotId) || (body.plotId as number) < 0 || (body.plotId as number) > 11)) return json({ error: 'invalid_plot' }, 400)
    if (body.expectedRevision !== undefined && (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0)) return json({ error: 'invalid_revision' }, 400)
    const r = await adminPost('rpc/apply_garriverse_utility_action', {
      p_user_id: auth.user.id,
      p_action_type: body.action,
      p_plot_id: body.plotId ?? null,
      p_idempotency_key: body.idempotencyKey,
      p_expected_revision: body.expectedRevision ?? null,
    })
    const data = await r.json().catch(() => null)
    if (!r.ok) {
      const message = typeof data?.message === 'string' ? data.message : ''
      if (message === 'revision_conflict') return json({ error: message }, 409)
      const known = new Set(['invalid_action','invalid_idempotency_key','invalid_plot','player_state_not_initialized','plot_not_planted','plot_does_not_need_water','tanker_empty','tanker_full'])
      if (known.has(message)) return json({ error: message }, 409)
      return json({ error: 'utility_action_failed' }, 502)
    }
    return json(data)
  } catch (error) {
    const config = error instanceof Error && error.message === 'server_not_configured'
    return json({ error: config ? 'server_not_configured' : 'invalid_request' }, config ? 503 : 400)
  }
}
