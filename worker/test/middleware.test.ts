import { createExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { requireAuth } from '../src/middleware/require_auth'

const ORIGIN = 'http://localhost'

function testApp() {
  const app = createApp()
  app.get('/whoami', (c) =>
    c.json({
      user: c.var.user?.email ?? null,
      handle: c.var.creator?.handle ?? null,
      merchant: c.var.creator?.khaimeMerchantId ?? null,
      origin: c.var.origin,
      siteHost: c.var.siteHost,
    })
  )
  app.get('/dashboard', requireAuth, (c) => c.text(`hi ${c.var.creator?.handle}`))
  app.post('/settings', requireAuth, (c) => c.text('saved'))
  return app
}

async function call(path: string, init: RequestInit = {}) {
  return testApp().request(`${ORIGIN}${path}`, init, env, createExecutionContext())
}

/** Signs up through the real Better Auth handler and returns the session cookie. */
async function signUp(email: string, name: string): Promise<string> {
  const res = await call('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'origin': ORIGIN },
    body: JSON.stringify({ email, name, password: crypto.randomUUID() }),
  })
  expect(res.status).toBe(200)
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
}

beforeEach(async () => {
  for (const t of ['supports', 'creators', 'session', 'account', 'verification', '"user"']) {
    await env.DB.exec(`DELETE FROM ${t}`)
  }
  // Khaime is configured in tests; answer sub-merchant creation with id 900.
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    Response.json({ success: true, data: { id: 900 } })
  )
})

afterEach(() => vi.restoreAllMocks())

describe('current user', () => {
  it('leaves guests anonymous', async () => {
    const res = await call('/whoami')
    expect(await res.json()).toEqual({
      user: null,
      handle: null,
      merchant: null,
      origin: ORIGIN,
      siteHost: 'localhost',
    })
  })

  it('creates the creator and Khaime sub-merchant on first sight, once', async () => {
    const cookie = await signUp('ada@example.test', 'Ada Obi')

    const first = await (await call('/whoami', { headers: { cookie } })).json()
    expect(first).toMatchObject({ user: 'ada@example.test', handle: 'adaobi', merchant: '900' })

    const second = await (await call('/whoami', { headers: { cookie } })).json()
    expect(second).toMatchObject({ handle: 'adaobi', merchant: '900' })
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('still serves the page when Khaime is down', async () => {
    const cookie = await signUp('bo@example.test', 'Bo')
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await call('/whoami', { headers: { cookie } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ handle: 'bo', merchant: null })
    expect(warned).toHaveBeenCalledWith(expect.stringMatching(/^Khaime sub-merchant provisioning failed/))
  })
})

describe('requireAuth', () => {
  it('sends guests to /login with where they were headed', async () => {
    const res = await call('/dashboard?tab=notes')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login?next=%2Fdashboard%3Ftab%3Dnotes')
  })

  it('lets signed-in users through', async () => {
    const cookie = await signUp('ada@example.test', 'Ada')
    const res = await call('/dashboard', { headers: { cookie } })
    expect(await res.text()).toBe('hi ada')
  })
})

describe('CSRF', () => {
  const form = (headers: Record<string, string>) => ({
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: 'displayName=x',
  })

  it('rejects cross-site form posts and allows same-origin ones', async () => {
    const cookie = await signUp('ada@example.test', 'Ada')
    expect((await call('/settings', form({ cookie, origin: 'https://evil.test' }))).status).toBe(403)
    expect((await call('/settings', form({ cookie, origin: ORIGIN }))).status).toBe(200)
  })

  it('leaves Better Auth to its own origin check', async () => {
    const res = await call('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'origin': 'https://evil.test' },
      body: JSON.stringify({ email: 'x@example.test', name: 'X', password: crypto.randomUUID() }),
    })
    expect(res.status).toBe(403)
  })
})

describe('security headers', () => {
  it('matches the old shield settings', async () => {
    const res = await call('/whoami')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('strict-transport-security')).toBe('max-age=15552000')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-security-policy')).toBeNull()
  })
})
