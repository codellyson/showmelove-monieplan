import type { HttpContext } from '@adonisjs/core/http'
import { auth } from '#lib/auth'
import { toHeaders } from '#lib/auth_http'

type CookieCapableHeaders = Headers & { getSetCookie?: () => string[] }

export default class AuthController {
  async showLogin({ view, request, response, user }: HttpContext) {
    if (user) return response.redirect('/dashboard')
    return view.render('pages/login', {
      title: 'showmelove — Log in',
      pageCss: 'auth.css',
      brandColor: null,
      next: request.input('next', '/dashboard'),
      reset: request.input('reset'),
    })
  }

  async showForgot({ view, response, user }: HttpContext) {
    if (user) return response.redirect('/dashboard')
    return view.render('pages/forgot', {
      title: 'showmelove — Reset your password',
      pageCss: 'auth.css',
      brandColor: null,
    })
  }

  async showReset({ view, request }: HttpContext) {
    return view.render('pages/reset', {
      title: 'showmelove — Set a new password',
      pageCss: 'auth.css',
      brandColor: null,
      token: request.input('token', ''),
      tokenError: request.input('error'),
    })
  }

  async showRegister({ view, request, response, user }: HttpContext) {
    if (user) return response.redirect('/dashboard')
    return view.render('pages/register', {
      title: 'showmelove — Create your account',
      pageCss: 'auth.css',
      brandColor: null,
      next: request.input('next', '/dashboard'),
    })
  }

  /** Clears the Better Auth session (via its sign-out handler) and returns home. */
  async logout(ctx: HttpContext) {
    const origin = `${ctx.request.protocol()}://${ctx.request.host()}`
    const headers = toHeaders(ctx)
    headers.set('content-type', 'application/json')
    headers.set('origin', origin)

    const req = new Request(`${origin}/api/auth/sign-out`, { method: 'POST', headers, body: '{}' })
    const res = await auth.handler(req).catch(() => null)

    if (res) {
      const setCookies = (res.headers as CookieCapableHeaders).getSetCookie?.() ?? []
      for (const cookie of setCookies) ctx.response.append('set-cookie', cookie)
    }
    return ctx.response.redirect('/')
  }
}
