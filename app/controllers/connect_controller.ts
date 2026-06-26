import type { HttpContext } from '@adonisjs/core/http'
import type { Processor } from '#models/creator'

const VALID: Processor[] = ['paystack', 'stripe']

export default class ConnectController {
  /** Connect-a-processor screen for the signed-in creator. */
  async show({ view, response, creator }: HttpContext) {
    if (!creator) {
      return response.notFound('No creator set up yet')
    }
    return view.render('pages/connect', {
      title: 'showmelove — Connect a processor',
      pageCss: 'connect.css',
      brandColor: creator.brandColor,
      creator,
    })
  }

  /** Persist the switch to bring-your-own with the chosen processor. */
  async store({ request, response, creator }: HttpContext) {
    if (!creator) {
      return response.notFound({ error: 'No creator set up yet' })
    }

    const processor = String(request.input('processor', '')) as Processor
    if (!VALID.includes(processor)) {
      return response.badRequest({ error: 'Unknown processor' })
    }

    creator.payoutMode = 'byo'
    creator.processor = processor
    await creator.save()

    return response.json({ ok: true, processor, payoutMode: creator.payoutMode })
  }

  /** Switch back to managed payouts. */
  async reset({ response, creator }: HttpContext) {
    if (!creator) {
      return response.notFound({ error: 'No creator set up yet' })
    }
    creator.payoutMode = 'managed'
    creator.processor = null
    await creator.save()
    return response.json({ ok: true, payoutMode: creator.payoutMode })
  }
}
