import { adminPost, adminRequest, authServiceAvailable, json } from './_lib/supabase.mts'

async function rpcExists(path: string, body: unknown) {
  try {
    const response = await adminPost(path, body)
    const data = await response.json().catch(() => ({}))
    return response.status === 400 && data.message === 'invalid_action'
  } catch { return false }
}

export default async (_request: Request) => {
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!configured) {
    return json({
      service: 'garriverse-api',
      status: 'not_configured',
      capabilities: { authentication: 'not_configured', database: 'not_configured', cloudGameplay: 'not_configured', realTokenRewards: 'disabled' },
      timestamp: new Date().toISOString(),
    }, 503)
  }

  const [authentication, database, leaderboard] = await Promise.all([
    authServiceAvailable(),
    adminRequest('player_game_states?select=user_id&limit=0').then(r => r.ok).catch(() => false),
    adminRequest('player_leaderboard?select=user_id&limit=0').then(r => r.ok).catch(() => false),
  ])
  const [farmingRpc, economyRpc, utilityRpc] = await Promise.all([
    rpcExists('rpc/apply_garriverse_action', { p_user_id: null, p_action_type: null, p_plot_id: null, p_idempotency_key: null, p_expected_revision: null }),
    rpcExists('rpc/apply_garriverse_economy_action', { p_user_id: null, p_action_type: null, p_idempotency_key: null, p_expected_revision: null }),
    rpcExists('rpc/apply_garriverse_utility_action', { p_user_id: null, p_action_type: null, p_plot_id: null, p_idempotency_key: null, p_expected_revision: null }),
  ])
  const cloudGameplay = farmingRpc && economyRpc && utilityRpc
  const ready = authentication && database && leaderboard && cloudGameplay
  return json({
    service: 'garriverse-api',
    status: ready ? 'ready' : 'degraded',
    capabilities: {
      authentication: authentication ? 'connected' : 'unavailable',
      database: database ? 'connected' : 'unavailable_or_migrations_missing',
      leaderboard: leaderboard ? 'connected' : 'unavailable_or_migrations_missing',
      cloudGameplay: cloudGameplay ? 'rpc_functions_present' : 'not_ready',
      realTokenRewards: 'disabled',
    },
    timestamp: new Date().toISOString(),
  }, ready ? 200 : 503)
}
