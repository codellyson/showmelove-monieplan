import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { auth, type SessionUser } from '#lib/auth'
import { toHeaders } from '#lib/auth_http'
import { ensureCreatorFor } from '#services/creator_provisioner'
import * as khaime from '#services/khaime'
import Creator from '#models/creator'

/**
 * Resolves the Better Auth session on every routed request, exposes the user
 * and their creator on the context, and shares both with Edge views (so the
 * account menu and dashboard can render without each controller re-fetching).
 */
export default class CurrentUserMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const session = await auth.api
      .getSession({ headers: toHeaders(ctx) })
      .catch(() => null)

    const user = session?.user ?? null
    let creator: Creator | null = null

    if (user) {
      creator = await ensureCreatorFor(user)
      // Provision the Khaime sub-merchant once (managed creators). Log failures
      // instead of swallowing them, so misconfig surfaces in the server log.
      if (khaime.isConfigured() && creator.payoutMode === 'managed' && !creator.khaimeMerchantId) {
        try {
          await khaime.ensureMerchant(creator, user.email)
        } catch (error) {
          ctx.logger.error({ err: error }, 'Khaime ensureMerchant failed')
        }
      }
    }

    // Page links follow the origin we're actually served on: localhost in dev,
    // the real domain once one is configured — no hardcoded host.
    const host = ctx.request.host() || 'showmelove.com'
    const origin = `${ctx.request.protocol()}://${host}`

    ctx.user = user
    ctx.creator = creator
    ctx.view.share({ user, creator, origin, siteHost: host })

    return next()
  }
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    user: SessionUser | null
    creator: Creator | null
  }
}
