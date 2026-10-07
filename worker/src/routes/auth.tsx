import { Hono } from 'hono'
import type { AppEnv } from '../app_env'
import { render } from '../views/layout'
import { ForgotPage, LoginPage, RegisterPage, ResetPage } from '../views/pages/auth'

/** Port of app/controllers/auth_controller.ts. Sign-in/up themselves are Better Auth's /api/auth/*. */
export const authRoutes = new Hono<AppEnv>()

authRoutes.get('/login', (c) => {
  if (c.var.user) return c.redirect('/dashboard')
  return render(c, <LoginPage next={c.req.query('next') ?? '/dashboard'} reset={c.req.query('reset')} />)
})

authRoutes.get('/register', (c) => {
  if (c.var.user) return c.redirect('/dashboard')
  return render(c, <RegisterPage next={c.req.query('next') ?? '/dashboard'} />)
})

authRoutes.get('/forgot', (c) => {
  if (c.var.user) return c.redirect('/dashboard')
  return render(c, <ForgotPage />)
})

authRoutes.get('/reset', (c) =>
  render(c, <ResetPage token={c.req.query('token') ?? ''} tokenError={c.req.query('error')} />)
)

/** Clears the Better Auth session and returns home. */
authRoutes.post('/logout', async (c) => {
  const res = await c.var.auth.api
    .signOut({ headers: c.req.raw.headers, asResponse: true })
    .catch(() => null)
  for (const cookie of res?.headers.getSetCookie() ?? []) c.header('set-cookie', cookie, { append: true })
  return c.redirect('/')
})
