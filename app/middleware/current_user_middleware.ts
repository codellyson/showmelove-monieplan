import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { auth, type SessionUser } from '#lib/auth'
import { toHeaders } from '#lib/auth_http'
import { ensureCreatorFor } from '#services/creator_provisioner'
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
    }

    ctx.user = user
    ctx.creator = creator
    ctx.view.share({ user, creator })

    return next()
  }
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    user: SessionUser | null
    creator: Creator | null
  }
}
