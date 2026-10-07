import type { Creator } from '../../db/schema'
import { Brand, Document, type Shared } from '../layout'

/** Ports of pages/setup.edge (the setup wizard) and pages/connect.edge (bring your own processor). */

const CHECK = (
  <svg
    width="38"
    height="38"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    stroke-width="2.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export function SetupPage({ shared, creator }: { shared: Shared; creator: Creator }) {
  return (
    <Document
      title="showmelove — Set up your page"
      pageCss="setup.css"
      brandColor={creator.brandColor}
      body={{ 'data-brand-save': '1' }}
    >
      <div class="page" id="page">
        <div class="shell">
          <header class="topbar">
            <Brand />
            <a class="save-exit" href="/dashboard">
              Save &amp; exit
            </a>
          </header>

          <div class="card">
            {/* STEP RAIL */}
            <aside class="rail">
              <div class="rail-eyebrow">Set up your page</div>
              <div class="rail-title">Live in under a minute.</div>
              <div class="rail-steps" id="railSteps"></div>
              <div class="rail-spacer"></div>
              <div class="rail-foot">
                <svg width="15" height="15" viewBox="0 0 24 24" class="rail-foot-heart">
                  <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.3 4 2.5.8-1.2 2-2.5 4-2.5 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21Z" />
                </svg>
                Join 4,000+ Nigerian creators
              </div>
            </aside>

            {/* CONTENT */}
            <section class="content" data-paymode={creator.payoutMode}>
              {/* STEP 1 */}
              <div class="step" data-step="1">
                <div class="step-body" style="max-width:440px;">
                  <h1 class="h1">Claim your page</h1>
                  <p class="lede">Pick a name and a link. You can change both later.</p>
                  <label class="field-label">Display name</label>
                  <input id="suName" class="text-input" value={creator.displayName} style="margin-bottom:22px;" />
                  <label class="field-label">Your link</label>
                  <div class="link-input">
                    <span class="link-prefix">{shared.siteHost}/</span>
                    <input id="suHandle" class="link-handle" value={creator.handle} />
                  </div>
                  <div class="setup-error" id="setupError"></div>
                </div>
              </div>

              {/* STEP 2 */}
              <div class="step" data-step="2">
                <div class="step-body" style="max-width:480px;">
                  <h1 class="h1">Make it yours</h1>
                  <p class="lede">A photo and a line about you go a long way.</p>
                  <div class="avatar-row">
                    <div class="avatar-drop">
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#1C1714"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M3 8a2 2 0 0 1 2-2h1.5l1-1.5h5l1 1.5H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
                        <circle cx="12" cy="12.5" r="3.2" />
                      </svg>
                    </div>
                    <button class="btn-pop">Add photo</button>
                  </div>
                  <label class="field-label">Short bio</label>
                  <textarea id="suBio" class="textarea" rows={3}>
                    {creator.bio || ''}
                  </textarea>
                  <div class="field-row">
                    <div class="field-col">
                      <label class="field-label">Currency</label>
                      <select id="suCurrency" class="select">
                        <option value="NGN" selected={creator.currency === 'NGN'}>
                          ₦ NGN
                        </option>
                        <option value="USD" selected={creator.currency === 'USD'}>
                          $ USD
                        </option>
                        <option value="GBP" selected={creator.currency === 'GBP'}>
                          £ GBP
                        </option>
                      </select>
                    </div>
                    <div class="field-col">
                      <label class="field-label">Monthly goal</label>
                      <input
                        id="suGoal"
                        class="text-input"
                        value={`${creator.currencySymbol}${creator.monthlyGoal.toLocaleString('en-US')}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 3 */}
              <div class="step" data-step="3">
                <div class="step-body" style="max-width:520px;">
                  <h1 class="h1">Get paid</h1>
                  <p class="lede">Choose how support reaches you.</p>
                  <div class="payopt" data-pay="managed" id="optManaged">
                    <div class="payopt-head">
                      <span class="payopt-title">Managed payouts</span>
                      <span class="badge badge-brand">Recommended</span>
                    </div>
                    <div class="payopt-desc">
                      We handle everything. Settles to your bank automatically. One tap to start.
                    </div>
                  </div>
                  <div class="payopt" data-pay="byo" id="optByo">
                    <div class="payopt-head">
                      <span class="payopt-title">Connect your own processor</span>
                      <span class="badge badge-muted">0% fee</span>
                    </div>
                    <div class="payopt-desc">Already on Paystack or Stripe? Keep 100%, no platform fee.</div>
                    <div class="payopt-expand" id="byoExpand">
                      <a class="btn-outline" href="/connect" style="display:flex;align-items:center;justify-content:center;">
                        Connect Paystack
                      </a>
                      <a class="btn-outline" href="/connect" style="display:flex;align-items:center;justify-content:center;">
                        Connect Stripe
                      </a>
                    </div>
                  </div>
                  <div class="fineprint">You can switch anytime.</div>
                </div>
              </div>

              {/* FINISH */}
              <div class="step step-finish" data-step="4">
                <div class="finish-icon">{CHECK}</div>
                <div class="finish-title">Your page is live</div>
                <div class="finish-sub">Share this link anywhere to start collecting love.</div>
                <div class="finish-link" id="copyLink">
                  <span class="finish-link-text">
                    {shared.siteHost}/{creator.handle}
                  </span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--brand)"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                </div>
                <div class="finish-actions">
                  <a class="btn-primary" id="viewPage" href={`/${creator.handle}`} style="display:flex;align-items:center;">
                    View your page
                  </a>
                  <a class="btn-outline" href="/dashboard" style="display:flex;align-items:center;">
                    Go to dashboard
                  </a>
                  <button class="btn-outline" id="restart">
                    Start over
                  </button>
                </div>
              </div>

              {/* NAV */}
              <div class="nav" id="nav">
                <button class="btn-outline" id="back">
                  Back
                </button>
                <button class="btn-primary btn-next" id="next">
                  Next
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
      <script src="/assets/setup.js"></script>
    </Document>
  )
}

export function ConnectPage({ creator }: { creator: Creator }) {
  const isByo = creator.payoutMode === 'byo'
  return (
    <Document
      title="showmelove — Connect a processor"
      pageCss="connect.css"
      brandColor={creator.brandColor}
      body={{ 'data-brand-save': '1' }}
    >
      <div class="page">
        <div class="wrap">
          {/* TOP BAR */}
          <header class="topbar">
            <Brand />
            <a class="back-link" href="/dashboard">
              ← Back to dashboard
            </a>
          </header>

          <div class="head-block">
            <span class="eyebrow badge badge-muted">
              Current mode · {isByo ? 'Bring-your-own' : 'Managed payouts'}
            </span>
            <h1 class="title">Connect your own processor</h1>
            <p class="subtitle">
              Already on Paystack or Stripe? Connect it and we'll stop taking a fee. Your page, link, and supporters stay
              exactly as they are.
            </p>
          </div>

          <div class="layout">
            {/* MAIN FLOW */}
            <main class="flow">
              {/* STAGE: SELECT */}
              <div id="stageSelect" hidden={isByo}>
                <div class="proc-grid">
                  <button class="proc" data-proc="paystack" id="procPaystack">
                    <div class="proc-logo" style="background:#011B33;">
                      P
                    </div>
                    <div class="proc-info">
                      <div class="proc-name">Paystack</div>
                      <div class="proc-meta">Popular in Nigeria · connect with API keys</div>
                    </div>
                    <div class="proc-check"></div>
                  </button>
                  <button class="proc" data-proc="stripe" id="procStripe">
                    <div class="proc-logo" style="background:#635BFF;">
                      S
                    </div>
                    <div class="proc-info">
                      <div class="proc-name">Stripe</div>
                      <div class="proc-meta">One-click secure OAuth connect</div>
                    </div>
                    <div class="proc-check"></div>
                  </button>
                </div>

                {/* PANEL: Paystack */}
                <div class="panel" id="panelPaystack" hidden>
                  <div class="panel-head">Connect Paystack</div>
                  <p class="panel-note">
                    Paste your API keys from the Paystack dashboard → Settings → API Keys &amp; Webhooks. We only store
                    what's needed to create charges on your account.
                  </p>
                  <label class="field-label">Public key</label>
                  <input class="text-input" id="psPublic" placeholder="pk_live_…" />
                  <label class="field-label" style="margin-top:16px;">
                    Secret key
                  </label>
                  <input class="text-input" id="psSecret" type="password" placeholder="sk_live_…" />
                  <button class="btn-primary connect-btn" id="connectPaystack">
                    Connect Paystack
                  </button>
                </div>

                {/* PANEL: Stripe */}
                <div class="panel" id="panelStripe" hidden>
                  <div class="panel-head">Connect Stripe</div>
                  <p class="panel-note">
                    You'll be redirected to Stripe to authorize showmelove. No keys to copy — Stripe hands us a scoped
                    connection and you come right back.
                  </p>
                  <button class="btn-primary connect-btn" id="connectStripe">
                    Continue to Stripe
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      style="margin-left:8px;"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>

                <div class="empty-hint" id="emptyHint">
                  Pick a processor above to continue.
                </div>
              </div>

              {/* STAGE: CONNECTING */}
              <div id="stageConnecting" class="stage-center" hidden>
                <div class="spinner"></div>
                <div class="stage-title" id="connectingTitle">
                  Connecting…
                </div>
                <div class="stage-sub">Securely linking your account. This only takes a moment.</div>
              </div>

              {/* STAGE: CONNECTED */}
              <div id="stageConnected" class="stage-center" hidden={!isByo}>
                <div class="connected-icon">{CHECK}</div>
                <div class="stage-title" id="connectedTitle">
                  {creator.processor === 'stripe' ? 'Stripe' : 'Paystack'} connected
                </div>
                <div class="stage-sub">
                  You're now keeping <strong>100%</strong> of your support. Funds settle straight to your processor.
                </div>
                <div class="fee-flip">
                  <span class="fee-was">Platform fee</span>
                  <span class="fee-now">0%</span>
                </div>
                <div class="connected-actions">
                  <a class="btn-primary" href="/dashboard" style="display:flex;align-items:center;">
                    Go to dashboard
                  </a>
                  <button class="btn-outline" id="switchBack">
                    Switch back to managed
                  </button>
                </div>
              </div>
            </main>

            {/* SIDEBAR */}
            <aside class="aside">
              <div class="aside-card">
                <div class="aside-title">Why connect your own?</div>
                <ul class="aside-list">
                  <li>
                    <b>Keep 100%.</b> No platform fee on support.
                  </li>
                  <li>
                    <b>Nothing moves.</b> Same page, link, and supporters.
                  </li>
                  <li>
                    <b>Switch anytime.</b> Go back to managed in one tap.
                  </li>
                </ul>
              </div>
              <div class="aside-card aside-card-dark">
                <div class="aside-title" style="color:#fff;">
                  Heads up
                </div>
                <p class="aside-body">
                  Bring-your-own pages are <b>one-time only</b> in v1 — monthly support stays on managed payouts. You can
                  keep both modes in mind as you grow.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <script src="/assets/connect.js"></script>
    </Document>
  )
}
