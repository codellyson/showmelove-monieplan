import crypto from 'node:crypto'
import env from '#start/env'
import type Creator from '#models/creator'

/**
 * Khaime Partner API client — powers "Managed payouts" (PRD Mode B).
 *
 * Creators become sub-merchants in our marketplace; supporter tips are charged
 * via Khaime (NGN routes to Paystack), funds settle to the sub-merchant wallet,
 * and a signed webhook confirms the payment. Amounts are in the smallest
 * currency unit (₦ -> kobo), so callers pass major units and we convert.
 *
 * If KHAIME_API_KEY is unset, isConfigured() is false; managed payments then
 * return an honest "temporarily unavailable" rather than charging.
 */

// Base includes the `/partner` segment; override via KHAIME_API_URL (e.g. khaimedev).
const BASE_URL = env.get('KHAIME_API_URL') ?? 'https://api.khaime.com/api/v1/partner'
const MINOR_UNIT_FACTOR = 100 // NGN/USD/GBP all use 100 minor units

export interface KhaimeMerchant {
  id: number
  business_name: string
  business_email: string
  status: string
}

export interface KhaimeChargeResult {
  chargeId: string | null
  paymentUrl: string | null
  raw: unknown
}

function apiKey(): string | undefined {
  return env.get('KHAIME_API_KEY')
}

export function isConfigured(): boolean {
  return Boolean(apiKey())
}

export function commissionRate(): number {
  return env.get('KHAIME_COMMISSION_RATE') ?? 0.05
}

async function send<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'X-API-Key': apiKey() as string,
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

function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return send<T>('POST', path, body)
}

/** Onboard a creator as a sub-merchant. */
export async function createMerchant(input: {
  businessName: string
  businessEmail: string
  country?: string
}): Promise<KhaimeMerchant> {
  return request<KhaimeMerchant>('/marketplace/merchants', {
    business_name: input.businessName,
    business_email: input.businessEmail,
    business_country: input.country ?? 'NG',
    commission_rate: commissionRate(),
  })
}

/** Create a marketplace charge for a supporter tip. Returns the hosted checkout URL. */
export async function createCharge(input: {
  subMerchantId: number
  amountMajor: number
  currency: string
  reference: string
  customerEmail: string
  customerName?: string | null
  redirectUrl: string
  recurring?: boolean
  metadata?: Record<string, string | number | boolean>
}): Promise<KhaimeChargeResult> {
  const amount = Math.round(input.amountMajor * MINOR_UNIT_FACTOR)
  const data = await request<{ charge_id?: string; payment_url?: string }>('/payments/charge', {
    sub_merchant_id: input.subMerchantId,
    amount,
    currency: input.currency,
    total_amount: amount,
    total_currency: input.currency,
    description: input.customerName ? `Support from ${input.customerName}` : 'Support tip',
    reference: input.reference,
    redirect_url: input.redirectUrl,
    customer: {
      email: input.customerEmail,
      first_name: input.customerName ?? undefined,
    },
    metadata: { partner_reference: input.reference, ...input.metadata },
  })
  return { chargeId: data.charge_id ?? null, paymentUrl: data.payment_url ?? null, raw: data }
}

/**
 * Ensure a managed creator has a Khaime sub-merchant. No-op if Khaime isn't
 * configured or the creator is already provisioned. Safe to call on each
 * authenticated dashboard load (only hits the API once per creator).
 */
export async function ensureMerchant(creator: Creator, ownerEmail: string): Promise<void> {
  if (!isConfigured() || creator.payoutMode !== 'managed' || creator.khaimeMerchantId) return
  const merchantId = await provisionMerchantId(creator.displayName, creator.handle, ownerEmail)
  if (merchantId) {
    creator.khaimeMerchantId = merchantId
    await creator.save()
  }
}

/** Per-handle email alias so a colliding email still yields a unique sub-merchant. */
function aliasEmail(email: string, handle: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const tag = handle.replace(/[^a-z0-9]/gi, '').slice(0, 20) || 'creator'
  return `${local}+${tag}@${domain}`
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

/** Find an existing sub-merchant id by its email (for re-linking). */
export async function findMerchantIdByEmail(email: string): Promise<string | null> {
  const data = await send<any>('GET', '/marketplace/merchants')
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

/** Fetch a sub-merchant (KYC + payout status). */
export function getMerchant(merchantId: string): Promise<KhaimeMerchantDetails> {
  return send<KhaimeMerchantDetails>('GET', `/marketplace/merchants/${merchantId}`)
}

export type PayoutSetupStatus = 'pending' | 'action_needed' | 'ready' | null

/**
 * Resolve the persisted payout status from Khaime's view of the merchant,
 * relative to what we already knew. `payout_ready` is authoritative for "live";
 * we never invent "pending" for a creator who hasn't started setup (current ===
 * null stays null), and a started-but-not-ready setup only becomes
 * `action_needed` when Khaime signals it explicitly.
 */
export function payoutStatusFor(
  current: PayoutSetupStatus,
  m: KhaimeMerchantDetails
): PayoutSetupStatus {
  if (m.payout?.payout_ready) return 'ready'
  if (!current) return null
  const s = (m.payout?.status ?? '').toLowerCase()
  if (/(restrict|action|require|reject|disabled|incomplete|past_due|unverified)/.test(s)) {
    return 'action_needed'
  }
  return current
}

/**
 * Set up an NGN (local-bank) payout. Khaime verifies the account/identity —
 * we only collect the bank details.
 */
export function setupNairaPayout(
  merchantId: string,
  input: { settlementBank: string; accountNumber: string; accountName: string }
): Promise<unknown> {
  return send('POST', `/marketplace/merchants/${merchantId}/payout`, {
    country: 'NG',
    settlement_bank: input.settlementBank,
    account_number: input.accountNumber,
    account_name: input.accountName,
  })
}

/** Supported payout bank names for a currency (exact names required by Khaime). */
export async function getPayoutBanks(currency = 'NGN'): Promise<string[]> {
  const data = await send<Array<{ name: string }>>(
    'GET',
    `/marketplace/payout/banks?currency=${encodeURIComponent(currency)}`
  )
  return (data || []).map((b) => b.name)
}

/**
 * Start USD (foreign) payout onboarding via a Khaime-managed Stripe Connect
 * account. Returns a hosted onboarding URL to redirect the creator to.
 */
export function connectStripePayout(
  merchantId: string,
  input: { country: string; returnUrl: string; refreshUrl: string }
): Promise<{ onboarding_url?: string; stripe_account_id?: string; settlement_currency?: string }> {
  return send('POST', `/marketplace/merchants/${merchantId}/kyc`, {
    country: input.country,
    return_url: input.returnUrl,
    refresh_url: input.refreshUrl,
  })
}

/** Request a payout from the sub-merchant's wallet (staged, needs approval). */
export function initiatePayout(
  merchantId: string,
  input: { amountMajor: number; currency: string; description?: string }
): Promise<{ payout_request_id?: string; status?: string; remaining_balance?: number }> {
  return send('POST', `/marketplace/merchants/${merchantId}/payouts`, {
    amount: Math.round(input.amountMajor * MINOR_UNIT_FACTOR),
    currency: input.currency,
    description: input.description,
  })
}

/** Verify a webhook signature: HMAC-SHA256(secret, rawBody), hex, constant-time. */
export function verifyWebhook(rawBody: string, signature: string | undefined): boolean {
  const secret = env.get('KHAIME_WEBHOOK_SECRET')
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
