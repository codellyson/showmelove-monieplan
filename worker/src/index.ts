import { createApp } from './app'
import { creators } from './db/schema'

/**
 * showmelove on Workers.
 *
 * Static files under ../public are served by Workers Static Assets before this
 * runs. Middleware (session, creator, CSRF, headers) and /api/auth/* are set up
 * in createApp(). Pages, the support flow and the Khaime webhook are ported in
 * later phases; protected pages use `requireAuth`, and `/:handle` must be
 * registered LAST, as in start/routes.ts.
 */
const app = createApp()

app.get('/health', async (c) => {
  const rows = await c.var.db.select({ id: creators.id }).from(creators).limit(1)
  return c.json({ ok: true, db: 'd1', creatorsReadable: Array.isArray(rows) })
})

export default app
