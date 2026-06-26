import { betterAuth } from 'better-auth'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

/**
 * Better Auth instance.
 *
 * Kept free of AdonisJS (`#...`) imports on purpose: the Better Auth CLI loads
 * this file directly (via jiti) to generate/migrate its schema, so it must be
 * resolvable outside the AdonisJS module graph.
 *
 * It opens its own better-sqlite3 connection to the SAME database file Lucid
 * uses, so auth tables (user/session/account/verification) live alongside the
 * app tables (creators/supports). WAL keeps the two connections from locking.
 */
const dbPath = fileURLToPath(new URL('../../tmp/db.sqlite3', import.meta.url))
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

/**
 * Dev "mail" transport: log the link to the server console. Swap this for a
 * real provider (Resend/SMTP/Cloudflare) in production — nothing else changes.
 */
function sendDevEmail(kind: string, to: string, url: string) {
  // eslint-disable-next-line no-console
  console.log(`\n📧 [${kind}] for ${to}\n   ${url}\n`)
}

export const auth = betterAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      sendDevEmail('PASSWORD RESET', user.email, url)
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      sendDevEmail('VERIFY EMAIL', user.email, url)
    },
  },
  secret: process.env.APP_KEY,
  baseURL: process.env.APP_URL || 'http://localhost:3333',
  trustedOrigins: [
    'http://localhost:3333',
    'http://127.0.0.1:3333',
    'http://localhost:3340',
    'http://127.0.0.1:3340',
  ],
})

export type SessionUser = (typeof auth.$Infer.Session)['user']
