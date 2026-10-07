import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb } from '../src/db/client'
import { creators } from '../src/db/schema'
import { ensureCreatorFor } from '../src/services/creator_provisioner'
import {
  createKhaime,
  decodeCheckoutToken,
  marketplaceSplitFrom,
  payoutStatusFor,
  toMinor,
  verifyWebhook,
} from '../src/services/khaime'

type Call = { url: string; method: string; body: any }

function stubFetch(handler: (call: Call) => { status?: number; json: unknown }) {
  const calls: Call[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }
    calls.push(call)
    const { status = 200, json } = handler(call)
    return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } })
  })
  return calls
}

function checkoutToken(payload: object): string {
  return `${btoa(JSON.stringify(payload))}.signature`
}

afterEach(() => vi.restoreAllMocks())

describe('units', () => {
  it('converts major to minor units', () => {
    expect(toMinor(5000)).toBe(500000)
    expect(toMinor(3.5)).toBe(350)
    expect(toMinor(0.1 + 0.2)).toBe(30)
  })
})

describe('createCharge', () => {
  it('sends minor units and decodes a Paystack checkout token', async () => {
    const calls = stubFetch(() => ({
      json: {
        success: true,
        data: {
          charge_id: 'ch_1',
          transaction_id: 'tx_1',
          token: checkoutToken({ payment_gateway: 'paystack', access_code: 'abc123' }),
        },
      },
    }))
    const result = await createKhaime(env).createCharge({
      subMerchantId: 42,
      amountMajor: 5000,
      merchantCurrency: 'ngn',
      chargeCurrency: 'NGN',
      reference: 'sml_test',
      customerEmail: 'fan@example.test',
      redirectUrl: 'https://example.test/ada?thanks=1',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://khaime.test/api/v1/payments/charge')
    expect(calls[0].body).toMatchObject({
      sub_merchant_id: 42,
      merchant_amount: 500000,
      merchant_currency: 'NGN',
      charge_amount: 500000,
      charge_currency: 'NGN',
      metadata: { partner_reference: 'sml_test' },
    })
    expect(calls[0].body).not.toHaveProperty('converted_total_amount')
    expect(result).toMatchObject({
      gateway: 'paystack',
      paymentUrl: 'https://checkout.paystack.com/abc123',
      chargeAmount: 500000,
      chargeCurrency: 'NGN',
      transactionId: 'tx_1',
    })
  })

  it('prices cross-currency charges in major units and sends the converted total', async () => {
    const calls = stubFetch(({ url }) =>
      url.includes('/pricing/calculate')
        ? { json: { success: true, data: { pricing: { local: { amount: 3.5, currency: 'USD' } } } } }
        : {
            json: {
              success: true,
              data: {
                token: checkoutToken({
                  payment_gateway: 'stripe',
                  client_secret: 'pi_secret',
                  publishable_key: 'pk_test',
                  metadata: { stripe_account_id: 'acct_1' },
                }),
              },
            },
          }
    )
    const result = await createKhaime(env).createCharge({
      subMerchantId: 42,
      amountMajor: 5000,
      merchantCurrency: 'NGN',
      chargeCurrency: 'USD',
      reference: 'sml_usd',
      customerEmail: 'fan@example.test',
      redirectUrl: 'https://example.test/ada?thanks=1',
    })

    expect(calls[0].url).toContain('/pricing/calculate?amount=5000&source_currency=NGN&target_currency=USD')
    expect(calls[1].body).toMatchObject({
      merchant_amount: 500000,
      merchant_currency: 'NGN',
      charge_amount: 350,
      charge_currency: 'USD',
      converted_total_amount: 350,
      converted_total_currency: 'USD',
    })
    expect(result).toMatchObject({
      gateway: 'stripe',
      clientSecret: 'pi_secret',
      publishableKey: 'pk_test',
      stripeAccountId: 'acct_1',
    })
  })

  it('surfaces Khaime errors', async () => {
    stubFetch(() => ({
      status: 422,
      json: { success: false, message: 'MARKETPLACE_SUB_MERCHANT_PAYOUT_NOT_CONFIGURED' },
    }))
    await expect(
      createKhaime(env).createCharge({
        subMerchantId: 1,
        amountMajor: 100,
        merchantCurrency: 'NGN',
        chargeCurrency: 'NGN',
        reference: 'sml_x',
        customerEmail: 'fan@example.test',
        redirectUrl: 'https://example.test',
      })
    ).rejects.toThrow('MARKETPLACE_SUB_MERCHANT_PAYOUT_NOT_CONFIGURED')
  })
})

describe('decodeCheckoutToken', () => {
  it('reads URL-safe base64 and UTF-8', () => {
    const json = JSON.stringify({ payment_gateway: 'paystack', access_code: '₦?>' })
    const urlSafe = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeCheckoutToken(`${urlSafe}.sig`)).toEqual(JSON.parse(json))
    expect(decodeCheckoutToken('not base64!.sig')).toBeNull()
  })
})

describe('verifyWebhook', () => {
  const body = 'The quick brown fox jumps over the lazy dog'
  const known = 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8'

  it('accepts the hex HMAC-SHA256 of the raw body', async () => {
    expect(await verifyWebhook('key', body, known)).toBe(true)
  })

  it('rejects a changed body, wrong signature, or missing secret', async () => {
    expect(await verifyWebhook('key', `${body}.`, known)).toBe(false)
    expect(await verifyWebhook('key', body, known.replace(/.$/, '0'))).toBe(false)
    expect(await verifyWebhook('key', body, undefined)).toBe(false)
    expect(await verifyWebhook('', body, known)).toBe(false)
  })
})

describe('payoutStatusFor', () => {
  it('follows payout_ready and never invents pending', () => {
    expect(payoutStatusFor(null, { id: 1, payout: { payout_ready: true } })).toBe('ready')
    expect(payoutStatusFor(null, { id: 1, payout: { status: 'restricted' } })).toBeNull()
    expect(payoutStatusFor('pending', { id: 1, payout: { status: 'requirements_due' } })).toBe('action_needed')
    expect(payoutStatusFor('pending', { id: 1, payout: { status: 'processing' } })).toBe('pending')
  })
})

describe('marketplaceSplitFrom', () => {
  it('returns null with nothing reported', () => {
    expect(marketplaceSplitFrom(undefined)).toBeNull()
    expect(marketplaceSplitFrom({ partner_reference: 'sml_1' })).toBeNull()
  })

  it('lists where top-level fields disagree with marketplace_settlement', () => {
    const split = marketplaceSplitFrom({
      marketplace_commission_amount: 250,
      marketplace_sub_merchant_net_amount: 4750,
      marketplace_fee_absorbed_by_operator: 0,
      marketplace_settlement: { marketplace_commission_amount: 250, sub_merchant_net_amount: 4500 },
    })
    expect(split?.reported.marketplace_commission_amount).toBe('250')
    expect(split?.mismatches).toEqual([
      'marketplace_sub_merchant_net_amount=4750 but marketplace_settlement.sub_merchant_net_amount=4500',
    ])
  })
})

describe('ensureMerchant', () => {
  const db = createDb(env.DB)

  beforeEach(async () => {
    await env.DB.exec('DELETE FROM creators')
  })

  it('re-links an existing sub-merchant when creating one is rejected', async () => {
    const creator = await ensureCreatorFor(db, { id: 'u1', name: 'Ada', email: 'ada@example.test' })
    const calls = stubFetch(({ method, url }) => {
      if (method === 'POST' && url.endsWith('/merchants')) return { status: 409, json: { message: 'exists' } }
      return { json: { success: true, data: [{ merchant_id: 77, merchant: { business_email: 'ADA@example.test' } }] } }
    })

    const updated = await createKhaime(env).ensureMerchant(db, creator, 'ada@example.test')

    expect(updated.khaimeMerchantId).toBe('77')
    const row = await db.select().from(creators).where(eq(creators.id, creator.id)).get()
    expect(row?.khaimeMerchantId).toBe('77')
    expect(calls[0].body).toMatchObject({ business_email: 'ada@example.test', commission_rate: 0.05 })
  })

  it('does nothing for byo creators or when already provisioned', async () => {
    const creator = await ensureCreatorFor(db, { id: 'u2', name: 'Bo', email: 'bo@example.test' })
    const calls = stubFetch(() => ({ json: { success: true, data: { id: 1 } } }))
    const khaime = createKhaime(env)
    await khaime.ensureMerchant(db, { ...creator, payoutMode: 'byo' }, 'bo@example.test')
    await khaime.ensureMerchant(db, { ...creator, khaimeMerchantId: '5' }, 'bo@example.test')
    expect(calls).toHaveLength(0)
  })
})
