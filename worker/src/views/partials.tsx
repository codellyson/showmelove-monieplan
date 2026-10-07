import type { Creator } from '../db/schema'
import { HEART_PATH, type Shared } from './layout'

/** Port of partials/menu.edge: account dropdown, or log in / sign up links for guests. */
export function Menu({ user, creator }: Shared) {
  if (!user) {
    return (
      <>
        <a class="nav-link" href="/login">
          Log in
        </a>
        <a class="btn-pill" href="/register">
          Start your page
        </a>
      </>
    )
  }
  const label = creator ? creator.displayName : user.name || user.email
  return (
    <div class="acct" data-menu="">
      <button class="acct-btn" type="button" data-menu-toggle="">
        <span class="acct-avatar">{label.charAt(0).toUpperCase()}</span>
        <span class="acct-name">{label}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div class="acct-menu" hidden>
        <a href="/dashboard">Dashboard</a>
        {creator && <a href={`/${creator.handle}`}>My page</a>}
        <a href="/connect">Connect a processor</a>
        <a href="/settings">Settings</a>
        <form method="post" action="/logout">
          <button type="submit" class="acct-signout">
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}

export type NavKey = 'home' | 'supporters' | 'payouts' | 'settings'

const ICON = {
  width: '18',
  height: '18',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.9',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
}

/** Port of partials/sidebar.edge: the app-shell sidebar for the signed-in creator area. */
export function Sidebar({ creator, active }: { creator: Creator; active: NavKey }) {
  const item = (key: NavKey) => `nav-item ${active === key ? 'is-active' : ''}`
  return (
    <aside class="side">
      <a class="side-brand brand" href="/">
        <div class="brand-mark">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff">
            <path d={HEART_PATH} />
          </svg>
        </div>
        <span class="brand-name" style="font-size:19px;">
          showmelove
        </span>
      </a>
      <nav class="side-nav">
        <a class={item('home')} href="/dashboard">
          <svg {...ICON}>
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10h14V10" />
          </svg>
          <span>Home</span>
        </a>
        <a class={item('supporters')} href="/supporters">
          <svg {...ICON}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          </svg>
          <span>Supporters</span>
        </a>
        <a class={item('payouts')} href="/payouts">
          <svg {...ICON}>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
          <span>Payouts</span>
        </a>
        <a class={item('settings')} href="/settings">
          <svg {...ICON}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </a>
      </nav>
      <div class="side-spacer"></div>
      <div class="side-user">
        <div class="avatar" style="width:38px;height:38px;background:var(--brand);font-size:14px;">
          {creator.displayName.charAt(0).toUpperCase()}
        </div>
        <div style="min-width:0;flex:1;">
          <div class="side-user-name">{creator.displayName}</div>
          <div class="side-user-handle">{'@' + creator.handle}</div>
        </div>
        <form method="post" action="/logout">
          <button type="submit" class="side-signout" title="Sign out" aria-label="Sign out">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8A7F6B"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  )
}

/** Port of partials/payout_method_form.edge. */
export function PayoutMethodForm(props: {
  payoutMethod: 'bank' | 'stripe'
  banks: string[]
  creator: Creator
  payoutStatus: Creator['payoutStatus']
}) {
  const { payoutMethod, banks, creator, payoutStatus } = props
  if (payoutMethod === 'bank') {
    return (
      <form method="post" action="/payouts/bank" class="grid2">
        <div class="span2">
          <label class="field-label">Bank</label>
          <select class="select" name="settlement_bank">
            {banks.map((b) => (
              <option value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <label class="field-label">Account number</label>
          <input class="text-input" name="account_number" inputmode="numeric" required />
        </div>
        <div>
          <label class="field-label">Account name</label>
          <input class="text-input" name="account_name" required />
        </div>
        <div class="span2">
          <button class="btn-primary" type="submit">
            Save payout bank
          </button>
        </div>
      </form>
    )
  }
  const started = payoutStatus === 'pending' || payoutStatus === 'action_needed'
  return (
    <form method="post" action="/payouts/stripe">
      <button class="btn-primary" type="submit">
        {started ? `Continue ${creator.currency} setup` : `Set up ${creator.currency} payouts`}
      </button>
    </form>
  )
}
