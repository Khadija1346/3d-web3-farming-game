import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const bundleDir = process.env.GARRIVERSE_FUNCTION_BUNDLE_DIR
if (!bundleDir) throw new Error('GARRIVERSE_FUNCTION_BUNDLE_DIR is required')
const { default: handler } = await import(pathToFileURL(resolve(bundleDir, 'auth-refresh.js')).href)

function configure(t, fetchImpl) {
  const previousFetch = globalThis.fetch
  const previous = { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY }
  process.env.SUPABASE_URL = 'https://project.example.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'public-anon-key-for-test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-service-key-must-not-be-used'
  globalThis.fetch = fetchImpl
  t.after(() => {
    globalThis.fetch = previousFetch
    if (previous.url === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = previous.url
    if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY
    else process.env.SUPABASE_ANON_KEY = previous.anon
    if (previous.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.service
  })
}

test('refresh exchanges a token with the anon key and returns only rotated session fields', async t => {
  let requestUrl = ''
  let requestInit
  configure(t, async (url, init) => {
    requestUrl = String(url)
    requestInit = init
    return new Response(JSON.stringify({
      access_token: 'new-access-token-value-123456',
      refresh_token: 'new-refresh-token-value-123456',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: '11111111-1111-4111-8111-111111111111', email: 'farmer@example.test', app_metadata: { role: 'authenticated' } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  const response = await handler(new Request('https://app.example/.netlify/functions/auth-refresh', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: 'old-refresh-token-value-123456' }),
  }))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(requestUrl, 'https://project.example.supabase.co/auth/v1/token?grant_type=refresh_token')
  assert.equal(requestInit.headers.apikey, 'public-anon-key-for-test')
  assert.equal(requestInit.headers.Authorization, undefined)
  assert.deepEqual(JSON.parse(requestInit.body), { refresh_token: 'old-refresh-token-value-123456' })
  assert.equal(body.session.access_token, 'new-access-token-value-123456')
  assert.equal(body.session.refresh_token, 'new-refresh-token-value-123456')
  assert.equal(body.session.user.id, '11111111-1111-4111-8111-111111111111')
  assert.equal(body.session.user.email, 'farmer@example.test')
  assert.equal('app_metadata' in body.session.user, false)
  assert.ok(body.session.expires_at > Math.floor(Date.now() / 1000))
})

test('refresh rejects a missing token before contacting Supabase', async t => {
  let called = false
  configure(t, async () => { called = true; throw new Error('unexpected network call') })
  const response = await handler(new Request('https://app.example/.netlify/functions/auth-refresh', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  }))
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'invalid_refresh_token' })
  assert.equal(called, false)
})

test('invalid upstream refresh tokens return a generic unauthorized response', async t => {
  configure(t, async () => new Response(JSON.stringify({ msg: 'do not expose provider detail' }), { status: 400 }))
  const response = await handler(new Request('https://app.example/.netlify/functions/auth-refresh', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: 'old-refresh-token-value-123456' }),
  }))
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'session_refresh_failed' })
})
