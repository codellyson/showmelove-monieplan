import { Hono } from 'hono'
import { createDb } from './db/client'
import { creators } from './db/schema'
import { createAuth } from './lib/auth'

/**
 * showmelove on Workers — phase 1 scaffold.
 *
 * Static files under ../public are served by Workers Static Assets before this
 * runs. Phase 1 only wires the platform: D1, Better Auth and a health check.
 * Pages, the support flow and the Khaime webhook are ported in later phases;
 * keep `/:handle` registered LAST when it arrives, as in start/routes.ts.
 */
const app = new Hono<{ Bindings: Env }>()

app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw))

app.get('/health', async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db.select({ id: creators.id }).from(creators).limit(1)
  return c.json({ ok: true, db: 'd1', creatorsReadable: Array.isArray(rows) })
})

export default app
