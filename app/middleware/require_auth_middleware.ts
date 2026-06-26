import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/** Redirects guests to /login (preserving where they were headed). */
export default class RequireAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!ctx.user) {
      const next_ = encodeURIComponent(ctx.request.url(true))
      return ctx.response.redirect(`/login?next=${next_}`)
    }
    return next()
  }
}
