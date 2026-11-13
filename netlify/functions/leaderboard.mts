import { adminRequest, json, methodNotAllowed } from './_lib/supabase.mts'
export default async (request: Request) => {
  if (request.method !== 'GET') return methodNotAllowed('GET')
  const n = Number(new URL(request.url).searchParams.get('limit') || 20)
  const limit = Number.isFinite(n) ? Math.min(50, Math.max(1, Math.floor(n))) : 20
  try {
    const r = await adminRequest('player_leaderboard?select=user_id,display_name,xp,level,rank&order=rank.asc&limit=' + limit)
    if (!r.ok) return json({ error: 'leaderboard_unavailable' }, 502)
    return json({ players: await r.json() })
  } catch (e) {
    return json({ error: e instanceof Error && e.message === 'server_not_configured' ? 'server_not_configured' : 'backend_unavailable' }, 503)
  }
}