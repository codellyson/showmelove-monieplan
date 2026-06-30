import type { HttpContext } from '@adonisjs/core/http'
import { presentSupporters } from '#services/creator_presenter'

export default class SupportersController {
  /** Supporters — the full list of love notes for the signed-in creator. */
  async index({ view, response, creator }: HttpContext) {
    if (!creator) return response.notFound('No creator set up yet')

    const data = await presentSupporters(creator)
    return view.render('pages/supporters', {
      title: 'showmelove — Supporters',
      pageCss: 'supporters.css',
      appShell: true,
      activeNav: 'supporters',
      brandColor: creator.brandColor,
      ...data,
    })
  }
}
