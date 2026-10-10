import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../app_env'
import { creators } from '../db/schema'
import { payoutStatusFor } from '../services/khaime'
import { applyPaymentOutcome } from '../services/payment_outcome'

/**
 * Khaime webhooks. Outside auth and CSRF
 * (see isExempt in src/app.ts): it is verified by signature instead.
 */
export const webhookRoutes = new Hono<AppEnv>()

interface KhaimeEvent {
  event_type?: string
  data?: {
    partner_reference?: string
    metadata?: { partner_reference?: string } & Record<string, any>
    merchant_id?: string | number
    id?: string | number
    status?: string
    provider?: string
    stripe_account_id?: string
  }
}

/** Health check — lets you confirm the endpoint is reachable in a browser. */
webhookRoutes.get('/webhooks/khaime', (c) =>
  c.json({ ok: true, endpoint: 'khaime', message: 'POST signed Khaime events here.' })
)

/**
 * Khaime webhook. Verifies the HMAC-SHA256 signature over the RAW body (read
 * as text before any parsing — re-serialised JSON breaks every signature),
 * then applies the event. Idempotent: Khaime may deliver an event more than once.
 */
webhookRoutes.post('/webhooks/khaime', async (c) => {
  const { db, khaime } = c.var
  const raw = await c.req.text()

  if (!(await khaime.verifyWebhook(raw, c.req.header('x-khaime-signature')))) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  let event: KhaimeEvent
  try {
    event = JSON.parse(raw) as KhaimeEvent
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const type = event?.event_type
  const data = event?.data ?? {}

  // The main way a tip gets confirmed; the reconcile Cron (src/jobs) catches
  // webhooks that never arrive. Both go through applyPaymentOutcome.
  if (type === 'payment.succeeded' || type === 'payment.failed') {
    const reference = data.metadata?.partner_reference ?? data.partner_reference
    if (reference) {
      await applyPaymentOutcome(db, reference, type === 'payment.succeeded' ? 'succeeded' : 'failed', data.metadata)
    }
  } else if (type === 'account.updated') {
    // Sub-merchant payout/onboarding status changed (e.g. Stripe Connect
    // approved). This is the event that says setup is complete, so persist it,
    // re-fetching the merchant for the authoritative payout_ready.
    const merchantId = String(data.merchant_id ?? data.id ?? '')
    const creator = merchantId
      ? await db.select().from(creators).where(eq(creators.khaimeMerchantId, merchantId)).get()
      : undefined
    let payoutStatus = creator?.payoutStatus ?? null
    if (creator) {
      const changes: Partial<typeof creators.$inferInsert> = {}
      if (data.provider === 'stripe' || data.stripe_account_id) changes.payoutProvider = 'stripe'
      if (data.stripe_account_id) changes.stripeAccountId = data.stripe_account_id
      try {
        const m = await khaime.getMerchant(merchantId)
        changes.payoutStatus = payoutStatusFor(creator.payoutStatus ?? 'pending', m)
        if (m.payout?.settlement_currency) changes.settlementCurrency = m.payout.settlement_currency
      } catch {
        // Can't reach Khaime — at least record that a method exists.
        if (!creator.payoutStatus) changes.payoutStatus = 'pending'
      }
      if (Object.keys(changes).length) {
        await db.update(creators).set(changes).where(eq(creators.id, creator.id))
      }
      payoutStatus = changes.payoutStatus ?? payoutStatus
    }
    console.log('Khaime account.updated', {
      event: type,
      merchantId,
      creator: creator?.handle ?? null,
      payoutStatus,
      status: data.status,
      provider: data.provider,
      stripeAccountId: data.stripe_account_id,
    })
  } else if (type) {
    console.log('Khaime webhook received (unhandled type)', { event: type })
  }

  return c.json({ received: true })
})
