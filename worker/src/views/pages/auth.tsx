import type { Child } from 'hono/jsx'
import { Brand, Document } from '../layout'

/** Ports of pages/login, register, forgot and reset .edge. The forms post JSON from auth.js / auth-reset.js. */

function AuthShell(props: { title: string; next?: string; script: string; children?: Child }) {
  return (
    <Document title={props.title} pageCss="auth.css" body={props.next !== undefined ? { 'data-next': props.next } : undefined}>
      <div class="page auth-page">
        <div class="auth-card">
          <Brand class="brand auth-brand" />
          {props.children}
        </div>
      </div>
      <script src={props.script}></script>
    </Document>
  )
}

export function LoginPage({ next, reset }: { next: string; reset?: string | null }) {
  return (
    <AuthShell title="showmelove — Log in" next={next} script="/assets/auth.js">
      <h1 class="auth-title">Welcome back</h1>
      <p class="auth-sub">Log in to your creator dashboard.</p>

      {reset && (
        <div class="auth-ok" style="margin-bottom:18px;">
          Password updated — log in with your new password.
        </div>
      )}

      <form id="authForm" data-endpoint="/api/auth/sign-in/email" novalidate>
        <label class="field-label">Email</label>
        <input class="text-input" type="email" name="email" autocomplete="email" required placeholder="you@email.com" />
        <div class="field-label-row" style="margin-top:16px;">
          <label class="field-label" style="margin:0;">
            Password
          </label>
          <a class="auth-forgot" href="/forgot">
            Forgot?
          </a>
        </div>
        <input
          class="text-input"
          type="password"
          name="password"
          autocomplete="current-password"
          required
          placeholder="••••••••"
        />
        <div class="auth-error" id="authError"></div>
        <button class="btn-primary auth-submit" type="submit">
          Log in
        </button>
      </form>

      <div class="auth-alt">
        New here? <a href="/register">Create an account</a>
      </div>
    </AuthShell>
  )
}

export function RegisterPage({ next }: { next: string }) {
  return (
    <AuthShell title="showmelove — Create your account" next={next} script="/assets/auth.js">
      <h1 class="auth-title">Start your page</h1>
      <p class="auth-sub">Create an account and go live in under a minute.</p>

      <form id="authForm" data-endpoint="/api/auth/sign-up/email" novalidate>
        <label class="field-label">Your name</label>
        <input class="text-input" type="text" name="name" autocomplete="name" required placeholder="Ada Obi" />
        <label class="field-label" style="margin-top:16px;">
          Email
        </label>
        <input class="text-input" type="email" name="email" autocomplete="email" required placeholder="you@email.com" />
        <label class="field-label" style="margin-top:16px;">
          Password
        </label>
        <input
          class="text-input"
          type="password"
          name="password"
          autocomplete="new-password"
          required
          minlength={8}
          placeholder="At least 8 characters"
        />
        <div class="auth-error" id="authError"></div>
        <button class="btn-primary auth-submit" type="submit">
          Create account
        </button>
      </form>

      <div class="auth-alt">
        Already have an account? <a href="/login">Log in</a>
      </div>
    </AuthShell>
  )
}

export function ForgotPage() {
  return (
    <AuthShell title="showmelove — Reset your password" script="/assets/auth-reset.js">
      <h1 class="auth-title">Reset your password</h1>
      <p class="auth-sub">Enter your email and we'll send a reset link.</p>

      <form id="forgotForm" novalidate>
        <label class="field-label">Email</label>
        <input class="text-input" type="email" name="email" autocomplete="email" required placeholder="you@email.com" />
        <div class="auth-error" id="authError"></div>
        <button class="btn-primary auth-submit" type="submit">
          Send reset link
        </button>
      </form>

      <div class="auth-ok" id="authOk" hidden>
        Check your email for a reset link. <span class="auth-hint">(In dev, the link is printed to the server log.)</span>
      </div>

      <div class="auth-alt">
        <a href="/login">Back to log in</a>
      </div>
    </AuthShell>
  )
}

export function ResetPage({ token, tokenError }: { token: string; tokenError?: string | null }) {
  return (
    <AuthShell title="showmelove — Set a new password" script="/assets/auth-reset.js">
      <h1 class="auth-title">Set a new password</h1>
      <p class="auth-sub">Choose a new password for your account.</p>

      {tokenError || !token ? (
        <div class="auth-error" style="min-height:auto;margin:0 0 16px;">
          This reset link is invalid or has expired. <a href="/forgot">Request a new one</a>.
        </div>
      ) : (
        <form id="resetForm" data-token={token} novalidate>
          <label class="field-label">New password</label>
          <input
            class="text-input"
            type="password"
            name="password"
            autocomplete="new-password"
            required
            minlength={8}
            placeholder="At least 8 characters"
          />
          <div class="auth-error" id="authError"></div>
          <button class="btn-primary auth-submit" type="submit">
            Update password
          </button>
        </form>
      )}

      <div class="auth-alt">
        <a href="/login">Back to log in</a>
      </div>
    </AuthShell>
  )
}
