import { authRequest, json, methodNotAllowed } from './_lib/supabase.mts'

interface RefreshResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  expires_at?: number
  token_type?: string
  user?: { id?: string; email?: string | null }
}

export default async (request: Request) => {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  try {
    const body = await request.json() as { refreshToken?: string }
    const refreshToken = body.refreshToken
    if (typeof refreshToken !== 'string' || refreshToken.length < 16 || refreshToken.length > 8192) {
      return json({ error: 'invalid_refresh_token' }, 400)
    }

    // Supabase Auth token exchange uses the public anon key, never the service-role key.
    const response = await authRequest('token?grant_type=refresh_token', { refresh_token: refreshToken })
    const data = await response.json().catch(() => null) as RefreshResponse | null
    if (!response.ok) {
      return json(
        { error: response.status === 400 || response.status === 401 ? 'session_refresh_failed' : 'authentication_service_unavailable' },
        response.status === 400 || response.status === 401 ? 401 : 503,
      )
    }

    const now = Math.floor(Date.now() / 1000)
    const expiresAt = typeof data?.expires_at === 'number'
      ? data.expires_at
      : typeof data?.expires_in === 'number' ? now + data.expires_in : 0
    if (
      typeof data?.access_token !== 'string' || data.access_token.length < 16 ||
      typeof data.refresh_token !== 'string' || data.refresh_token.length < 16 ||
      typeof data.user?.id !== 'string' || data.user.id.length < 1 ||
      !Number.isSafeInteger(expiresAt) || expiresAt <= now
    ) {
      return json({ error: 'invalid_refresh_response' }, 502)
    }

    return json({
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        token_type: data.token_type || 'bearer',
        user: { id: data.user.id, email: data.user.email ?? null },
      },
    })
  } catch (error) {
    const config = error instanceof Error && error.message === 'server_not_configured'
    return json({ error: config ? 'server_not_configured' : 'invalid_request' }, config ? 503 : 400)
  }
}
