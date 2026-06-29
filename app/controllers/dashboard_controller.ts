import type { HttpContext } from '@adonisjs/core/http'
import { presentCreator } from '#services/creator_presenter'

export default class DashboardController {
  /** Creator dashboard — reflects the creator's real data. */
  async index({ view, response, creator }: HttpContext) {
    if (!creator) {
      return response.notFound('No creator set up yet')
    }

    const v = await presentCreator(creator)
    // Managed creators see the upgrade nudge; bring-your-own get the "keep 100%" badge.
    const ui = { showNudge: !v.isByo, showBadge: v.isByo }

    return view.render('pages/dashboard', {
      title: 'showmelove — Dashboard',
      pageCss: 'dashboard.css',
      brandColor: v.creator.brandColor,
      v,
      ui,
    })
  }
}
