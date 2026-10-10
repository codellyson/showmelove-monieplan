import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { type Creator, creators } from '../db/schema'

/**
 * Khaime Partner API client.
 *
 * Creators become sub-merchants in our marketplace; supporter tips are charged
 * via Khaime (NGN routes to Paystack, USD to Stripe), funds settle to the
 * sub-merchant wallet, and a signed webhook confirms the payment.
 *
 * UNITS: callers pass MAJOR units (what Support.amount holds); Khaime takes
 * MINOR units. Convert only here, with toMinor. `/pricing/calculate` answers in
 * major units.
 *
 * Config comes from the Worker env, so this is a per-request factory. If
 * KHAIME_API_KEY is unset, isConfigured() is false; managed payments then
 * return an honest "temporarily unavailable" rather than charging.
 */

const DEFAULT_BASE_URL = 'https://api.khaime.com/api/v1'
const MINOR_UNIT_FACTOR = 100 // NGN/USD/GBP all use 100 minor units

export function toMinor(amountMajor: number): number {
  return Math.round(amountMajor * MINOR_UNIT_FACTOR)
}

export interface KhaimeMerchant {
  id: number
  business_name: string
  business_email: string
  status: string
}

export interface KhaimeChargeResult {
  chargeId: string | null
  transactionId: string | null
  /** 'paystack' (hosted redirect) or 'stripe' (client-side confirm). */
  gateway: string | null
  /** Paystack: hosted checkout URL to redirect the supporter to. */
  paymentUrl: string | null
  /** Stripe: PaymentIntent client secret to confirm with Stripe.js. */
  clientSecret: string | null
  /** Stripe: publishable key for the connected account. */
  publishableKey: string | null
  /** Stripe: connected account the intent lives on. */
  stripeAccountId: string | null
  /** What the supporter pays, in MINOR units of chargeCurrency. */
  chargeAmount: number
  chargeCurrency: string
  raw: unknown
}

export interface KhaimeMerchantDetails {
  id: number
  profile?: Record<string, unknown>
  marketplace?: Record<string, unknown>
  payout?: {
    status?: string
    settlement_currency?: string | null
    payout_ready?: boolean
    charge_eligible?: boolean
    details?: Record<string, unknown> | null
  }
  kyc?: { verification_status?: string }
  [k: string]: unknown
}

/** Khaime's payment object, as in the payment.* webhook `data` and GET /transactions/:id. */
export interface KhaimePayment {
  object?: 'payment'
  id?: string
  status?: 'succeeded' | 'failed' | 'refunded' | 'disputed' | string
  partner_reference?: string
  metadata?: Record<string, any>
  paid_at?: string | null
  [k: string]: unknown
}

export type PayoutSetupStatus = 'pending' | 'action_needed' | 'ready' | null

interface CheckoutToken {
  payment_gateway?: string
  client_secret?: string
  publishable_key?: string
  authorization_url?: string
  access_code?: string
  metadata?: { stripe_account_id?: string }
}

/**
 * The charge returns a checkout `token` (base64 JSON payload + "." + signature)
 * instead of raw gateway fields. Khaime's SDK reads the payload client-side the
 * same way; the signature is verified by Khaime, not here. Accepts standard and
 * URL-safe base64.
 */
export function decodeCheckoutToken(token: string): CheckoutToken | null {
  try {
    let payload = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    payload += '='.repeat((4 - (payload.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(payload), (ch) => ch.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as CheckoutToken
  } catch {
    return null
  }
}

const SPLIT_KEYS = [
  'marketplace_commission_rate',
  'marketplace_gross_amount',
  'marketplace_gross_commission_amount',
  'marketplace_commission_amount',
  'marketplace_sub_merchant_net_amount',
  'marketplace_fee_absorbed_by_operator',
  'marketplace_split_currency',
] as const

export interface MarketplaceSplit {
  reported: Partial<Record<(typeof SPLIT_KEYS)[number], string>>
  settlement: Record<string, unknown> | null
  mismatches: string[]
}

/**
 * Pull the split Khaime reports on a payment: the top-level marketplace_* fields
 * and the marketplace_settlement block, and list where the two disagree.
 * marketplace_settlement is authoritative when they differ.
 */
export function marketplaceSplitFrom(metadata: Record<string, any> | undefined): MarketplaceSplit | null {
  if (!metadata) return null
  const reported: MarketplaceSplit['reported'] = {}
  for (const key of SPLIT_KEYS) {
    if (metadata[key] !== undefined && metadata[key] !== null) reported[key] = String(metadata[key])
  }
  const settlement = (metadata.marketplace_settlement as Record<string, unknown> | undefined) ?? null
  if (!Object.keys(reported).length && !settlement) return null

  const mismatches: string[] = []
  if (settlement) {
    const pairs: Array<[keyof MarketplaceSplit['reported'], string]> = [
      ['marketplace_commission_amount', 'marketplace_commission_amount'],
      ['marketplace_sub_merchant_net_amount', 'sub_merchant_net_amount'],
      ['marketplace_split_currency', 'gross_product_currency'],
    ]
    for (const [top, inner] of pairs) {
      const a = reported[top]
      const b = settlement[inner]
      if (a !== undefined && b !== undefined && String(a).toUpperCase() !== String(b).toUpperCase()) {
        mismatches.push(`${top}=${a} but marketplace_settlement.${inner}=${b}`)
      }
    }
    const absorbed = Number(reported.marketplace_fee_absorbed_by_operator ?? 0)
    if (absorbed > 0) {
      mismatches.push(
        `marketplace_fee_absorbed_by_operator=${absorbed} but settlement deducted the fee from the sub-merchant`
      )
    }
  }
  return { reported, settlement, mismatches }
}

/**
 * Resolve the persisted payout status from Khaime's view of the merchant,
 * relative to what we already knew. `payout_ready` is authoritative for "live";
 * we never invent "pending" for a creator who hasn't started setup (current ===
 * null stays null), and a started-but-not-ready setup only becomes
 * `action_needed` when Khaime signals it explicitly.
 */
export function payoutStatusFor(current: PayoutSetupStatus, m: KhaimeMerchantDetails): PayoutSetupStatus {
  if (m.payout?.payout_ready) return 'ready'
  if (!current) return null
  const s = (m.payout?.status ?? '').toLowerCase()
  if (/(restrict|action|require|reject|disabled|incomplete|past_due|unverified)/.test(s)) {
    return 'action_needed'
  }
  return current
}

/** Per-handle email alias so a colliding email still yields a unique sub-merchant. */
function aliasEmail(email: string, handle: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const tag = handle.replace(/[^a-z0-9]/gi, '').slice(0, 20) || 'creator'
  return `${local}+${tag}@${domain}`
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time string comparison (lengths are not secret: both are hex digests). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Verify a webhook signature: hex HMAC-SHA256(secret, rawBody), constant-time.
 * `rawBody` must be the exact request text — read it with `await req.text()`
 * BEFORE parsing; re-serialising JSON breaks every signature.
 */
export async function verifyWebhook(
  secret: string | undefined,
  rawBody: string,
  signature: string | undefined | null
): Promise<boolean> {
  if (!secret || !signature) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const expected = hex(await crypto.subtle.sign('HMAC', key, enc.encode(rawBody)))
  return timingSafeEqual(signature, expected)
}

export function createKhaime(env: Env) {
  const baseUrl = env.KHAIME_API_URL || DEFAULT_BASE_URL
  const apiKey = env.KHAIME_API_KEY || undefined

  function isConfigured(): boolean {
    return Boolean(apiKey)
  }

  function commissionRate(): number {
    const raw = String(env.KHAIME_COMMISSION_RATE ?? '').trim()
    const rate = Number(raw)
    return raw !== '' && Number.isFinite(rate) ? rate : 0.05
  }

  async function send<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'X-API-Key': apiKey as string,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; data?: T }
    if (!res.ok || json.success === false) {
      throw new Error(`Khaime ${method} ${path} failed (${res.status}): ${json.message ?? 'unknown error'}`)
    }
    return json.data as T
  }

  /** Onboard a creator as a sub-merchant. */
  function createMerchant(input: { businessName: string; businessEmail: string; country?: string }) {
    return send<KhaimeMerchant>('POST', '/merchants', {
      business_name: input.businessName,
      business_email: input.businessEmail,
      business_country: input.country ?? 'NG',
      commission_rate: commissionRate(),
    })
  }

  /** Find an existing sub-merchant id by its email (for re-linking). */
  async function findMerchantIdByEmail(email: string): Promise<string | null> {
    const data = await send<any>('GET', '/merchants')
    const rows: any[] = Array.isArray(data) ? data : (data?.merchants ?? data?.items ?? [])
    const wanted = email.trim().toLowerCase()
    for (const row of rows) {
      const m = row.merchant ?? row
      const e = String(m.educator_email ?? m.business_email ?? row.business_email ?? '').toLowerCase()
      if (e === wanted) {
        const id = row.merchant_id ?? m.id ?? row.id
        return id != null ? String(id) : null
      }
    }
    return null
  }

  async function provisionMerchantId(name: string, handle: string, email: string): Promise<string | null> {
    // 1) Try the creator's own email.
    try {
      const m = await createMerchant({ businessName: name, businessEmail: email, country: 'NG' })
      return String(m.id)
    } catch {
      // 2) Already a sub-merchant under us? Link it.
      const linked = await findMerchantIdByEmail(email).catch(() => null)
      if (linked) return linked

      // 3) The email exists but isn't our sub-merchant (e.g. the partner/owner
      //    account) — provision under a per-handle alias instead.
      const alias = aliasEmail(email, handle)
      const existingAlias = await findMerchantIdByEmail(alias).catch(() => null)
      if (existingAlias) return existingAlias
      try {
        const m = await createMerchant({ businessName: name, businessEmail: alias, country: 'NG' })
        return String(m.id)
      } catch {
        return null
      }
    }
  }

  /**
   * Ensure a managed creator has a Khaime sub-merchant. No-op if Khaime isn't
   * configured or the creator is already provisioned, so it only hits the API
   * once per creator. Returns the (possibly updated) creator.
   */
  async function ensureMerchant(db: Db, creator: Creator, ownerEmail: string): Promise<Creator> {
    if (!isConfigured() || creator.payoutMode !== 'managed' || creator.khaimeMerchantId) return creator
    const merchantId = await provisionMerchantId(creator.displayName, creator.handle, ownerEmail)
    if (!merchantId) {
      // provisionMerchantId swallows each Khaime error to try the next fallback;
      // say so here, or a misconfigured key looks like nothing happened.
      console.warn(`Khaime sub-merchant provisioning failed for creator ${creator.id}`)
      return creator
    }
    const [updated] = await db
      .update(creators)
      .set({ khaimeMerchantId: merchantId })
      .where(eq(creators.id, creator.id))
      .returning()
    return updated ?? { ...creator, khaimeMerchantId: merchantId }
  }

  /** Convert a creator-currency amount into the supporter's currency (MAJOR units). */
  async function quoteChargeAmount(input: {
    subMerchantId: number
    amountMajor: number
    merchantCurrency: string
    chargeCurrency: string
  }): Promise<number> {
    const query = new URLSearchParams({
      amount: String(input.amountMajor),
      source_currency: input.merchantCurrency,
      target_currency: input.chargeCurrency,
      sub_merchant_id: String(input.subMerchantId),
    })
    const data = await send<{ pricing?: { local?: { amount?: number; currency?: string } } }>(
      'GET',
      `/pricing/calculate?${query}`
    )
    const local = data?.pricing?.local
    if (!local?.amount || local.currency?.toUpperCase() !== input.chargeCurrency.toUpperCase()) {
      throw new Error(`Khaime could not price ${input.merchantCurrency} in ${input.chargeCurrency}`)
    }
    return local.amount
  }

  /**
   * Create a marketplace charge for a supporter tip. `amountMajor` is what the
   * creator is owed, in the creator's currency; the supporter may pay in another
   * currency, priced via /pricing/calculate.
   */
  async function createCharge(input: {
    subMerchantId: number
    amountMajor: number
    merchantCurrency: string
    chargeCurrency: string
    reference: string
    customerEmail: string
    customerName?: string | null
    redirectUrl: string
    recurring?: boolean
    metadata?: Record<string, string | number | boolean>
  }): Promise<KhaimeChargeResult> {
    const merchantCurrency = input.merchantCurrency.toUpperCase()
    const chargeCurrency = input.chargeCurrency.toUpperCase()
    const merchantAmount = toMinor(input.amountMajor)
    const isCrossCurrency = chargeCurrency !== merchantCurrency
    const chargeAmount = isCrossCurrency
      ? toMinor(
          await quoteChargeAmount({
            subMerchantId: input.subMerchantId,
            amountMajor: input.amountMajor,
            merchantCurrency,
            chargeCurrency,
          })
        )
      : merchantAmount

    const data = await send<{ token?: string; charge_id?: string; transaction_id?: string }>(
      'POST',
      '/payments/charge',
      {
        sub_merchant_id: input.subMerchantId,
        charge_amount: chargeAmount,
        charge_currency: chargeCurrency,
        merchant_amount: merchantAmount,
        merchant_currency: merchantCurrency,
        ...(isCrossCurrency && {
          converted_total_amount: chargeAmount,
          converted_total_currency: chargeCurrency,
        }),
        description: input.customerName ? `Support from ${input.customerName}` : 'Support tip',
        reference: input.reference,
        redirect_url: input.redirectUrl,
        customer: {
          email: input.customerEmail,
          first_name: input.customerName ?? undefined,
        },
        metadata: { partner_reference: input.reference, ...input.metadata },
      }
    )
    const checkout = data.token ? decodeCheckoutToken(data.token) : null
    return {
      chargeId: data.charge_id ?? null,
      transactionId: data.transaction_id ?? null,
      gateway: checkout?.payment_gateway ?? null,
      paymentUrl:
        checkout?.authorization_url ??
        (checkout?.access_code ? `https://checkout.paystack.com/${checkout.access_code}` : null),
      clientSecret: checkout?.client_secret ?? null,
      publishableKey: checkout?.publishable_key ?? null,
      stripeAccountId: checkout?.metadata?.stripe_account_id ?? null,
      chargeAmount,
      chargeCurrency,
      raw: data,
    }
  }

  /** Fetch a sub-merchant (KYC + payout status). */
  function getMerchant(merchantId: string) {
    return send<KhaimeMerchantDetails>('GET', `/merchants/${merchantId}`)
  }

  /**
   * Look a payment up by Khaime's transaction id (Create Charge's
   * `transaction_id`). Returns the same payment object as the payment.*
   * webhook's `data`; `status` is succeeded, failed, refunded or disputed.
   * 404 (ORDER_NOT_FOUND) also covers a suspended or pending sub-merchant.
   */
  function getTransaction(transactionId: string) {
    return send<KhaimePayment>('GET', `/transactions/${encodeURIComponent(transactionId)}`)
  }

  /** NGN (local-bank) payout. Khaime verifies the account; we only collect details. */
  function setupNairaPayout(
    merchantId: string,
    input: { settlementBank: string; accountNumber: string; accountName: string }
  ): Promise<unknown> {
    return send('POST', `/merchants/${merchantId}/payout`, {
      country: 'NG',
      settlement_bank: input.settlementBank,
      account_number: input.accountNumber,
      account_name: input.accountName,
    })
  }

  /** Supported payout bank names for a currency (exact names required by Khaime). */
  async function getPayoutBanks(currency = 'NGN'): Promise<string[]> {
    const data = await send<Array<{ name: string }>>('GET', `/payout/banks?currency=${encodeURIComponent(currency)}`)
    return (data || []).map((b) => b.name)
  }

  /** Start foreign payout onboarding via a Khaime-managed Stripe Connect account. */
  function connectStripePayout(
    merchantId: string,
    input: { country: string; returnUrl: string; refreshUrl: string }
  ) {
    return send<{ onboarding_url?: string; stripe_account_id?: string; settlement_currency?: string }>(
      'POST',
      `/merchants/${merchantId}/kyc`,
      { country: input.country, return_url: input.returnUrl, refresh_url: input.refreshUrl }
    )
  }

  /** Request a payout from the sub-merchant's wallet (staged, needs approval). */
  function initiatePayout(merchantId: string, input: { amountMajor: number; currency: string; description?: string }) {
    return send<{ payout_request_id?: string; status?: string; remaining_balance?: number }>(
      'POST',
      `/merchants/${merchantId}/payouts`,
      { amount: toMinor(input.amountMajor), currency: input.currency, description: input.description }
    )
  }

  return {
    isConfigured,
    commissionRate,
    createMerchant,
    findMerchantIdByEmail,
    ensureMerchant,
    quoteChargeAmount,
    createCharge,
    getMerchant,
    getTransaction,
    setupNairaPayout,
    getPayoutBanks,
    connectStripePayout,
    initiatePayout,
    verifyWebhook: (rawBody: string, signature: string | undefined | null) =>
      verifyWebhook(env.KHAIME_WEBHOOK_SECRET, rawBody, signature),
  }
}

export type Khaime = ReturnType<typeof createKhaime>
