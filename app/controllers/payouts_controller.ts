import type { HttpContext } from '@adonisjs/core/http'
import Support from '#models/support'
import * as khaime from '#services/khaime'

// Common Nigerian settlement banks (fallback for the local-bank payout form).
const NG_BANKS = [
  'Access Bank', 'Guaranty Trust Bank', 'Zenith Bank', 'United Bank for Africa',
  'First Bank of Nigeria', 'Kuda Bank', 'Opay', 'Moniepoint', 'Wema Bank', 'Sterling Bank',
]

// African currencies settle to a local bank (Khaime verifies); everything else
// (USD/GBP/EUR/…) settles via a Khaime-managed Stripe account.
const LOCAL_BANK_CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR', 'TZS', 'XAF', 'XOF']
function payoutMethodFor(currency: string): 'bank' | 'stripe' {
  return LOCAL_BANK_CURRENCIES.includes(currency.toUpperCase()) ? 'bank' : 'stripe'
}

export default class PayoutsController {
  /** Payouts — managed (Khaime: NGN bank or USD/Stripe) or bring-your-own. */
  async show({ view, response, request, creator, session }: HttpContext) {
    if (!creator) return response.notFound('No creator set up yet')

    const sym = creator.currencySymbol
    const succeeded = await Support.query()
      .where('creator_id', creator.id)
      .andWhere('status', 'succeeded')
    const gross = succeeded.reduce((s, x) => s + x.amount, 0)
    const commissionPct = Math.round(khaime.commissionRate() * 100)
    const net = Math.round(gross * (1 - khaime.commissionRate()))

    const khaimeReady = khaime.isConfigured() && Boolean(creator.khaimeMerchantId)
    let bank: Record<string, unknown> | null = null
    const payoutMethod = payoutMethodFor(creator.currency)
    let banks = NG_BANKS
    if (payoutMethod === 'bank' && khaime.isConfigured()) {
      try {
        const live = await khaime.getPayoutBanks(creator.currency)
        if (live.length) banks = live
      } catch {
        /* fall back to the static list */
      }
    }
    // Refresh persisted payout status from Khaime when reachable; otherwise the
    // last-known status (set here, at submit, or by the webhook) stands — so a
    // completed setup stays visible even if Khaime is momentarily unreachable.
    if (khaimeReady) {
      try {
        const m = await khaime.getMerchant(creator.khaimeMerchantId as string)
        const next = khaime.payoutStatusFor(creator.payoutStatus, m)
        const settle = m.payout?.settlement_currency ?? null
        if (next !== creator.payoutStatus || (settle && settle !== creator.settlementCurrency)) {
          creator.payoutStatus = next
          if (settle) creator.settlementCurrency = settle
          await creator.save()
        }
        bank = (m.payout?.details as Record<string, unknown>) ?? null
      } catch {
        /* Khaime unreachable — fall back to the persisted status below */
      }
    }
    const payoutStatus = creator.payoutStatus
    const payoutReady = payoutStatus === 'ready'
    const settlementCurrency = creator.settlementCurrency

    return view.render('pages/payouts', {
      title: 'showmelove — Payouts',
      pageCss: 'payouts.css',
      brandColor: creator.brandColor,
      creator,
      isManaged: creator.payoutMode === 'managed',
      khaimeReady,
      khaimeConfigured: khaime.isConfigured(),
      sym,
      grossLabel: sym + gross.toLocaleString('en-US'),
      netLabel: sym + net.toLocaleString('en-US'),
      commissionPct,
      payoutMethod,
      payoutStatus,
      payoutReady,
      settlementCurrency,
      bank,
      banks,
      stripeDone: request.input('stripe') === 'done',
      saved: session.flashMessages.get('saved'),
      error: session.flashMessages.get('error'),
    })
  }

  private guard(creator: HttpContext['creator']): string | null {
    if (!creator) return 'Not signed in'
    if (creator.payoutMode !== 'managed') return 'Switch to managed payouts first.'
    if (!khaime.isConfigured() || !creator.khaimeMerchantId) {
      return 'Managed payouts are not enabled in this environment yet.'
    }
    return null
  }

  /** NGN: save a local bank; Khaime verifies the rest. */
  async setupBank({ request, response, creator, session }: HttpContext) {
    const err = this.guard(creator)
    if (err) { session.flash('error', err); return response.redirect('/payouts') }
    try {
      await khaime.setupNairaPayout(creator!.khaimeMerchantId as string, {
        settlementBank: String(request.input('settlement_bank', '')),
        accountNumber: String(request.input('account_number', '')),
        accountName: String(request.input('account_name', '')),
      })
      creator!.payoutProvider = 'bank'
      if (creator!.payoutStatus !== 'ready') creator!.payoutStatus = 'pending'
      await creator!.save()
      session.flash('saved', "Bank saved — we're verifying it.")
    } catch (e) {
      session.flash('error', 'Could not save your bank. Check the details and try again.')
    }
    return response.redirect('/payouts')
  }

  /** USD: kick off Khaime-managed Stripe onboarding and redirect there. */
  async connectStripe({ request, response, creator, session }: HttpContext) {
    const err = this.guard(creator)
    if (err) { session.flash('error', err); return response.redirect('/payouts') }
    const origin = `${request.protocol()}://${request.host()}`
    const STRIPE_COUNTRY: Record<string, string> = { USD: 'US', GBP: 'GB', EUR: 'IE', CAD: 'CA', AUD: 'AU' }
    try {
      const res = await khaime.connectStripePayout(creator!.khaimeMerchantId as string, {
        country: STRIPE_COUNTRY[creator!.currency.toUpperCase()] ?? 'US',
        returnUrl: `${origin}/payouts?stripe=done`,
        refreshUrl: `${origin}/payouts`,
      })
      if (res.onboarding_url) {
        creator!.payoutProvider = 'stripe'
        if (res.stripe_account_id) creator!.stripeAccountId = res.stripe_account_id
        if (creator!.payoutStatus !== 'ready') creator!.payoutStatus = 'pending'
        await creator!.save()
        return response.redirect(res.onboarding_url)
      }
      session.flash('error', 'Stripe onboarding did not return a link. Try again.')
    } catch (e) {
      session.flash('error', 'Could not start USD payout setup. Try again.')
    }
    return response.redirect('/payouts')
  }

  /** Withdraw from the wallet via Khaime. */
  async requestPayout({ request, response, creator, session }: HttpContext) {
    const err = this.guard(creator)
    if (err) { session.flash('error', err); return response.redirect('/payouts') }
    const amount = Math.max(0, Math.trunc(Number(String(request.input('amount', '')).replace(/[^0-9]/g, '')) || 0))
    if (!amount) { session.flash('error', 'Enter an amount to withdraw.'); return response.redirect('/payouts') }
    try {
      const r = await khaime.initiatePayout(creator!.khaimeMerchantId as string, {
        amountMajor: amount,
        currency: creator!.currency,
      })
      session.flash('saved', `Payout requested (${r.status ?? 'pending'}). It settles after review.`)
    } catch (e) {
      session.flash('error', 'Could not request payout — you may not have enough balance, or setup is incomplete.')
    }
    return response.redirect('/payouts')
  }
}
