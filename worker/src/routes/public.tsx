import { asc, count, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../app_env'
import { creators, supports } from '../db/schema'
import { readInput } from '../lib/http'
import { presentCreator } from '../services/creator_presenter'
import { render, shared } from '../views/layout'
import { LandingPage } from '../views/pages/landing'
import { SupportPage } from '../views/pages/support'

/**
 * Landing page plus the public creator page and support flow — ports of
 * PagesController.landing and app/controllers/support_controller.ts.
 *
 * `publicRoutes` holds the `/:handle` catch-all, so it must be mounted LAST.
 */

/** Currencies a supporter can pay in besides the creator's own. */
export const PAY_CURRENCIES = ['USD']

function makeReference(): string {
  return 'sml_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export const landingRoutes = new Hono<AppEnv>()

landingRoutes.get('/', async (c) => {
  const { db } = c.var
  // The featured example creator — independent of who's logged in.
  const example = (await db.select().from(creators).orderBy(asc(creators.id)).limit(1).get()) ?? null
  const stats = example ? await presentCreator(db, example) : null

  // Real platform stats for the hero (currency-agnostic counts).
  const [creatorsRow] = await db.select({ total: count() }).from(creators)
  const [supportsRow] = await db.select({ total: count() }).from(supports).where(eq(supports.status, 'succeeded'))

  return render(
    c,
    <LandingPage
      shared={shared(c)}
      example={example}
      stats={stats}
      platformCreators={creatorsRow?.total ?? 0}
      platformSupporters={supportsRow?.total ?? 0}
    />
  )
})

export const publicRoutes = new Hono<AppEnv>()

/** A supporter sends love. Managed creators charge via Khaime (redirect to a
 *  hosted checkout, confirmed asynchronously by webhook). Bring-your-own
 *  charging isn't live yet — we return an honest error rather than fake it. */
publicRoutes.post('/:handle/support', async (c) => {
  const { db, khaime } = c.var
  const creator = await db.select().from(creators).where(eq(creators.handle, c.req.param('handle'))).get()
  if (!creator) return c.json({ error: 'Creator not found' }, 404)

  const input = await readInput(c)
  const amount = Math.max(0, Math.trunc(Number(input.amount ?? 0)))
  const recurring = creator.payoutMode === 'managed' && Boolean(input.recurring ?? false)
  const rawName = String(input.supporterName ?? '').trim()
  const rawMessage = String(input.message ?? '').trim()
  const rawEmail = String(input.email ?? '').trim()
  const payCurrency = String(input.payCurrency ?? creator.currency)
    .trim()
    .toUpperCase()

  if (!amount) return c.json({ error: 'Pick an amount' }, 400)
  if (!PAY_CURRENCIES.includes(payCurrency) && payCurrency !== creator.currency) {
    return c.json({ error: 'Unsupported currency' }, 400)
  }

  // Bring-your-own: charging on the creator's own processor isn't built yet.
  if (creator.payoutMode === 'byo') {
    return c.json(
      { status: 'unavailable', error: "This creator's own-processor payments aren't live yet. Check back soon." },
      402
    )
  }

  // Managed payouts require Khaime configured and the creator provisioned.
  if (!khaime.isConfigured() || !creator.khaimeMerchantId) {
    return c.json({ status: 'unavailable', error: 'Payments are temporarily unavailable. Please try again shortly.' }, 503)
  }

  // Managed via Khaime: real checkout, confirmed by the payment.succeeded webhook.
  const reference = makeReference()
  const returnUrl = `${c.var.origin}/${creator.handle}?thanks=1`
  try {
    const charge = await khaime.createCharge({
      subMerchantId: Number(creator.khaimeMerchantId),
      amountMajor: amount,
      merchantCurrency: creator.currency,
      chargeCurrency: payCurrency,
      reference,
      customerEmail: rawEmail || `supporter+${reference}@showmelove.app`,
      customerName: rawName || null,
      redirectUrl: returnUrl,
      recurring,
      metadata: { creator: creator.handle },
    })
    console.log('Khaime charge created', {
      reference,
      transactionId: charge.transactionId,
      gateway: charge.gateway,
    })
    const isStripe = charge.gateway === 'stripe' && charge.clientSecret && charge.publishableKey
    if (!charge.paymentUrl && !isStripe) throw new Error('No payable charge returned')

    // Record a pending support; only the payment.succeeded webhook marks it paid.
    await db.insert(supports).values({
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
      return c.json({
        status: 'stripe',
        clientSecret: charge.clientSecret,
        publishableKey: charge.publishableKey,
        stripeAccountId: charge.stripeAccountId,
        returnUrl,
      })
    }
    // Paystack gateway (e.g. NGN): redirect to the hosted checkout.
    return c.json({ status: 'redirect', checkoutUrl: charge.paymentUrl })
  } catch (e) {
    console.error('Khaime charge failed', { creator: creator.handle, reference }, e)
    return c.json({ status: 'failed', error: 'Could not start checkout. Please try again.' }, 502)
  }
})

/** Public creator page (showmelove.com/:handle). */
publicRoutes.get('/:handle', async (c) => {
  const { db } = c.var
  const creator = await db.select().from(creators).where(eq(creators.handle, c.req.param('handle'))).get()
  if (!creator) return c.text('Creator not found', 404)
  const v = await presentCreator(db, creator)
  return render(c, <SupportPage shared={shared(c)} v={v} />)
})

