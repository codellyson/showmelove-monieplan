import { and, eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { Hono } from 'hono'
import type { AppEnv } from '../app_env'
import { type Creator, creators, supports, type Processor } from '../db/schema'
import { flash, only, readInput, takeFlash } from '../lib/http'
import { requireAuth } from '../middleware/require_auth'
import { presentCreator, presentSupporters } from '../services/creator_presenter'
import { applyProfile, BRAND_PALETTE, CURRENCIES } from '../services/creator_profile'
import { payoutStatusFor } from '../services/khaime'
import { render, shared } from '../views/layout'
import { DashboardPage, PayoutsPage, SettingsPage, SupportersPage } from '../views/pages/creator_area'
import { ConnectPage, SetupPage } from '../views/pages/onboarding'

/**
 * The signed-in creator area — ports of the pages (setup), dashboard,
 * supporters, connect, settings and payouts controllers.
 *
 * Every route takes `requireAuth` itself. Don't swap that for
 * `creatorArea.use('*', requireAuth)`: mounted at '/', a sub-app's '*'
 * middleware would also guard the public `/:handle` page registered after it.
 */
export const creatorArea = new Hono<AppEnv>()

/** requireAuth guarantees a user, and current_user always provisions their creator. */
function me(c: Context<AppEnv>): Creator {
  const creator = c.var.creator
  if (!creator) throw new Error('requireAuth ran without a creator')
  return creator
}

async function update(c: Context<AppEnv>, creator: Creator, changes: Partial<typeof creators.$inferInsert>) {
  const [row] = await c.var.db.update(creators).set(changes).where(eq(creators.id, creator.id)).returning()
  return row
}

/* --------------------------------------------------------------- setup */

creatorArea.get('/setup', requireAuth, (c) => render(c, <SetupPage shared={shared(c)} creator={me(c)} />))

creatorArea.post('/setup', requireAuth, async (c) => {
  const input = only(await readInput(c), ['displayName', 'handle', 'bio', 'currency', 'monthlyGoal', 'payoutMode'])
  const result = await applyProfile(c.var.db, me(c), input)
  if (!result.ok) return c.json({ error: result.error }, result.status as 400 | 409)
  return c.json({ ok: true, handle: result.creator.handle })
})

/* ----------------------------------------------------- dashboard, supporters */

creatorArea.get('/dashboard', requireAuth, async (c) => {
  const v = await presentCreator(c.var.db, me(c))
  return render(c, <DashboardPage shared={shared(c)} v={v} />)
})

creatorArea.get('/supporters', requireAuth, async (c) => {
  const creator = me(c)
  const data = await presentSupporters(c.var.db, creator)
  return render(c, <SupportersPage creator={creator} {...data} />)
})

/* ------------------------------------------------------------------ connect */

const PROCESSORS: Processor[] = ['paystack', 'stripe']

creatorArea.get('/connect', requireAuth, (c) => render(c, <ConnectPage creator={me(c)} />))

/** Switch to bring-your-own with the chosen processor. */
creatorArea.post('/connect', requireAuth, async (c) => {
  const processor = String((await readInput(c)).processor ?? '') as Processor
  if (!PROCESSORS.includes(processor)) return c.json({ error: 'Unknown processor' }, 400)
  const row = await update(c, me(c), { payoutMode: 'byo', processor })
  return c.json({ ok: true, processor, payoutMode: row.payoutMode })
})

/** Switch back to managed payouts. */
creatorArea.post('/connect/reset', requireAuth, async (c) => {
  const row = await update(c, me(c), { payoutMode: 'managed', processor: null })
  return c.json({ ok: true, payoutMode: row.payoutMode })
})

/* ----------------------------------------------------------------- settings */

creatorArea.get('/settings', requireAuth, (c) => {
  const { saved, error } = takeFlash(c)
  return render(
    c,
    <SettingsPage
      shared={shared(c)}
      creator={me(c)}
      currencies={Object.keys(CURRENCIES)}
      palette={BRAND_PALETTE}
      saved={saved}
      error={error}
    />
  )
})

/** Save the profile form (full-page POST with flash feedback). */
creatorArea.post('/settings', requireAuth, async (c) => {
  const input = only(await readInput(c), [
    'displayName',
    'handle',
    'bio',
    'currency',
    'monthlyGoal',
    'payoutMode',
    'brandColor',
  ])
  const result = await applyProfile(c.var.db, me(c), input)
  flash(c, result.ok ? { saved: 'Saved.' } : { error: result.error || 'Could not save.' })
  return c.redirect('/settings')
})

/** Persist a brand-color choice from the floating picker (JSON). */
creatorArea.post('/brand', requireAuth, async (c) => {
  const color = String((await readInput(c)).color ?? '')
  if (!BRAND_PALETTE.includes(color)) return c.json({ error: 'Unknown color' }, 400)
  await update(c, me(c), { brandColor: color })
  return c.json({ ok: true, brandColor: color })
})

/* ------------------------------------------------------------------ payouts */

// Common Nigerian settlement banks (fallback for the local-bank payout form).
const NG_BANKS = [
  'Access Bank',
  'Guaranty Trust Bank',
  'Zenith Bank',
  'United Bank for Africa',
  'First Bank of Nigeria',
  'Kuda Bank',
  'Opay',
  'Moniepoint',
  'Wema Bank',
  'Sterling Bank',
]

// African currencies settle to a local bank (Khaime verifies); everything else
// (USD/GBP/EUR/…) settles via a Khaime-managed Stripe account.
const LOCAL_BANK_CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR', 'TZS', 'XAF', 'XOF']
function payoutMethodFor(currency: string): 'bank' | 'stripe' {
  return LOCAL_BANK_CURRENCIES.includes(currency.toUpperCase()) ? 'bank' : 'stripe'
}

/** Payouts — managed (Khaime: NGN bank or USD/Stripe) or bring-your-own. */
creatorArea.get('/payouts', requireAuth, async (c) => {
  const { db, khaime } = c.var
  let creator = me(c)
  const { saved, error } = takeFlash(c)

  const sym = creator.currencySymbol
  const succeeded = await db
    .select({ amount: supports.amount })
    .from(supports)
    .where(and(eq(supports.creatorId, creator.id), eq(supports.status, 'succeeded')))
  const gross = succeeded.reduce((s, x) => s + x.amount, 0)
  const rate = khaime.commissionRate()
  const commissionPct = Math.round(rate * 100)
  const net = Math.round(gross * (1 - rate))

  const khaimeReady = khaime.isConfigured() && Boolean(creator.khaimeMerchantId)
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
      const next = payoutStatusFor(creator.payoutStatus, m)
      const settle = m.payout?.settlement_currency ?? null
      if (next !== creator.payoutStatus || (settle && settle !== creator.settlementCurrency)) {
        creator = await update(c, creator, {
          payoutStatus: next,
          ...(settle ? { settlementCurrency: settle } : {}),
        })
      }
    } catch {
      /* Khaime unreachable — fall back to the persisted status below */
    }
  }

  return render(
    c,
    <PayoutsPage
      creator={creator}
      isManaged={creator.payoutMode === 'managed'}
      khaimeConfigured={khaime.isConfigured()}
      sym={sym}
      grossLabel={sym + gross.toLocaleString('en-US')}
      netLabel={sym + net.toLocaleString('en-US')}
      commissionPct={commissionPct}
      payoutMethod={payoutMethod}
      payoutStatus={creator.payoutStatus}
      payoutReady={creator.payoutStatus === 'ready'}
      settlementCurrency={creator.settlementCurrency}
      banks={banks}
      stripeDone={c.req.query('stripe') === 'done'}
      saved={saved}
      error={error}
    />
  )
})

/** Shared precondition for the payout actions; returns an error message or null. */
function payoutGuard(c: Context<AppEnv>, creator: Creator): string | null {
  if (creator.payoutMode !== 'managed') return 'Switch to managed payouts first.'
  if (!c.var.khaime.isConfigured() || !creator.khaimeMerchantId) {
    return 'Managed payouts are not enabled in this environment yet.'
  }
  return null
}

/** NGN: save a local bank; Khaime verifies the rest. */
creatorArea.post('/payouts/bank', requireAuth, async (c) => {
  const creator = me(c)
  const err = payoutGuard(c, creator)
  if (err) {
    flash(c, { error: err })
    return c.redirect('/payouts')
  }
  const input = await readInput(c)
  try {
    await c.var.khaime.setupNairaPayout(creator.khaimeMerchantId as string, {
      settlementBank: String(input.settlement_bank ?? ''),
      accountNumber: String(input.account_number ?? ''),
      accountName: String(input.account_name ?? ''),
    })
    await update(c, creator, {
      payoutProvider: 'bank',
      ...(creator.payoutStatus !== 'ready' ? { payoutStatus: 'pending' as const } : {}),
    })
    flash(c, { saved: "Bank saved — we're verifying it." })
  } catch {
    flash(c, { error: 'Could not save your bank. Check the details and try again.' })
  }
  return c.redirect('/payouts')
})

const STRIPE_COUNTRY: Record<string, string> = { USD: 'US', GBP: 'GB', EUR: 'IE', CAD: 'CA', AUD: 'AU' }

/** USD and other non-local currencies: start Khaime-managed Stripe onboarding and redirect there. */
creatorArea.post('/payouts/stripe', requireAuth, async (c) => {
  const creator = me(c)
  const err = payoutGuard(c, creator)
  if (err) {
    flash(c, { error: err })
    return c.redirect('/payouts')
  }
  try {
    const res = await c.var.khaime.connectStripePayout(creator.khaimeMerchantId as string, {
      country: STRIPE_COUNTRY[creator.currency.toUpperCase()] ?? 'US',
      returnUrl: `${c.var.origin}/payouts?stripe=done`,
      refreshUrl: `${c.var.origin}/payouts`,
    })
    if (res.onboarding_url) {
      await update(c, creator, {
        payoutProvider: 'stripe',
        ...(res.stripe_account_id ? { stripeAccountId: res.stripe_account_id } : {}),
        ...(creator.payoutStatus !== 'ready' ? { payoutStatus: 'pending' as const } : {}),
      })
      return c.redirect(res.onboarding_url)
    }
    flash(c, { error: 'Stripe onboarding did not return a link. Try again.' })
  } catch {
    flash(c, { error: 'Could not start USD payout setup. Try again.' })
  }
  return c.redirect('/payouts')
})

/** Withdraw from the wallet via Khaime. */
creatorArea.post('/payouts/request', requireAuth, async (c) => {
  const creator = me(c)
  const err = payoutGuard(c, creator)
  if (err) {
    flash(c, { error: err })
    return c.redirect('/payouts')
  }
  const input = await readInput(c)
  const amount = Math.max(0, Math.trunc(Number(String(input.amount ?? '').replace(/[^0-9]/g, '')) || 0))
  if (!amount) {
    flash(c, { error: 'Enter an amount to withdraw.' })
    return c.redirect('/payouts')
  }
  try {
    const r = await c.var.khaime.initiatePayout(creator.khaimeMerchantId as string, {
      amountMajor: amount,
      currency: creator.currency,
    })
    flash(c, { saved: `Payout requested (${r.status ?? 'pending'}). It settles after review.` })
  } catch {
    flash(c, { error: 'Could not request payout — you may not have enough balance, or setup is incomplete.' })
  }
  return c.redirect('/payouts')
})
