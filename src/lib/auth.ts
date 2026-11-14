export interface GarriUser { id: string; email: string | null }
export interface GarriSession {
  access_token: string
  refresh_token?: string
  expires_at?: number
  expires_in?: number
  token_type?: string
  user: GarriUser
}
const SESSION_KEY = 'garriverse.auth.session.v1'

function readStoredSession(): GarriSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as GarriSession
    if (!session.access_token || !session.user?.id) return null
    return session
  } catch { return null }
}

export function getSession(): GarriSession | null {
  const session = readStoredSession()
  if (session?.expires_at && session.expires_at * 1000 <= Date.now()) return null
  return session
}

export function hasStoredSession() {
  return readStoredSession() !== null
}

function normalizeSession(session: GarriSession): GarriSession {
  const expiresAt = session.expires_at ??
    (typeof session.expires_in === 'number' ? Math.floor(Date.now() / 1000) + session.expires_in : undefined)
  return expiresAt === undefined ? session : { ...session, expires_at: expiresAt }
}

function saveSession(session: GarriSession | null) {
  if (session?.access_token) localStorage.setItem(SESSION_KEY, JSON.stringify(normalizeSession(session)))
  else localStorage.removeItem(SESSION_KEY)
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(name: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch('/.netlify/functions/' + name, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(data.error || 'Request failed', response.status)
  return data as T
}

let refreshInFlight: Promise<GarriSession> | null = null

/** Refresh the Supabase token pair shortly before the access token expires. */
export async function getValidSession(): Promise<GarriSession | null> {
  const stored = readStoredSession()
  if (!stored) return null

  const shouldRefresh = Boolean(stored.refresh_token) &&
    (!stored.expires_at || stored.expires_at * 1000 <= Date.now() + 60_000)

  if (!shouldRefresh) {
    if (stored.expires_at && stored.expires_at * 1000 <= Date.now()) {
      saveSession(null)
      return null
    }
    return stored
  }

  if (!refreshInFlight) {
    const pending = (async () => {
      const data = await request<{ session: GarriSession }>('auth-refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: stored.refresh_token }),
      })
      const next = normalizeSession(data.session)
      if (!next.access_token || !next.refresh_token || !next.user?.id || next.user.id !== stored.user.id) {
        throw new ApiError('session_refresh_failed', 401)
      }
      saveSession(next)
      return next
    })()
    refreshInFlight = pending
  }

  const pending = refreshInFlight
  try {
    return await pending
  } catch (error) {
    if (error instanceof ApiError && (error.status === 400 || error.status === 401)) saveSession(null)
    throw error
  } finally {
    if (refreshInFlight === pending) refreshInFlight = null
  }
}

export async function signIn(email: string, password: string) {
  const data = await request<{ session: GarriSession }>('auth-login', { method: 'POST', body: JSON.stringify({ email, password }) })
  const session = normalizeSession(data.session)
  saveSession(session)
  return session
}

export async function signUp(email: string, password: string, displayName: string) {
  const data = await request<{ session: GarriSession | null; confirmationRequired: boolean }>('auth-register', {
    method: 'POST', body: JSON.stringify({ email, password, displayName }),
  })
  if (data.session) saveSession(normalizeSession(data.session))
  return data
}

export async function signOut() {
  const session = readStoredSession()
  try {
    if (session) await request('auth-logout', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token } })
  } finally { saveSession(null) }
}

export async function verifySession() {
  try {
    const session = await getValidSession()
    if (!session) return null
    const data = await request<{ user: GarriUser }>('auth-me', { headers: { Authorization: 'Bearer ' + session.access_token } })
    return data.user
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) saveSession(null)
    return readStoredSession()?.user ?? null
  }
}

export async function fetchLeaderboard() {
  return request<{ players: Array<{ user_id: string; display_name: string; xp: number; level: number; rank: number }> }>('leaderboard?limit=10')
}

export interface CloudGameState {
  schema_version: number
  state: Record<string, unknown>
  revision: number
  updated_at: string
}

export async function fetchGameState() {
  const session = await getValidSession()
  if (!session) throw new Error('sign_in_required')
  return request<{ state: CloudGameState | null }>('game-state', {
    headers: { Authorization: 'Bearer ' + session.access_token },
  })
}

export async function submitFarmingAction(action: 'till' | 'plant' | 'water' | 'weed' | 'harvest' | 'refill_can', plotId: number, expectedRevision: number, idempotencyKey: string = crypto.randomUUID()) {
  const session = await getValidSession()
  if (!session) throw new Error('sign_in_required')
  return request<{ state: Record<string, unknown>; revision: number; xp_gain: number; level: number; duplicate: boolean }>('farming-action', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ action, ...(action === 'refill_can' ? {} : { plotId }), idempotencyKey, expectedRevision }),
  })
}

export type EconomyAction =
  | 'factory_start'
  | 'factory_run_stage'
  | 'factory_complete_stage'
  | 'warehouse_deposit'
  | 'market_sell'
  | 'market_buy_stems'

export async function submitEconomyAction(action: EconomyAction, expectedRevision: number, idempotencyKey: string = crypto.randomUUID()) {
  const session = await getValidSession()
  if (!session) throw new Error('sign_in_required')
  return request<{ state: Record<string, unknown>; revision: number; xp_gain: number; level: number; duplicate: boolean }>('economy-action', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ action, idempotencyKey, expectedRevision }),
  })
}

export type UtilityAction = 'water_tanker' | 'refill_tanker'

export async function submitUtilityAction(action: UtilityAction, plotId: number, expectedRevision: number, idempotencyKey: string = crypto.randomUUID()) {
  const session = await getValidSession()
  if (!session) throw new Error('sign_in_required')
  return request<{ state: Record<string, unknown>; revision: number; xp_gain: number; level: number; duplicate: boolean }>('utility-action', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ action, ...(action === 'water_tanker' ? { plotId } : {}), idempotencyKey, expectedRevision }),
  })
}

export interface BackendHealth {
  status: 'ready' | 'degraded' | 'not_configured'
  capabilities: { authentication: string; database: string; leaderboard: string; cloudGameplay: string; quests: string; realTokenRewards: 'disabled' }
}
export async function fetchBackendHealth() { return request<BackendHealth>('health') }

export interface QuestProgress {
  id: string
  title: string
  cadence: 'daily' | 'weekly' | 'special'
  periodKey: string
  progress: number
  target: number
  reward: { xp: number; stems?: number }
  claimed: boolean
}
export async function fetchQuests() {
  const session = await getValidSession()
  if (!session) throw new Error('sign_in_required')
  return request<{ revision: number; quests: QuestProgress[] }>('quests', {
    headers: { Authorization: 'Bearer ' + session.access_token },
  })
}

export async function claimQuest(questId: string, periodKey: string, expectedRevision: number, idempotencyKey: string = crypto.randomUUID()) {
  const session = await getValidSession()
  if (!session) throw new Error('sign_in_required')
  return request<{ state: Record<string, unknown>; revision: number; reward: { xp: number; stems: number }; duplicate: boolean }>('quest-claim', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ questId, periodKey, expectedRevision, idempotencyKey }),
  })
}
