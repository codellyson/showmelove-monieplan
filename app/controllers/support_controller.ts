import type { HttpContext } from '@adonisjs/core/http'
import Creator from '#models/creator'
import Support from '#models/support'
import { presentCreator } from '#services/creator_presenter'
import * as khaime from '#services/khaime'

/** Currencies a supporter can pay in besides the creator's own. */
export const PAY_CURRENCIES = ['USD']

function makeReference(): string {
  return 'sml_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export default class SupportController {
  /** Public creator page (showmelove.com/:handle). */
  async show({ params, view, response }: HttpContext) {
    const creator = await Creator.findBy('handle', params.handle)
    if (!creator) {
      return response.notFound('Creator not found')
    }
    const v = await presentCreator(creator)
    return view.render('pages/support', {
      title: `${creator.displayName} — showmelove`,
      pageCss: 'support.css',
      brandColor: creator.brandColor,
      v,
    })
  }

  /** A supporter sends love. Managed creators charge via Khaime (redirect to a
   *  hosted checkout, confirmed asynchronously by webhook). Bring-your-own
   *  charging isn't live yet — we return an honest error rather than fake it. */
  async store({ params, request, response, logger }: HttpContext) {
    const creator = await Creator.findBy('handle', params.handle)
    if (!creator) {
      return response.notFound({ error: 'Creator not found' })
    }

    const amount = Math.max(0, Math.trunc(Number(request.input('amount', 0))))
    const recurring = creator.payoutMode === 'managed' && Boolean(request.input('recurring', false))
    const rawName = String(request.input('supporterName', '')).trim()
    const rawMessage = String(request.input('message', '')).trim()
    const rawEmail = String(request.input('email', '')).trim()
    const payCurrency = String(request.input('payCurrency', creator.currency)).trim().toUpperCase()

    if (!amount) {
      return response.badRequest({ error: 'Pick an amount' })
    }
    if (!PAY_CURRENCIES.includes(payCurrency) && payCurrency !== creator.currency) {
      return response.badRequest({ error: 'Unsupported currency' })
    }

    // Bring-your-own: charging on the creator's own processor isn't built yet.
    if (creator.payoutMode === 'byo') {
      return response.status(402).json({
        status: 'unavailable',
        error: "This creator's own-processor payments aren't live yet. Check back soon.",
      })
    }

    // Managed payouts require Khaime configured and the creator provisioned.
    if (!khaime.isConfigured() || !creator.khaimeMerchantId) {
      return response.status(503).json({
        status: 'unavailable',
        error: 'Payments are temporarily unavailable. Please try again shortly.',
      })
    }

    // Managed via Khaime: real checkout, confirmed by the payment.succeeded webhook.
    const reference = makeReference()
    const origin = `${request.protocol()}://${request.host()}`
    try {
      const charge = await khaime.createCharge({
        subMerchantId: Number(creator.khaimeMerchantId),
        amountMajor: amount,
        merchantCurrency: creator.currency,
        chargeCurrency: payCurrency,
        reference,
        customerEmail: rawEmail || `supporter+${reference}@showmelove.app`,
        customerName: rawName || null,
        redirectUrl: `${origin}/${creator.handle}?thanks=1`,
        recurring,
        metadata: { creator: creator.handle },
      })
      const isStripe = charge.gateway === 'stripe' && charge.clientSecret && charge.publishableKey
      if (!charge.paymentUrl && !isStripe) throw new Error('No payable charge returned')

      // Record a pending support; the webhook flips it to succeeded.
      await Support.create({
        creatorId: creator.id,
        supporterName: rawName || null,
        message: rawMessage || null,
        amount,
        currency: creator.currency,
        chargeAmount: charge.chargeAmount,
        chargeCurrency: charge.chargeCurrency,
        recurring,
        status: 'pending',
        reference,
      })

      // Stripe gateway (e.g. USD): confirm client-side with Stripe.js.
      if (isStripe) {
        return response.json({
          status: 'stripe',
          clientSecret: charge.clientSecret,
          publishableKey: charge.publishableKey,
          stripeAccountId: charge.stripeAccountId,
          returnUrl: `${origin}/${creator.handle}?thanks=1`,
        })
      }
      // Paystack gateway (e.g. NGN): redirect to the hosted checkout.
      return response.json({ status: 'redirect', checkoutUrl: charge.paymentUrl })
    } catch (e) {
      logger.error({ err: e, creator: creator.handle, reference }, 'Khaime charge failed')
      return response
        .status(502)
        .json({ status: 'failed', error: 'Could not start checkout. Please try again.' })
    }
  }
}
