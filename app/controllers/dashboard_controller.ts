import type { HttpContext } from '@adonisjs/core/http'
import { presentCreator, type CreatorView } from '#services/creator_presenter'

export default class DashboardController {
  /**
   * Creator dashboard. Reflects the creator's real data, but accepts a
   * ?state= override (managed | empty | byo) to preview the PRD's three
   * dashboard variants without mutating data.
   */
  async index({ view, request, response, creator }: HttpContext) {
    if (!creator) {
      return response.notFound('No creator set up yet')
    }

    const v = await presentCreator(creator)
    const state = request.input('state')

    const variant = applyVariant(v, state)
    const activeVariant =
      state === 'empty' || state === 'byo' || state === 'managed'
        ? state
        : variant.view.isByo
          ? 'byo'
          : 'managed'
    return view.render('pages/dashboard', {
      title: 'showmelove — Dashboard',
      pageCss: 'dashboard.css',
      brandColor: variant.view.creator.brandColor,
      v: variant.view,
      ui: variant.ui,
      activeVariant,
    })
  }
}

function applyVariant(base: CreatorView, state?: string) {
  // Default UI mirrors the real data.
  let view = base
  let showNudge = !base.isByo // managed creators see the upgrade nudge
  let showBadge = base.isByo // byo creators get the "keep 100%" badge

  if (state === 'empty') {
    view = {
      ...base,
      raisedLabel: base.sym + '0',
      raisedShort: base.sym + '0',
      supporters: 0,
      goalPct: 0,
      remainingLabel: base.goalLabel,
      notes: [],
      isEmpty: true,
      isByo: false,
    }
    showNudge = false
    showBadge = false
  } else if (state === 'byo') {
    view = { ...base, isByo: true }
    showNudge = false
    showBadge = true
  } else if (state === 'managed') {
    view = { ...base, isByo: false }
    showNudge = true
    showBadge = false
  }

  return { view, ui: { showNudge, showBadge } }
}
