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
