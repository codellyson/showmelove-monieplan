import type { HttpContext } from '@adonisjs/core/http'
import Support from '#models/support'
import Creator from '#models/creator'
import * as khaime from '#services/khaime'

export default class WebhooksController {
  /** Health check — lets you confirm the endpoint is reachable in a browser. */
  async khaimeHealth({ response }: HttpContext) {
    return response.ok({ ok: true, endpoint: 'khaime', message: 'POST signed Khaime events here.' })
  }

  /**
   * Khaime webhook. Verifies the HMAC-SHA256 signature over the raw body, then
   * confirms the matching support on `payment.succeeded`. Idempotent.
   */
  async khaime({ request, response, logger }: HttpContext) {
    const raw = request.raw() ?? ''
    const signature = request.header('x-khaime-signature')

    if (!khaime.verifyWebhook(raw, signature)) {
      return response.unauthorized({ error: 'Invalid signature' })
    }

    const event = request.body() as {
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
    const type = event?.event_type
    const data = event?.data ?? {}

    // Charge-API tips can ONLY be confirmed via webhook (no polling), so this
    // is the single source of truth for managed payments. Idempotent.
    if (type === 'payment.succeeded' || type === 'payment.failed') {
      const reference = data.metadata?.partner_reference ?? data.partner_reference
      if (reference) {
        const support = await Support.findBy('reference', reference)
        if (support) {
          const next = type === 'payment.succeeded' ? 'succeeded' : 'failed'
          if (support.status !== next && support.status !== 'succeeded') {
            support.status = next
          }
          const split = khaime.marketplaceSplitFrom(data.metadata)
          if (split) {
            support.khaimeSplit = JSON.stringify(split)
            if (split.mismatches.length) {
              logger.warn(
                { reference, mismatches: split.mismatches, split },
                'Khaime marketplace split: top-level fields disagree with marketplace_settlement'
              )
            }
          }
          await support.save()
        }
      }
    } else if (type === 'account.updated') {
      // Sub-merchant payout/onboarding status changed (e.g. Stripe Connect
      // approved). This is the event that tells us setup is complete, so we
      // persist it — re-fetching the merchant for the authoritative payout_ready.
      const merchantId = String(data.merchant_id ?? data.id ?? '')
      const creator = merchantId ? await Creator.findBy('khaimeMerchantId', merchantId) : null
      if (creator) {
        if (data.provider === 'stripe' || data.stripe_account_id) creator.payoutProvider = 'stripe'
        if (data.stripe_account_id) creator.stripeAccountId = data.stripe_account_id
        try {
          const m = await khaime.getMerchant(merchantId)
          creator.payoutStatus = khaime.payoutStatusFor(creator.payoutStatus ?? 'pending', m)
          if (m.payout?.settlement_currency) creator.settlementCurrency = m.payout.settlement_currency
        } catch {
          // Can't reach Khaime — at least record that a method exists.
          if (!creator.payoutStatus) creator.payoutStatus = 'pending'
        }
        await creator.save()
      }
      logger.info(
        {
          event: type,
          merchantId,
          creator: creator?.handle ?? null,
          payoutStatus: creator?.payoutStatus ?? null,
          status: data.status,
          provider: data.provider,
          stripeAccountId: data.stripe_account_id,
        },
        'Khaime account.updated'
      )
    } else if (type) {
      logger.info({ event: type }, 'Khaime webhook received (unhandled type)')
    }

    return response.ok({ received: true })
  }
}
