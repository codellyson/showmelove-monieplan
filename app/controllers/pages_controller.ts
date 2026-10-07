import type { HttpContext } from '@adonisjs/core/http'
import Creator from '#models/creator'
import Support from '#models/support'
import { presentCreator } from '#services/creator_presenter'
import { applyProfile } from '#services/creator_profile'
import * as khaime from '#services/khaime'

export default class PagesController {
  /** Marketing home. */
  async landing({ view }: HttpContext) {
    // The featured example creator — independent of who's logged in.
    const example = await Creator.query().orderBy('id', 'asc').first()
    const stats = example ? await presentCreator(example) : null

    // Real platform stats for the hero (currency-agnostic counts).
    const creatorsRow = await Creator.query().count('* as total')
    const supportsRow = await Support.query().where('status', 'succeeded').count('* as total')
    const platformCreators = Number(creatorsRow[0].$extras.total) || 0
    const platformSupporters = Number(supportsRow[0].$extras.total) || 0

    return view.render('pages/landing', {
      title: 'showmelove — Tip jar for Nigerian creators, in Naira',
      metaDescription:
        'A tip-jar page made for Naira. Go live in under a minute, share one link, and let fans send love in Naira or USD. Free to start.',
      pageCss: 'landing.css',
      brandColor: example ? example.brandColor : null,
      stats,
      example,
      platformCreators,
      platformSupporters,
      // Up to three real love notes that have a message; the section hides when there are none.
      proofNotes: (stats?.notes ?? []).filter((note, i) => i < 3 && note.message),
      // Managed-payout fee shown in the copy, from KHAIME_COMMISSION_RATE.
      commissionPct: Math.round(khaime.commissionRate() * 100),
    })
  }

  /** Creator setup wizard (prefilled with the signed-in user's creator). */
  async setup({ view, creator }: HttpContext) {
    return view.render('pages/setup', {
      title: 'showmelove — Set up your page',
      pageCss: 'setup.css',
      brandColor: creator?.brandColor ?? null,
      creator,
    })
  }

  /** Persist the setup wizard into the user's creator. */
  async saveSetup({ request, response, creator }: HttpContext) {
    if (!creator) return response.unauthorized({ error: 'Not signed in' })

    const result = await applyProfile(
      creator,
      request.only(['displayName', 'handle', 'bio', 'currency', 'monthlyGoal', 'payoutMode'])
    )

    if (!result.ok) return response.status(result.status ?? 400).json({ error: result.error })
    return response.json({ ok: true, handle: creator.handle })
  }
}
