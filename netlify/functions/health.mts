import { adminRequest, authServiceAvailable, json } from './_lib/supabase.mts'

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
  const ready = database && leaderboard
  return json({
    service: 'garriverse-api',
    status: ready ? 'ready' : 'degraded',
    capabilities: {
      authentication: authentication ? 'connected' : 'unavailable',
      database: database ? 'connected' : 'unavailable_or_migrations_missing',
      leaderboard: leaderboard ? 'connected' : 'unavailable_or_migrations_missing',
      cloudGameplay: ready ? 'schema_connected_rpc_not_exercised' : 'not_ready',
      realTokenRewards: 'disabled',
    },
    timestamp: new Date().toISOString(),
  }, ready ? 200 : 503)
}
