import type { Context } from 'hono'
import type { Child } from 'hono/jsx'
import { raw } from 'hono/html'
import type { AppEnv } from '../app_env'
import type { Creator } from '../db/schema'
import type { SessionUser } from '../lib/auth'

/**
 * What every page can read, the counterpart of the values
 * the current-user middleware sets (src/middleware/current_user.ts).
 */
export interface Shared {
  user: SessionUser | null
  creator: Creator | null
  origin: string
  siteHost: string
}

export function shared(c: Context<AppEnv>): Shared {
  return { user: c.var.user, creator: c.var.creator, origin: c.var.origin, siteHost: c.var.siteHost }
}

/** Renders a page component as a full HTML document. */
export function render(c: Context<AppEnv>, page: Child, status: 200 | 404 | 500 = 200) {
  return c.html(`<!DOCTYPE html>${page}`, status)
}

export interface DocumentProps {
  title?: string
  /** <meta name="description">, for pages that search engines should describe. */
  description?: string
  /** Stylesheet under /assets for this page. */
  pageCss?: string
  /** Adds /assets/shell.css (sidebar app shell). */
  appShell?: boolean
  brandColor?: string | null
  /** Attributes for <body>, e.g. data-brand-save or data-next. */
  body?: Record<string, string>
  children?: Child
}

/**
 * The <head> every page shares, plus the <html>/<body> wrapper.
 * There is no CSRF token: CSRF is an Origin check (src/app.ts).
 */
export function Document({ title, description, pageCss, appShell, brandColor, body, children }: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title || 'showmelove'}</title>
        {description && <meta name="description" content={description} />}
        <link rel="stylesheet" href="/assets/fonts/fonts.css" />
        <link rel="stylesheet" href="/assets/base.css" />
        {appShell && <link rel="stylesheet" href="/assets/shell.css" />}
        {pageCss && <link rel="stylesheet" href={`/assets/${pageCss}`} />}
        {brandColor && <style>{raw(`:root { --brand: ${cssColor(brandColor)}; }`)}</style>}
        <script src="/assets/theme.js" defer></script>
      </head>
      <body {...body}>{children}</body>
    </html>
  )
}

/** Brand colors come from a fixed palette, but never let one break out of the <style> block. */
function cssColor(value: string): string {
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : '#FF5A36'
}

export const HEART_PATH =
  'M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.3 4 2.5.8-1.2 2-2.5 4-2.5 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21Z'

/** The heart logo + wordmark used in every page header. */
export function Brand({ class: className = 'brand', nameStyle }: { class?: string; nameStyle?: string }) {
  return (
    <a class={className} href="/">
      <div class="brand-mark">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff">
          <path d={HEART_PATH} />
        </svg>
      </div>
      <span class="brand-name" style={nameStyle}>
        showmelove
      </span>
    </a>
  )
}
