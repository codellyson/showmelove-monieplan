import type { HttpContext } from '@adonisjs/core/http'
import Creator from '#models/creator'
import Support from '#models/support'
import { presentCreator } from '#services/creator_presenter'
import { applyProfile } from '#services/creator_profile'

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
      title: 'showmelove — Get paid by the people who love your work',
      pageCss: 'landing.css',
      brandColor: example ? example.brandColor : null,
      stats,
      example,
      platformCreators,
      platformSupporters,
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
