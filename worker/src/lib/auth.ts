import { betterAuth } from 'better-auth'
import { actionEmailHtml, sendEmail } from './email'

/**
 * Better Auth on D1 — port of app/lib/auth.ts.
 *
 * Bindings only exist per request on Workers, so this is a factory instead of
 * a module-level instance. Passing the D1 binding as `database` uses Better
 * Auth's built-in D1 dialect, which writes dates as ISO text exactly like the
 * old better-sqlite3 setup, so migrated rows keep working.
 *
 * `secret` must stay the same APP_KEY as the AdonisJS app, or existing session
 * cookies stop validating after cutover.
 */
export function createAuth(env: Env) {
  return betterAuth({
    database: env.DB,
    secret: env.APP_KEY,
    baseURL: env.APP_URL,
    trustedOrigins: [env.APP_URL],
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(env, {
          to: user.email,
          subject: 'Reset your Show Me Love password',
          html: actionEmailHtml({
            heading: 'Reset your password',
            intro:
              'We received a request to reset your Show Me Love password. Click the button below to choose a new one.',
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
        await sendEmail(env, {
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
  })
}

export type Auth = ReturnType<typeof createAuth>
export type SessionUser = Auth['$Infer']['Session']['user']
