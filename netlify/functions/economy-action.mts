import { adminPost, json, methodNotAllowed, readBearer, verifyUser } from './_lib/supabase.mts'

const allowed = new Set([
  'factory_start', 'factory_run_stage', 'factory_complete_stage',
  'warehouse_deposit', 'market_sell', 'market_buy_stems',
])

export default async (request: Request) => {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  const token = readBearer(request)
  if (!token) return json({ error: 'missing_bearer_token' }, 401)
  try {
    const auth = await verifyUser(token)
    if ('error' in auth) return json({ error: auth.error }, auth.error === 'server_not_configured' ? 503 : 401)
    const body = await request.json() as {
      action?: string
      idempotencyKey?: string
      expectedRevision?: number
    }
    if (!body.action || !allowed.has(body.action)) return json({ error: 'invalid_action' }, 400)
    if (typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 128) {
      return json({ error: 'invalid_idempotency_key' }, 400)
    }
    if (body.expectedRevision === undefined || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
      return json({ error: 'invalid_revision' }, 400)
    }
    const r = await adminPost('rpc/apply_garriverse_economy_action', {
      p_user_id: auth.user.id,
      p_action_type: body.action,
      p_idempotency_key: body.idempotencyKey,
      p_expected_revision: body.expectedRevision ?? null,
    })
    const data = await r.json().catch(() => null)
    if (!r.ok) {
      const message = typeof data?.message === 'string' ? data.message : ''
      if (message === 'revision_conflict') return json({ error: message }, 409)
      const known = new Set([
        'invalid_action', 'invalid_idempotency_key', 'factory_already_running',
        'not_enough_roots', 'factory_batch_missing', 'factory_stage_running',
        'factory_stage_not_running', 'invalid_factory_stage', 'factory_stage_not_started',
        'factory_stage_not_ready', 'no_garri_to_store', 'no_garri_to_sell',
        'insufficient_game_currency',
      ])
      if (known.has(message)) return json({ error: message }, 409)
      return json({ error: 'economy_action_failed' }, 502)
    }
    return json(data)
  } catch (error) {
    const config = error instanceof Error && error.message === 'server_not_configured'
    return json({ error: config ? 'server_not_configured' : 'invalid_request' }, config ? 503 : 400)
  }
}
