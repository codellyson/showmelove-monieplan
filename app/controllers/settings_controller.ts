import type { HttpContext } from '@adonisjs/core/http'
import { applyProfile, CURRENCIES, BRAND_PALETTE } from '#services/creator_profile'

export default class SettingsController {
  /** Profile settings page for the signed-in creator. */
  async show({ view, response, creator, session }: HttpContext) {
    if (!creator) return response.notFound('No creator set up yet')
    return view.render('pages/settings', {
      title: 'showmelove — Settings',
      pageCss: 'settings.css',
      appShell: true,
      activeNav: 'settings',
      brandColor: creator.brandColor,
      creator,
      currencies: Object.keys(CURRENCIES),
      palette: BRAND_PALETTE,
      saved: session.flashMessages.get('saved'),
      error: session.flashMessages.get('error'),
    })
  }

  /** Save the profile form (full-page POST with flash feedback). */
  async update({ request, response, creator, session }: HttpContext) {
    if (!creator) return response.unauthorized('Not signed in')

    const result = await applyProfile(
      creator,
      request.only(['displayName', 'handle', 'bio', 'currency', 'monthlyGoal', 'payoutMode', 'brandColor'])
    )

    if (!result.ok) session.flash('error', result.error ?? 'Could not save.')
    else session.flash('saved', 'Saved.')
    return response.redirect('/settings')
  }

  /** Persist a brand-color choice from the floating picker (JSON). */
  async saveBrand({ request, response, creator }: HttpContext) {
    if (!creator) return response.unauthorized({ error: 'Not signed in' })
    const color = String(request.input('color', ''))
    if (!BRAND_PALETTE.includes(color)) {
      return response.badRequest({ error: 'Unknown color' })
    }
    creator.brandColor = color
    await creator.save()
    return response.json({ ok: true, brandColor: color })
  }
}
