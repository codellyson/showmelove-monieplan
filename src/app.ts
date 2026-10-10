import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import type { AppEnv } from './app_env'
import { createDb } from './db/client'
import { createAuth } from './lib/auth'
import { currentUser } from './middleware/current_user'
import { createKhaime } from './services/khaime'

/** Better Auth runs its own origin checks; webhooks are verified by signature. */
const SKIPS_SESSION_AND_CSRF = ['/api/auth/', '/webhooks/']

function isExempt(path: string): boolean {
  return SKIPS_SESSION_AND_CSRF.some((prefix) => path.startsWith(prefix))
}

/**
 * Builds the app with the global middleware stack and the Better Auth mount.
 * Routes are added by the caller (src/index.ts; tests add their own).
 *
 * Order: per-request services → security headers → CSRF → Better Auth →
 * current user.
 *
 * CSRF: Hono's csrf() rejects cross-site form posts by Origin /
 * Sec-Fetch-Site, so no session token is needed. JSON posts can't be sent
 * cross-site without a CORS preflight, which this app never allows.
 */
export function createApp() {
  const app = new Hono<AppEnv>()

  app.use(async (c, next) => {
    c.set('db', createDb(c.env.DB))
    c.set('auth', createAuth(c.env))
    c.set('khaime', createKhaime(c.env))
    await next()
  })

  // X-Frame-Options DENY, HSTS 180 days, nosniff. No CSP yet.
  app.use(
    secureHeaders({
      xFrameOptions: 'DENY',
      strictTransportSecurity: 'max-age=15552000',
      xContentTypeOptions: 'nosniff',
      contentSecurityPolicy: undefined,
    })
  )

  const csrfCheck = csrf()
  app.use((c, next) => (isExempt(c.req.path) ? next() : csrfCheck(c, next)))

  app.on(['GET', 'POST'], '/api/auth/*', (c) => c.var.auth.handler(c.req.raw))

  app.use((c, next) => (isExempt(c.req.path) ? next() : currentUser(c, next)))

  app.onError((err, c) => {
    // Deliberate HTTP errors (e.g. csrf()'s 403) keep their status.
    if (err instanceof HTTPException) return err.getResponse()
    console.error(err)
    return c.text('Something went wrong.', 500)
  })

  return app
}
