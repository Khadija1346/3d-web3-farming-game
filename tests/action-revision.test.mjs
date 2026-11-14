import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const bundleDir = process.env.GARRIVERSE_FUNCTION_BUNDLE_DIR
if (!bundleDir) throw new Error('GARRIVERSE_FUNCTION_BUNDLE_DIR is required')
const cases = [
  ['farming-action.js', { action: 'till', plotId: 0, idempotencyKey: 'test-farming-0001' }],
  ['economy-action.js', { action: 'factory_start', idempotencyKey: 'test-economy-0001' }],
  ['utility-action.js', { action: 'refill_tanker', idempotencyKey: 'test-utility-0001' }],
  ['quest-claim.js', { questId: 'daily_planting', periodKey: '2026-11-14', idempotencyKey: 'test-quest-0001' }],
]
for (const [file, payload] of cases) {
  const { default: handler } = await import(pathToFileURL(resolve(bundleDir, file)).href)
  test(file + ' rejects writes without an expected revision before any RPC call', async t => {
    const previousFetch = globalThis.fetch
    const previous = { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY }
    process.env.SUPABASE_URL = 'https://project.example.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'public-anon-key-for-test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-service-key-must-not-be-used'
    const calls = []
    globalThis.fetch = async url => {
      calls.push(String(url))
      if (String(url).endsWith('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', email: 'farmer@example.test' }), { status: 200 })
      }
      throw new Error('authoritative RPC must not run without expectedRevision')
    }
    t.after(() => {
      globalThis.fetch = previousFetch
      if (previous.url === undefined) delete process.env.SUPABASE_URL
      else process.env.SUPABASE_URL = previous.url
      if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY
      else process.env.SUPABASE_ANON_KEY = previous.anon
      if (previous.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.service
    })
    const response = await handler(new Request('https://app.example/.netlify/functions/' + file, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-access-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }))
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'invalid_revision' })
    assert.deepEqual(calls, ['https://project.example.supabase.co/auth/v1/user'])
  })
}
