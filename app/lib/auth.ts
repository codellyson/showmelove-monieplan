import { betterAuth } from 'better-auth'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { sendEmail, actionEmailHtml } from './email.js'

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

export const auth = betterAuth({
  database: db,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Reset your Show Me Love password',
        html: actionEmailHtml({
          heading: 'Reset your password',
          intro: 'We received a request to reset your Show Me Love password. Click the button below to choose a new one.',
          label: 'Reset password',
          url,
        }),
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Verify your email for Show Me Love',
        html: actionEmailHtml({
          heading: 'Confirm your email',
          intro: 'Welcome to Show Me Love! Please confirm your email address to activate your account.',
          label: 'Verify email',
          url,
        }),
      })
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
