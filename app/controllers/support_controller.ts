import type { HttpContext } from '@adonisjs/core/http'
import Creator from '#models/creator'
import Support from '#models/support'
import { presentCreator } from '#services/creator_presenter'
import { railFor } from '#services/payment_rail'
import * as khaime from '#services/khaime'

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

  /** A supporter sends love. Managed creators charge via Khaime (redirect to
   *  hosted checkout, confirmed by webhook); otherwise the mock rail settles inline. */
  async store({ params, request, response }: HttpContext) {
    const creator = await Creator.findBy('handle', params.handle)
    if (!creator) {
      return response.notFound({ error: 'Creator not found' })
    }

    const amount = Math.max(0, Math.trunc(Number(request.input('amount', 0))))
    // Monthly is managed-only in v1 (PRD §7): force one-time on bring-your-own.
    const recurring = creator.payoutMode === 'managed' && Boolean(request.input('recurring', false))
    const rawName = String(request.input('supporterName', '')).trim()
    const rawMessage = String(request.input('message', '')).trim()
    const rawEmail = String(request.input('email', '')).trim()

    if (!amount) {
      return response.badRequest({ error: 'Pick an amount' })
    }

    // ---- Managed payouts via Khaime (real checkout + async webhook) ----
    if (creator.payoutMode === 'managed' && khaime.isConfigured() && creator.khaimeMerchantId) {
      const reference = makeReference()
      const origin = `${request.protocol()}://${request.host()}`
      try {
        const charge = await khaime.createCharge({
          subMerchantId: Number(creator.khaimeMerchantId),
          amountMajor: amount,
          currency: creator.currency,
          reference,
          customerEmail: rawEmail || `supporter+${reference}@showmelove.app`,
          customerName: rawName || null,
          redirectUrl: `${origin}/${creator.handle}?thanks=1`,
          recurring,
          metadata: { creator: creator.handle },
        })
        if (!charge.paymentUrl) throw new Error('No checkout URL returned')

        // Record a pending support; the webhook flips it to succeeded.
        await Support.create({
          creatorId: creator.id,
          supporterName: rawName || null,
          message: rawMessage || null,
          amount,
          currency: creator.currency,
          recurring,
          status: 'pending',
          reference,
        })
        return response.json({ status: 'redirect', checkoutUrl: charge.paymentUrl })
      } catch (e) {
        return response.status(502).json({ status: 'failed', error: 'Could not start checkout. Please try again.' })
      }
    }

    // ---- Mock / bring-your-own (settles inline) ----
    const rail = railFor(creator)
    const charge = await rail.createCharge({
      amount,
      currency: creator.currency,
      recurring,
      supporterName: rawName || null,
      message: rawMessage || null,
    })

    // In a real build the rail confirms via webhook; the mock settles inline.
    const support = await Support.create({
      creatorId: creator.id,
      supporterName: rawName || null,
      message: rawMessage || null,
      amount,
      currency: creator.currency,
      recurring,
      status: charge.succeeded ? 'succeeded' : 'failed',
      reference: charge.reference,
    })

    if (support.status !== 'succeeded') {
      return response.status(402).json({ status: 'failed' })
    }

    const v = await presentCreator(creator)
    return response.json({
      status: 'succeeded',
      reference: support.reference,
      amount,
      recurring,
      amountLabel: creator.currencySymbol + amount.toLocaleString('en-US'),
      raisedLabel: v.raisedLabel,
      supporters: v.supporters,
      goalPct: v.goalPct,
    })
  }
}
