import type { Child } from 'hono/jsx'
import type { Creator } from '../../db/schema'
import type { CreatorView, PresentedNote } from '../../services/creator_presenter'
import { Document, HEART_PATH, type Shared } from '../layout'
import { PayoutMethodForm, Sidebar, type NavKey } from '../partials'

/** The signed-in creator area: dashboard, supporters, settings and payouts, sharing the sidebar app shell. */

function Shell(props: {
  title: string
  pageCss: string
  creator: Creator
  active: NavKey
  children?: Child
  scripts?: Child
}) {
  return (
    <Document
      title={props.title}
      pageCss={props.pageCss}
      appShell
      brandColor={props.creator.brandColor}
      body={{ 'data-brand-save': '1' }}
    >
      <div class="page">
        <div class="dash">
          <Sidebar creator={props.creator} active={props.active} />
          <main class="main">{props.children}</main>
        </div>
      </div>
      {props.scripts}
    </Document>
  )
}

function Flash({ saved, error }: { saved?: string | null; error?: string | null }) {
  return (
    <>
      {saved && <div class="flash flash-ok">{saved}</div>}
      {error && <div class="flash flash-err">{error}</div>}
    </>
  )
}

/* ---------------------------------------------------------------- dashboard */

export function DashboardPage({ shared, v }: { shared: Shared; v: CreatorView }) {
  const c = v.creator
  return (
    <Shell
      title="showmelove — Dashboard"
      pageCss="dashboard.css"
      creator={c}
      active="home"
      scripts={<script src="/assets/dashboard.js"></script>}
    >
      <div class="main-head">
        <div>
          <div class="welcome-row">
            <div class="welcome">Welcome back, {c.displayName.split(' ')[0]}</div>
            {/* Bring-your-own creators get the "keep 100%" badge; managed ones the upgrade nudge. */}
            {v.isByo && <span class="head-badge">Own processor · keep 100%</span>}
          </div>
          <div class="welcome-sub">
            {v.isEmpty ? (
              'Your page is live — share it to collect your first love note.'
            ) : (
              <>
                You got <span class="accent">{v.notes.length} new love notes</span> this week.
              </>
            )}
          </div>
        </div>
        <div class="link-bar">
          <span class="link-bar-url">
            {shared.siteHost}/{c.handle}
          </span>
          <button class="copy-btn" id="copyBtn" data-url={`${shared.origin}/${c.handle}`}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
            <span id="copyLabel">Copy link</span>
          </button>
        </div>
      </div>

      {/* METRICS */}
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Total raised</div>
          <div class="metric-value">{v.raisedLabel}</div>
          <div class={`metric-delta ${v.totalDeltaUp ? '' : 'is-down'}`}>
            {v.isEmpty ? 'No support yet' : v.totalDeltaLabel}
          </div>
        </div>
        <div class="metric">
          <div class="metric-label">Supporters</div>
          <div class="metric-value">{v.supporters}</div>
          <div class={`metric-delta ${v.supportersDeltaUp ? '' : 'is-down'}`}>
            {v.isEmpty ? 'Share your link to begin' : v.supportersDeltaLabel}
          </div>
        </div>
        <div class="metric metric-goal">
          <div class="goal-head">
            <span class="goal-label">Monthly goal</span>
            <span class="goal-fig">
              <b>{v.raisedShort}</b> <span class="goal-of">/ {v.goalShort}</span>
            </span>
          </div>
          <div class="goal-track">
            <div class="bar-fill" style={`width:${v.goalPct}%;`}></div>
          </div>
          <div class="goal-note">{v.remainingLabel} to reach your goal</div>
        </div>
      </div>

      {/* LOWER GRID */}
      <div class="lower">
        {/* LOVE NOTES */}
        <div class="notes-panel">
          <div class="notes-head">
            <span class="notes-title">Recent love notes</span>
            <a class="notes-seeall" href="/supporters">
              See all
            </a>
          </div>
          {v.isEmpty ? (
            <div class="notes-empty">
              <div class="notes-empty-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--brand)">
                  <path d={HEART_PATH} />
                </svg>
              </div>
              <div class="notes-empty-title">No love notes yet</div>
              <div class="notes-empty-sub">Share your link to get your first one.</div>
            </div>
          ) : (
            v.notes.map((note) => (
              <div class="note">
                <div class="avatar" style={`width:40px;height:40px;font-size:15px;background:${note.color};`}>
                  {note.initial}
                </div>
                <div style="flex:1;min-width:0;">
                  <div class="note-name">{note.name}</div>
                  {note.message && <div class="note-quote">“{note.message}”</div>}
                </div>
                <div class="note-right">
                  <div class="note-amount">{note.amountLabel}</div>
                  <div class="note-time">{note.timeAgo}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* UPGRADE NUDGE */}
        {!v.isByo && (
          <div class="nudge" id="nudge">
            <button class="nudge-close" id="nudgeClose" aria-label="Dismiss">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A8F7C" stroke-width="2" stroke-linecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            <div class="nudge-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
                <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
              </svg>
            </div>
            <div class="nudge-title">Keep 100% of your love</div>
            <div class="nudge-body">
              You're growing fast. Connect your own Paystack or Stripe and we'll stop taking a fee — page, link, and
              supporters stay exactly as they are.
            </div>
            <a class="nudge-cta" href="/connect">
              Connect a processor
            </a>
            <div class="nudge-foot">You can switch anytime.</div>
          </div>
        )}
      </div>
    </Shell>
  )
}

/* --------------------------------------------------------------- supporters */

export function SupportersPage(props: {
  creator: Creator
  count: number
  raisedLabel: string
  notes: PresentedNote[]
}) {
  const { creator, count, raisedLabel, notes } = props
  return (
    <Shell title="showmelove — Supporters" pageCss="supporters.css" creator={creator} active="supporters">
      <div class="supporters-wrap">
        <div class="supporters-head">
          <h1 class="supporters-title">Supporters</h1>
          <p class="supporters-sub">
            {count} {count === 1 ? 'supporter' : 'supporters'} · {raisedLabel} received
          </p>
        </div>

        {notes.length ? (
          <div class="supporter-list">
            {notes.map((note) => (
              <div class="supporter-card">
                <div class="avatar" style={`width:44px;height:44px;font-size:17px;background:${note.color};`}>
                  {note.initial}
                </div>
                <div class="supporter-body">
                  <div class="supporter-line">
                    <span class="supporter-name">{note.name}</span>
                    <span class="supporter-amount">{note.amountLabel}</span>
                  </div>
                  <div class="supporter-time">{note.timeAgo}</div>
                  {note.message && <p class="supporter-message">{note.message}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div class="supporters-empty">
            <div class="supporters-empty-icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="var(--brand)">
                <path d={HEART_PATH} />
              </svg>
            </div>
            <div class="supporters-empty-title">No supporters yet</div>
            <div class="supporters-empty-sub">Share your page and your first love note will land here.</div>
            <a class="btn-primary" href="/dashboard" style="display:inline-flex;align-items:center;margin-top:18px;">
              Back to dashboard
            </a>
          </div>
        )}
      </div>
    </Shell>
  )
}

/* ----------------------------------------------------------------- settings */

export function SettingsPage(props: {
  shared: Shared
  creator: Creator
  currencies: string[]
  palette: string[]
  saved?: string | null
  error?: string | null
}) {
  const { shared, creator, currencies, palette } = props
  return (
    <Shell title="showmelove — Settings" pageCss="settings.css" creator={creator} active="settings">
      <div class="settings-wrap">
        <h1 class="settings-title">Settings</h1>
        <p class="settings-sub">Update your page details — changes go live immediately.</p>

        <Flash saved={props.saved} error={props.error} />

        <form method="post" action="/settings" class="settings-card">
          <label class="field-label">Display name</label>
          <input class="text-input" name="displayName" value={creator.displayName} required />

          <label class="field-label" style="margin-top:18px;">
            Your link
          </label>
          <div class="link-input">
            <span class="link-prefix">{shared.siteHost}/</span>
            <input class="link-handle" name="handle" value={creator.handle} required />
          </div>

          <label class="field-label" style="margin-top:18px;">
            Short bio
          </label>
          <textarea class="textarea" name="bio" rows={3} maxlength={280}>
            {creator.bio || ''}
          </textarea>

          <div class="field-row">
            <div class="field-col">
              <label class="field-label">Currency</label>
              <select class="select" name="currency">
                {currencies.map((cur) => (
                  <option value={cur} selected={creator.currency === cur}>
                    {cur}
                  </option>
                ))}
              </select>
            </div>
            <div class="field-col">
              <label class="field-label">Monthly goal</label>
              <input class="text-input" name="monthlyGoal" inputmode="numeric" value={String(creator.monthlyGoal)} />
            </div>
          </div>

          <label class="field-label" style="margin-top:18px;">
            Brand color
          </label>
          <div class="brand-swatches">
            {palette.map((p) => (
              <label class="brand-swatch-opt">
                <input type="radio" name="brandColor" value={p} checked={creator.brandColor === p} />
                <span style={`background:${p};`}></span>
              </label>
            ))}
          </div>

          <div class="settings-payout">
            Payout mode: <b>{creator.payoutMode === 'byo' ? 'Bring-your-own (0% fee)' : 'Managed payouts'}</b> ·{' '}
            <a href="/connect">manage payouts</a>
          </div>

          <button class="btn-primary settings-save" type="submit">
            Save changes
          </button>
        </form>
      </div>
    </Shell>
  )
}

/* ------------------------------------------------------------------ payouts */

export interface PayoutsProps {
  creator: Creator
  isManaged: boolean
  khaimeConfigured: boolean
  sym: string
  grossLabel: string
  netLabel: string
  commissionPct: number
  payoutMethod: 'bank' | 'stripe'
  payoutStatus: Creator['payoutStatus']
  payoutReady: boolean
  settlementCurrency: string | null
  banks: string[]
  stripeDone: boolean
  saved?: string | null
  error?: string | null
}

export function PayoutsPage(p: PayoutsProps) {
  const { creator, payoutStatus, payoutMethod, settlementCurrency, sym } = p
  const form = (
    <PayoutMethodForm payoutMethod={payoutMethod} banks={p.banks} creator={creator} payoutStatus={payoutStatus} />
  )
  return (
    <Shell title="showmelove — Payouts" pageCss="payouts.css" creator={creator} active="payouts">
      <div class="payouts-wrap">
        <h1 class="payouts-title">Payouts</h1>

        <Flash saved={p.saved} error={p.error} />
        {p.stripeDone && <div class="flash flash-ok">Thanks — we're finalizing your USD payout account.</div>}

        {p.isManaged ? (
          <>
            {/* ===== MANAGED PAYOUTS ===== */}
            <div class="balance-card">
              <div class="balance-label">Available to pay out</div>
              <div class="balance-value">{p.netLabel}</div>
              <div class="balance-sub">
                {p.grossLabel} received · after a {p.commissionPct}% platform fee
              </div>
            </div>

            {!p.khaimeConfigured && (
              <div class="note-card">
                Managed payouts aren't enabled in this environment yet — the flow below is wired and ready once it's
                configured.
              </div>
            )}

            {/* How you get paid */}
            <div class="panel">
              <div class="panel-head">
                <span class="panel-title">How you get paid</span>
                {payoutStatus === 'ready' ? (
                  <span class="kyc-badge is-ok">connected{settlementCurrency ? ' · ' + settlementCurrency : ''}</span>
                ) : payoutStatus === 'action_needed' ? (
                  <span class="kyc-badge is-warn">action needed</span>
                ) : payoutStatus === 'pending' ? (
                  <span class="kyc-badge is-pending">verifying…</span>
                ) : null}
              </div>

              {payoutStatus === 'ready' ? (
                <>
                  <p class="panel-note is-ok">
                    ✓ You're all set —{' '}
                    {payoutMethod === 'bank'
                      ? 'paid straight to your local bank'
                      : creator.currency + ' payouts are set up'}
                    {settlementCurrency ? ', settling in ' + settlementCurrency : ''}. You can withdraw below.
                  </p>
                  <details class="update-method">
                    <summary>Update payout details</summary>
                    {form}
                  </details>
                </>
              ) : (
                <>
                  {payoutStatus === 'pending' ? (
                    <p class="panel-note">
                      We've received your details and are verifying them. This can take a few minutes; we'll mark this{' '}
                      <b>connected</b> once it's done. Refresh to check.
                    </p>
                  ) : payoutStatus === 'action_needed' ? (
                    <p class="panel-note">
                      We need a little more information before your payouts can go live.{' '}
                      {payoutMethod === 'bank' ? 'Re-check your bank details below.' : 'Continue the setup below.'}
                    </p>
                  ) : payoutMethod === 'bank' ? (
                    <p class="panel-note">
                      You earn in{' '}
                      <b>
                        {sym} {creator.currency}
                      </b>
                      , so you're paid straight to your local bank. Enter your details and we'll verify and set
                      everything up.
                    </p>
                  ) : (
                    <p class="panel-note">
                      You earn in{' '}
                      <b>
                        {sym} {creator.currency}
                      </b>
                      , so you're paid into a secure payout account. You'll be redirected to a short, one-time setup —
                      we handle the rest.
                    </p>
                  )}
                  {form}
                </>
              )}
            </div>

            {/* Withdraw */}
            <div class="panel">
              <div class="panel-head">
                <span class="panel-title">Withdraw</span>
                {!p.payoutReady && <span class="kyc-badge">add a method first</span>}
              </div>
              {p.payoutReady ? (
                <>
                  <p class="panel-note">
                    Move money from your wallet to your payout account. Requests are reviewed before settlement.
                  </p>
                  <form method="post" action="/payouts/request" class="payout-request">
                    <div class="amount-field">
                      <span class="amount-sym">{sym}</span>
                      <input class="text-input" name="amount" inputmode="numeric" placeholder="0" />
                    </div>
                    <button class="btn-primary" type="submit">
                      Request payout
                    </button>
                  </form>
                </>
              ) : (
                <p class="panel-note">Set up a payout method above, then you can withdraw here.</p>
              )}
            </div>

            <div class="payouts-foot">
              Prefer to keep 100%? <a href="/connect">Bring your own processor</a> instead.
            </div>
          </>
        ) : (
          <>
            {/* ===== BRING-YOUR-OWN ===== */}
            <div class="balance-card">
              <div class="balance-label">Bring-your-own</div>
              <div class="balance-value">{p.grossLabel}</div>
              <div class="balance-sub">
                You keep 100%. Support settles through your own {creator.processor === 'stripe' ? 'Stripe' : 'Paystack'}{' '}
                account — showmelove doesn't hold your funds.
              </div>
            </div>
            <div class="panel">
              <div class="panel-head">
                <span class="panel-title">Your processor</span>
              </div>
              <p class="panel-note">
                Payouts are handled by your connected processor. Manage or switch it on the connect page.
              </p>
              <a class="btn-primary" href="/connect" style="display:inline-flex;align-items:center;">
                Manage processor
              </a>
            </div>
            <div class="payouts-foot">
              Want us to handle settlement instead? <a href="/connect">Switch to managed payouts</a>.
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}
