import { createExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb } from '../src/db/client'
import { creators, supports } from '../src/db/schema'
import { app } from '../src/index'

const ORIGIN = 'http://localhost'
const db = createDb(env.DB)

type Call = { url: string; method: string; body: any }
let calls: Call[] = []
let khaimeRoutes: Record<string, (call: Call) => { status?: number; json: unknown }> = {}

function token(payload: object) {
  return `${btoa(JSON.stringify(payload))}.sig`
}

function call(path: string, init: RequestInit = {}) {
  return app.request(`${ORIGIN}${path}`, init, env, createExecutionContext())
}

function cookiesFrom(res: Response): string {
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
}

async function signUp(name: string, email: string): Promise<string> {
  const res = await call('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'origin': ORIGIN },
    body: JSON.stringify({ email, name, password: crypto.randomUUID() }),
  })
  expect(res.status).toBe(200)
  const cookie = cookiesFrom(res)
  await call('/dashboard', { headers: { cookie } }) // provisions creator + sub-merchant
  return cookie
}

const json = (body: unknown, cookie = '') => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify(body),
})

const form = (body: string, cookie: string) => ({
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', 'origin': ORIGIN, cookie },
  body,
})

beforeEach(async () => {
  for (const t of ['supports', 'creators', 'session', 'account', 'verification', '"user"']) {
    await env.DB.exec(`DELETE FROM ${t}`)
  }
  calls = []
  khaimeRoutes = {
    'POST /merchants': () => ({ json: { success: true, data: { id: 900 } } }),
    'GET /payout/banks': () => ({ json: { success: true, data: [{ name: 'Kuda Bank' }] } }),
  }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input))
    const c = { url: String(input), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined }
    calls.push(c)
    const key = `${c.method} ${url.pathname.replace('/api/v1', '').replace(/\/\d+(?=\/|$)/, '/:id')}`
    const handler = khaimeRoutes[key]
    if (!handler) return Response.json({ success: false, message: `unstubbed ${key}` }, { status: 500 })
    const { status = 200, json } = handler(c)
    return Response.json(json, { status })
  })
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('support checkout', () => {
  it('charges an NGN tip in minor units and records it as pending', async () => {
    await signUp('Ada Obi', 'ada@example.test')
    khaimeRoutes['POST /payments/charge'] = () => ({
      json: { success: true, data: { transaction_id: 'tx1', token: token({ payment_gateway: 'paystack', access_code: 'ac1' }) } },
    })

    const res = await call('/adaobi/support', json({ amount: 5000, supporterName: 'Kemi', message: 'yay', email: 'k@example.test' }))

    expect(await res.json()).toEqual({ status: 'redirect', checkoutUrl: 'https://checkout.paystack.com/ac1' })
    const charge = calls.find((c) => c.url.endsWith('/payments/charge'))!
    expect(charge.body).toMatchObject({
      sub_merchant_id: 900,
      merchant_amount: 500000,
      charge_amount: 500000,
      charge_currency: 'NGN',
      redirect_url: `${ORIGIN}/adaobi?thanks=1`,
      customer: { email: 'k@example.test', first_name: 'Kemi' },
      metadata: { creator: 'adaobi' },
    })
    const [row] = await db.select().from(supports)
    expect(row).toMatchObject({
      amount: 5000,
      currency: 'NGN',
      chargeAmount: 500000,
      chargeCurrency: 'NGN',
      status: 'pending',
      supporterName: 'Kemi',
      message: 'yay',
    })
    expect(row.reference).toBe(charge.body.reference)
    expect(row.reference).toMatch(/^sml_/)
    expect(row.khaimeTransactionId).toBe('tx1')
  })

  it('returns Stripe details for a tip paid in USD', async () => {
    await signUp('Ada', 'ada@example.test')
    khaimeRoutes['GET /pricing/calculate'] = () => ({
      json: { success: true, data: { pricing: { local: { amount: 3.5, currency: 'USD' } } } },
    })
    khaimeRoutes['POST /payments/charge'] = () => ({
      json: {
        success: true,
        data: { token: token({ payment_gateway: 'stripe', client_secret: 'cs', publishable_key: 'pk', metadata: { stripe_account_id: 'acct' } }) },
      },
    })

    const res = await call('/ada/support', json({ amount: 5000, payCurrency: 'usd' }))

    expect(await res.json()).toEqual({
      status: 'stripe',
      clientSecret: 'cs',
      publishableKey: 'pk',
      stripeAccountId: 'acct',
      returnUrl: `${ORIGIN}/ada?thanks=1`,
    })
    const [row] = await db.select().from(supports)
    expect(row).toMatchObject({ amount: 5000, currency: 'NGN', chargeAmount: 350, chargeCurrency: 'USD', status: 'pending' })
  })

  it('reports a failed charge honestly and records nothing', async () => {
    await signUp('Ada', 'ada@example.test')
    khaimeRoutes['POST /payments/charge'] = () => ({ status: 422, json: { success: false, message: 'PAYOUT_NOT_CONFIGURED' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await call('/ada/support', json({ amount: 5000 }))

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ status: 'failed', error: 'Could not start checkout. Please try again.' })
    expect(await db.select().from(supports)).toHaveLength(0)
  })
})

describe('payouts', () => {
  it('refreshes the payout status from Khaime', async () => {
    const cookie = await signUp('Ada', 'ada@example.test')
    khaimeRoutes['GET /merchants/:id'] = () => ({
      json: { success: true, data: { id: 900, payout: { payout_ready: true, settlement_currency: 'NGN' } } },
    })

    const html = await (await call('/payouts', { headers: { cookie } })).text()

    expect(html).toContain('connected · NGN')
    expect(html).toContain('<option value="Kuda Bank">Kuda Bank</option>')
    const row = await db.select().from(creators).get()
    expect(row).toMatchObject({ payoutStatus: 'ready', settlementCurrency: 'NGN' })
  })

  it('saves a bank and shows the flash once', async () => {
    const cookie = await signUp('Ada', 'ada@example.test')
    khaimeRoutes['POST /merchants/:id/payout'] = () => ({ json: { success: true, data: {} } })
    khaimeRoutes['GET /merchants/:id'] = () => ({ status: 503, json: { success: false } })

    const post = await call('/payouts/bank', form('settlement_bank=Kuda+Bank&account_number=0123456789&account_name=Ada+Obi', cookie))
    expect(post.status).toBe(302)
    expect(calls.find((c) => c.url.endsWith('/merchants/900/payout'))?.body).toEqual({
      country: 'NG',
      settlement_bank: 'Kuda Bank',
      account_number: '0123456789',
      account_name: 'Ada Obi',
    })
    expect(await db.select().from(creators).get()).toMatchObject({ payoutProvider: 'bank', payoutStatus: 'pending' })

    const flashCookie = cookiesFrom(post)
    const first = await call('/payouts', { headers: { cookie: `${cookie}; ${flashCookie}` } })
    expect(await first.text()).toMatch(/Bank saved — we(&#39;|')re verifying it\./)
    expect(first.headers.getSetCookie().join()).toMatch(/sml_flash=;.*Max-Age=0/)
  })

  it('requests a payout in minor units', async () => {
    const cookie = await signUp('Ada', 'ada@example.test')
    khaimeRoutes['POST /merchants/:id/payouts'] = () => ({ json: { success: true, data: { status: 'staged' } } })

    const post = await call('/payouts/request', form('amount=%E2%82%A612%2C500', cookie))

    expect(post.headers.get('location')).toBe('/payouts')
    expect(calls.find((c) => c.url.endsWith('/merchants/900/payouts'))?.body).toMatchObject({ amount: 1250000, currency: 'NGN' })
    expect(decodeURIComponent(cookiesFrom(post))).toContain('Payout requested (staged)')
  })
})

describe('routing', () => {
  const guarded = ['/setup', '/dashboard', '/supporters', '/connect', '/settings', '/payouts']

  it('guards every creator-area page, ahead of the /:handle catch-all', async () => {
    for (const path of guarded) {
      const res = await call(path)
      expect(res.status, path).toBe(302)
      expect(res.headers.get('location'), path).toBe(`/login?next=${encodeURIComponent(path)}`)
    }
    for (const path of ['/setup', '/connect', '/connect/reset', '/brand', '/settings', '/payouts/bank', '/payouts/stripe', '/payouts/request']) {
      const res = await call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      expect(res.status, path).toBe(302)
    }
  })

  it('serves creator pages and a plain 404 for unknown handles', async () => {
    await signUp('Ada', 'ada@example.test')
    expect((await call('/ada')).status).toBe(200)
    const missing = await call('/nobody')
    expect(missing.status).toBe(404)
    expect(await missing.text()).toBe('Creator not found')
  })

  it('escapes user content', async () => {
    const cookie = await signUp('Ada', 'ada@example.test')
    await call('/settings', form('displayName=%3Cscript%3Ex%3C%2Fscript%3E&handle=ada&bio=%3Cimg+src%3Dx%3E', cookie))
    const html = await (await call('/ada')).text()
    expect(html).not.toContain('<script>x</script>')
    expect(html).not.toContain('<img src=x>')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
  })
})
