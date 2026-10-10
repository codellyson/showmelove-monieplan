import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app_env'
import { ensureCreatorFor } from '../services/creator_provisioner'

/**
 * Resolves the Better Auth session, creates the user's creator on first sight,
 * and provisions the Khaime sub-merchant for managed creators. Khaime failures
 * are logged, never thrown, so an outage doesn't block a page load; the
 * creator just has no khaimeMerchantId until a later request succeeds.
 *
 * Provisioning is awaited rather than deferred to waitUntil, so
 * the page that triggers it already sees the merchant id. It only calls Khaime
 * until the id is stored.
 */
export const currentUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null)

  const user = session?.user ?? null
  let creator = null

  if (user) {
    creator = await ensureCreatorFor(c.var.db, user)
    const { khaime } = c.var
    if (khaime.isConfigured() && creator.payoutMode === 'managed' && !creator.khaimeMerchantId) {
      try {
        creator = await khaime.ensureMerchant(c.var.db, creator, user.email)
      } catch (error) {
        console.error('Khaime ensureMerchant failed', error)
      }
    }
  }

  const url = new URL(c.req.url)
  c.set('user', user)
  c.set('creator', creator)
  c.set('origin', url.origin)
  c.set('siteHost', url.host || 'showmelove.com')

  await next()
})
