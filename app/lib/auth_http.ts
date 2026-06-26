import type { HttpContext } from '@adonisjs/core/http'

/**
 * Bridges AdonisJS's HttpContext to the web-standard Request/Response that
 * Better Auth's `auth.handler` and `auth.api.*` expect.
 */

/** Build a `Headers` object from the incoming AdonisJS request. */
export function toHeaders(ctx: HttpContext): Headers {
  const headers = new Headers()
  const raw = ctx.request.headers()
  for (const key in raw) {
    const value = raw[key]
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v))
    } else if (value !== undefined) {
      headers.set(key, value)
    }
  }
  return headers
}

/** Convert the incoming request into a web `Request` for `auth.handler`. */
export function toWebRequest(ctx: HttpContext): Request {
  const url = ctx.request.completeUrl(true)
  const method = ctx.request.method()
  const headers = toHeaders(ctx)

  let body: string | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    body = JSON.stringify(ctx.request.body() ?? {})
    headers.set('content-type', 'application/json')
  }

  return new Request(url, { method, headers, body })
}

/** Pipe a web `Response` (from Better Auth) back through AdonisJS's response. */
export async function sendWebResponse(ctx: HttpContext, res: Response): Promise<void> {
  ctx.response.status(res.status)

  const setCookies = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
  for (const cookie of setCookies) {
    ctx.response.append('set-cookie', cookie)
  }
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') ctx.response.header(key, value)
  })

  const buffer = Buffer.from(await res.arrayBuffer())
  ctx.response.send(buffer)
}
