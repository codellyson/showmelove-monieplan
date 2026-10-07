import { createApp } from './app'
import { creators } from './db/schema'
import { authRoutes } from './routes/auth'
import { creatorArea } from './routes/creator_area'
import { landingRoutes, publicRoutes } from './routes/public'

/**
 * showmelove on Workers — the routes of start/routes.ts.
 *
 * Static files under ../public are served by Workers Static Assets before this
 * runs. Middleware (session, creator, CSRF, headers) and /api/auth/* are set up
 * in createApp(). The Khaime webhook is ported in phase 5.
 *
 * ORDER MATTERS: publicRoutes holds the `/:handle` catch-all and must stay
 * last, or it swallows every route after it ("Creator not found").
 */
const app = createApp()

app.get('/health', async (c) => {
  const rows = await c.var.db.select({ id: creators.id }).from(creators).limit(1)
  return c.json({ ok: true, db: 'd1', creatorsReadable: Array.isArray(rows) })
})

app.route('/', authRoutes)
app.route('/', landingRoutes)
app.route('/', creatorArea)
app.route('/', publicRoutes) // keep last

export default app
