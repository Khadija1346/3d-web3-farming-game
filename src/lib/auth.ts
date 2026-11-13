export interface GarriUser { id: string; email: string | null }
export interface GarriSession { access_token: string; refresh_token?: string; expires_at?: number; user: GarriUser }
const SESSION_KEY = 'garriverse.auth.session.v1'

export function getSession(): GarriSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as GarriSession
    if (!session.access_token || !session.user?.id) return null
    if (session.expires_at && session.expires_at * 1000 <= Date.now()) return null
    return session
  } catch { return null }
}
function saveSession(session: GarriSession | null) {
  if (session?.access_token) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}
async function request<T>(name: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch('/.netlify/functions/' + name, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data as T
}
export async function signIn(email: string, password: string) {
  const data = await request<{ session: GarriSession }>('auth-login', { method: 'POST', body: JSON.stringify({ email, password }) })
  saveSession(data.session)
  return data.session
}
export async function signUp(email: string, password: string, displayName: string) {
  const data = await request<{ session: GarriSession | null; confirmationRequired: boolean }>('auth-register', {
    method: 'POST', body: JSON.stringify({ email, password, displayName }),
  })
  if (data.session) saveSession(data.session)
  return data
}
export async function signOut() {
  const session = getSession()
  try {
    if (session) await request('auth-logout', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token } })
  } finally { saveSession(null) }
}
export async function verifySession() {
  const session = getSession()
  if (!session) return null
  try {
    const data = await request<{ user: GarriUser }>('auth-me', { headers: { Authorization: 'Bearer ' + session.access_token } })
    return data.user
  } catch {
    saveSession(null)
    return null
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
  const session = getSession()
  if (!session) throw new Error('sign_in_required')
  return request<{ state: CloudGameState | null }>('game-state', {
    headers: { Authorization: 'Bearer ' + session.access_token },
  })
}
export async function submitFarmingAction(action: 'till' | 'plant' | 'water' | 'weed' | 'harvest' | 'refill_can', plotId: number, expectedRevision: number, idempotencyKey: string = crypto.randomUUID()) {
  const session = getSession()
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
  const session = getSession()
  if (!session) throw new Error('sign_in_required')
  return request<{ state: Record<string, unknown>; revision: number; xp_gain: number; level: number; duplicate: boolean }>('economy-action', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ action, idempotencyKey, expectedRevision }),
  })
}

export type UtilityAction = 'water_tanker' | 'refill_tanker'

export async function submitUtilityAction(action: UtilityAction, plotId: number, expectedRevision: number, idempotencyKey: string = crypto.randomUUID()) {
  const session = getSession()
  if (!session) throw new Error('sign_in_required')
  return request<{ state: Record<string, unknown>; revision: number; xp_gain: number; level: number; duplicate: boolean }>('utility-action', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ action, ...(action === 'water_tanker' ? { plotId } : {}), idempotencyKey, expectedRevision }),
  })
}
