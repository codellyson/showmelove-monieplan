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
 * Builds the app with the global middleware stack, the Workers counterpart of
 * start/kernel.ts plus the Better Auth mount from start/routes.ts. Routes are
 * added by the caller (src/index.ts; tests add their own).
 *
 * Order: per-request services → security headers → CSRF → Better Auth →
 * current user.
 *
 * CSRF: AdonisJS shield used a session token (`_csrf` field, X-CSRF-TOKEN
 * header). Here Hono's csrf() checks Origin / Sec-Fetch-Site on form posts
 * instead, which needs no session. JSON posts can't be sent cross-site without
 * a CORS preflight, which this app never allows.
 */
export function createApp() {
  const app = new Hono<AppEnv>()

  app.use(async (c, next) => {
    c.set('db', createDb(c.env.DB))
    c.set('auth', createAuth(c.env))
    c.set('khaime', createKhaime(c.env))
    await next()
  })

  // Shield's settings: X-Frame-Options DENY, HSTS 180 days, nosniff. No CSP, as before.
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
