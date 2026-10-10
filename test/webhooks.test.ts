import { createExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb } from '../src/db/client'
import { creators, supports } from '../src/db/schema'
import { app } from '../src/index'

const db = createDb(env.DB)

async function sign(body: string, secret = env.KHAIME_WEBHOOK_SECRET): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Posts a raw body exactly as given, signed unless a signature is passed. */
async function deliver(body: string, signature?: string) {
  return app.request(
    'http://localhost/webhooks/khaime',
    {
      method: 'POST',
      // No Origin header and a cross-site-looking request, like Khaime's server.
      headers: { 'content-type': 'application/json', 'x-khaime-signature': signature ?? (await sign(body)) },
      body,
    },
    env,
    createExecutionContext()
  )
}

let creatorId: number

beforeEach(async () => {
  await env.DB.exec('DELETE FROM supports')
  await env.DB.exec('DELETE FROM creators')
  const [creator] = await db
    .insert(creators)
    .values({ displayName: 'Ada', handle: 'ada', khaimeMerchantId: '900' })
    .returning()
  creatorId = creator.id
  await db.insert(supports).values({ creatorId, amount: 5000, reference: 'sml_1', status: 'pending' })
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

const status = async () => (await db.select().from(supports).where(eq(supports.reference, 'sml_1')).get())?.status

describe('signature', () => {
  it('rejects missing, wrong, and re-serialised signatures', async () => {
    const body = '{"event_type":"payment.succeeded","data":{"metadata":{"partner_reference":"sml_1"}}}'
    expect((await deliver(body, '')).status).toBe(401)
    expect((await deliver(body, await sign(body, 'other-secret'))).status).toBe(401)
    // Same JSON, different bytes: the signature covers the raw body.
    const reformatted = JSON.stringify(JSON.parse(body), null, 2)
    expect((await deliver(reformatted, await sign(body))).status).toBe(401)
    expect(await status()).toBe('pending')
  })

  it('verifies the exact bytes, whitespace included', async () => {
    const body = '{ "event_type" : "payment.succeeded", "data": {"metadata": {"partner_reference": "sml_1"}} }\n'
    const res = await deliver(body)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(await status()).toBe('succeeded')
  })

  it('is not blocked by CSRF or the session middleware', async () => {
    const body = '{"event_type":"ping"}'
    const res = await app.request(
      'http://localhost/webhooks/khaime',
      { method: 'POST', headers: { 'content-type': 'text/plain', 'origin': 'https://khaime.example', 'x-khaime-signature': await sign(body) }, body },
      env,
      createExecutionContext()
    )
    expect(res.status).toBe(200)
  })
})

describe('payment events', () => {
  const event = (type: string, metadata: Record<string, unknown> = { partner_reference: 'sml_1' }) =>
    JSON.stringify({ event_type: type, data: { metadata } })

  it('marks a tip paid, and never un-pays it', async () => {
    await deliver(event('payment.succeeded'))
    expect(await status()).toBe('succeeded')
    await deliver(event('payment.failed'))
    expect(await status()).toBe('succeeded')
    await deliver(event('payment.succeeded'))
    expect(await status()).toBe('succeeded')
  })

  it('marks a tip failed, and lets a later success win', async () => {
    await deliver(event('payment.failed'))
    expect(await status()).toBe('failed')
    await deliver(event('payment.succeeded'))
    expect(await status()).toBe('succeeded')
  })

  it('falls back to data.partner_reference', async () => {
    await deliver(JSON.stringify({ event_type: 'payment.succeeded', data: { partner_reference: 'sml_1' } }))
    expect(await status()).toBe('succeeded')
  })

  it('ignores unknown references', async () => {
    const res = await deliver(event('payment.succeeded', { partner_reference: 'sml_nope' }))
    expect(res.status).toBe(200)
    expect(await status()).toBe('pending')
  })

  it('stores the marketplace split and warns on mismatches', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await deliver(
      event('payment.succeeded', {
        partner_reference: 'sml_1',
        marketplace_commission_amount: 250,
        marketplace_sub_merchant_net_amount: 4750,
        marketplace_settlement: { marketplace_commission_amount: 250, sub_merchant_net_amount: 4500 },
      })
    )
    const row = await db.select().from(supports).where(eq(supports.reference, 'sml_1')).get()
    expect(row?.status).toBe('succeeded')
    expect(JSON.parse(row!.khaimeSplit!)).toMatchObject({
      reported: { marketplace_commission_amount: '250', marketplace_sub_merchant_net_amount: '4750' },
      settlement: { sub_merchant_net_amount: 4500 },
      mismatches: ['marketplace_sub_merchant_net_amount=4750 but marketplace_settlement.sub_merchant_net_amount=4500'],
    })
    expect(warned).toHaveBeenCalledWith(
      'Khaime marketplace split: top-level fields disagree with marketplace_settlement',
      expect.objectContaining({ reference: 'sml_1' })
    )
  })
})

describe('account.updated', () => {
  const account = (data: Record<string, unknown>) => JSON.stringify({ event_type: 'account.updated', data })
  const creator = async () => db.select().from(creators).where(eq(creators.id, creatorId)).get()

  it('records the payout as ready from the re-fetched merchant', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ success: true, data: { id: 900, payout: { payout_ready: true, settlement_currency: 'USD' } } })
    )
    await deliver(account({ merchant_id: 900, provider: 'stripe', stripe_account_id: 'acct_9' }))
    expect(await creator()).toMatchObject({
      payoutStatus: 'ready',
      payoutProvider: 'stripe',
      stripeAccountId: 'acct_9',
      settlementCurrency: 'USD',
    })
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('https://khaime.test/api/v1/merchants/900')
  })

  it('treats a not-yet-ready merchant as pending, and keeps pending when Khaime is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ success: true, data: { id: 900, payout: { status: 'processing' } } }))
    await deliver(account({ id: '900' }))
    expect((await creator())?.payoutStatus).toBe('pending')

    await db.update(creators).set({ payoutStatus: null }).where(eq(creators.id, creatorId))
    vi.mocked(fetch).mockRejectedValue(new Error('down'))
    await deliver(account({ merchant_id: 900 }))
    expect((await creator())?.payoutStatus).toBe('pending')
  })

  it('ignores merchants it does not know', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const res = await deliver(account({ merchant_id: 1234 }))
    expect(res.status).toBe(200)
    expect(spy).not.toHaveBeenCalled()
  })
})

it('answers the browser health check', async () => {
  const res = await app.request('http://localhost/webhooks/khaime', {}, env, createExecutionContext())
  expect(await res.json()).toEqual({ ok: true, endpoint: 'khaime', message: 'POST signed Khaime events here.' })
})
