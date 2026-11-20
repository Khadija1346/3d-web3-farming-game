import { adminRequest, json, methodNotAllowed } from './_lib/supabase.mts'
import { requireStaff } from './_lib/moderation.mts'

export default async (request: Request) => {
  if (request.method !== 'GET') return methodNotAllowed('GET')
  try {
    const staff = await requireStaff(request)
    if ('response' in staff) return staff.response

    const [reportsResponse, playersResponse, actionsResponse, stateResponse] = await Promise.all([
      adminRequest('moderation_reports?select=id,reporter_user_id,target_user_id,category,details,status,assigned_to,created_at,updated_at&order=created_at.desc&limit=100'),
      adminRequest('player_profiles?select=user_id,display_name,xp,level,created_at,updated_at&order=updated_at.desc&limit=100'),
      adminRequest('moderation_actions?select=id,actor_user_id,target_user_id,report_id,action,reason,created_at&order=created_at.desc&limit=30'),
      adminRequest('player_moderation_state?select=user_id,suspended_until,reason,updated_at&limit=100'),
    ])
    if (![reportsResponse, playersResponse, actionsResponse, stateResponse].every(r => r.ok)) {
      return json({ error: 'moderator_data_unavailable' }, 503)
    }
    const [reports, players, actions, suspensions] = await Promise.all([
      reportsResponse.json(), playersResponse.json(), actionsResponse.json(), stateResponse.json(),
    ]) as [unknown[], unknown[], unknown[], unknown[]]
    return json({
      staff: { userId: staff.user.id, roles: staff.roles },
      summary: {
        openReports: (reports as Array<{ status: string }>).filter(r => r.status === 'open').length,
        inReview: (reports as Array<{ status: string }>).filter(r => r.status === 'in_review').length,
        totalPlayers: players.length,
        recentActions: actions.length,
      },
      reports, players, actions, suspensions,
    })
  } catch (error) {
    return json({ error: error instanceof Error && error.message === 'server_not_configured' ? 'server_not_configured' : 'moderator_service_unavailable' }, 503)
  }
}
