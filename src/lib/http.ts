import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { AppEnv } from '../app_env'

export type Input = Record<string, unknown>

/**
 * The query string merged with the parsed body (JSON or form); body fields win
 * over query fields. Read it once
 * per request — the body stream can only be consumed once.
 */
export async function readInput(c: Context<AppEnv>): Promise<Input> {
  const query: Input = c.req.query()
  if (c.req.method === 'GET' || c.req.method === 'HEAD') return query
  const type = c.req.header('content-type') ?? ''
  let body: Input = {}
  if (type.includes('application/json')) {
    body = await c.req.json<Input>().catch(() => ({}))
  } else if (type.includes('form')) {
    body = (await c.req.parseBody()) as Input
  }
  return { ...query, ...(body && typeof body === 'object' ? body : {}) }
}

/** `request.only([...])`: just the named keys that are present. */
export function only(input: Input, keys: string[]): Input {
  const out: Input = {}
  for (const k of keys) if (k in input) out[k] = input[k]
  return out
}

/**
 * One-shot flash messages: a short-lived cookie set before a redirect and
 * cleared by the page that shows it.
 */
const FLASH_COOKIE = 'sml_flash'

export interface Flash {
  saved?: string
  error?: string
}

export function flash(c: Context<AppEnv>, message: Flash) {
  setCookie(c, FLASH_COOKIE, JSON.stringify(message), {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    maxAge: 60,
  })
}

export function takeFlash(c: Context<AppEnv>): Flash {
  const raw = getCookie(c, FLASH_COOKIE)
  if (!raw) return {}
  deleteCookie(c, FLASH_COOKIE, { path: '/' })
  try {
    const parsed = JSON.parse(raw) as Flash
    return {
      saved: typeof parsed.saved === 'string' ? parsed.saved : undefined,
      error: typeof parsed.error === 'string' ? parsed.error : undefined,
    }
  } catch {
    return {}
  }
}
