/**
 * Brevo transactional email transport — port of app/lib/email.ts.
 *
 * Same behaviour as the AdonisJS version: with no BREVO_API_KEY or
 * MAIL_FROM_EMAIL it logs the message instead of sending, so local auth flows
 * work without a key. Config comes from the Worker env, not process.env.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

interface SendEmailArgs {
  to: string
  subject: string
  html: string
}

export async function sendEmail(env: Env, { to, subject, html }: SendEmailArgs): Promise<void> {
  const apiKey = env.BREVO_API_KEY
  const fromEmail = env.MAIL_FROM_EMAIL
  const fromName = env.MAIL_FROM_NAME || 'Show Me Love'

  if (!apiKey || !fromEmail) {
    console.log(
      `\n📧 [dev fallback — set BREVO_API_KEY + MAIL_FROM_EMAIL to send for real]` +
        `\n   To:      ${to}` +
        `\n   Subject: ${subject}` +
        `\n   ${html.replace(/\s+/g, ' ').trim()}\n`
    )
    return
  }

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Brevo email to ${to} failed (HTTP ${res.status}): ${body}`)
  }
}

export function actionEmailHtml(opts: { heading: string; intro: string; label: string; url: string }): string {
  const { heading, intro, label, url } = opts
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #21201c;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">${heading}</h1>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px; color: #4b4a45;">${intro}</p>
    <a href="${url}" style="display: inline-block; background: #21201c; color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 24px; border-radius: 10px;">${label}</a>
    <p style="font-size: 13px; line-height: 1.6; margin: 24px 0 0; color: #82827c;">Or paste this link into your browser:<br /><a href="${url}" style="color: #82827c;">${url}</a></p>
    <p style="font-size: 13px; line-height: 1.6; margin: 24px 0 0; color: #82827c;">If you didn't request this, you can safely ignore this email.</p>
  </div>`
}
