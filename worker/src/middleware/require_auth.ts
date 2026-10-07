import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app_env'

/** Port of app/middleware/require_auth_middleware.ts: guests go to /login, keeping where they were headed. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) {
    const url = new URL(c.req.url)
    return c.redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`)
  }
  await next()
})
