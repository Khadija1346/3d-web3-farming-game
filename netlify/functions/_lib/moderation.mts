import { adminRequest, readBearer, verifyUser, json } from './supabase.mts'

export async function requireStaff(request: Request) {
  const token = readBearer(request)
  if (!token) return { response: json({ error: 'missing_bearer_token' }, 401) } as const
  const auth = await verifyUser(token)
  if ('error' in auth) return { response: json({ error: auth.error }, auth.error === 'server_not_configured' ? 503 : 401) } as const

  const result = await adminRequest(
    'staff_roles?user_id=eq.' + encodeURIComponent(auth.user.id) +
    '&active=eq.true&select=role&order=created_at.asc'
  )
  if (!result.ok) return { response: json({ error: 'moderator_roles_unavailable' }, 503) } as const
  const roles = await result.json() as Array<{ role: 'admin' | 'moderator' | 'support' }>
  if (!roles.length) return { response: json({ error: 'moderator_access_required' }, 403) } as const
  return { user: auth.user, roles: roles.map(item => item.role) } as const
}

export function hasRole(roles: string[], ...allowed: string[]) {
  return allowed.some(role => roles.includes(role))
}
