import { adminAuthUpdate, adminPatch, adminPost, json, methodNotAllowed } from './_lib/supabase.mts'
import { hasRole, requireStaff } from './_lib/moderation.mts'

type ActionBody = {
  action?: string
  reportId?: string
  targetUserId?: string
  reason?: string
  suspensionHours?: number
}

export default async (request: Request) => {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  try {
    const staff = await requireStaff(request)
    if ('response' in staff) return staff.response
    const body = await request.json() as ActionBody
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 3 || reason.length > 1000) return json({ error: 'reason_required' }, 400)

    if (body.action === 'review_report' || body.action === 'resolve_report' || body.action === 'dismiss_report') {
      if (!hasRole(staff.roles, 'admin', 'moderator')) return json({ error: 'insufficient_role' }, 403)
      if (!body.reportId || !/^[0-9a-f-]{36}$/i.test(body.reportId)) return json({ error: 'invalid_report_id' }, 400)
      const status = body.action === 'review_report' ? 'in_review' : body.action === 'resolve_report' ? 'resolved' : 'dismissed'
      const update = await adminPatch('moderation_reports?id=eq.' + encodeURIComponent(body.reportId), {
        status, assigned_to: staff.user.id,
      })
      if (!update.ok) return json({ error: 'report_update_failed' }, 502)
      const audit = await adminPost('moderation_actions', {
        actor_user_id: staff.user.id,
        report_id: body.reportId,
        action: body.action === 'review_report' ? 'report_reviewed' : body.action === 'resolve_report' ? 'report_resolved' : 'report_dismissed',
        reason,
      })
      if (!audit.ok) return json({ error: 'audit_write_failed' }, 502)
      return json({ ok: true, status })
    }

    if (body.action === 'suspend_player' || body.action === 'unsuspend_player') {
      if (!hasRole(staff.roles, 'admin')) return json({ error: 'admin_role_required' }, 403)
      if (!body.targetUserId || !/^[0-9a-f-]{36}$/i.test(body.targetUserId)) return json({ error: 'invalid_target_user' }, 400)
      if (body.targetUserId === staff.user.id) return json({ error: 'cannot_moderate_self' }, 400)
      const hours = Math.max(1, Math.min(24 * 30, Number(body.suspensionHours) || 24))
      const until = body.action === 'suspend_player' ? new Date(Date.now() + hours * 3600_000).toISOString() : null
      const authUpdate = await adminAuthUpdate(body.targetUserId, {
        ban_duration: until ? hours + 'h' : 'none',
      })
      if (!authUpdate.ok) return json({ error: 'auth_suspension_failed' }, 502)
      const stateUpdate = await adminPatch('player_moderation_state?user_id=eq.' + encodeURIComponent(body.targetUserId), {
        suspended_until: until, reason: until ? reason : null, updated_by: staff.user.id,
      })
      if (!stateUpdate.ok) return json({ error: 'moderation_state_write_failed' }, 502)
      const audit = await adminPost('moderation_actions', {
        actor_user_id: staff.user.id,
        target_user_id: body.targetUserId,
        action: until ? 'player_suspended' : 'player_unsuspended',
        reason,
        metadata: { suspension_hours: until ? hours : 0, suspended_until: until },
      })
      if (!audit.ok) return json({ error: 'audit_write_failed' }, 502)
      return json({ ok: true, suspendedUntil: until })
    }

    return json({ error: 'unsupported_action' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error && error.message === 'server_not_configured' ? 'server_not_configured' : 'moderator_action_failed' }, 503)
  }
}
