import type { CreatorView } from '../../services/creator_presenter'
import { Brand, Document, HEART_PATH, type Shared } from '../layout'
import { Menu } from '../partials'

/** Port of pages/support.edge: the public creator page at /:handle. */
export function SupportPage({ shared, v }: { shared: Shared; v: CreatorView }) {
  const c = v.creator
  return (
    <Document title={`${c.displayName} — showmelove`} pageCss="support.css" brandColor={c.brandColor}>
      <div class="page">
        <div class="wrap">
          {/* TOP BAR */}
          <header class="nav-bar">
            <Brand />
            <div class="nav-links">
              <Menu {...shared} />
            </div>
          </header>

          {/* HERO */}
          <section class="hero">
            <div class="hero-cover">
              <div class="img-slot img-cover">Cover image</div>
              <div class="hero-cover-shade"></div>
            </div>
            <div class="hero-foot">
              <div class="hero-row">
                <div class="hero-avatar">
                  <div class="img-slot">Photo</div>
                </div>
                <div class="hero-id">
                  <div class="hero-eyebrow">Creator{c.location ? ' · ' + c.location : ''}</div>
                  <h1 class="hero-name">{c.displayName}</h1>
                  <div class="hero-handle">{'@' + c.handle}</div>
                </div>
                <div class="hero-stats">
                  <div class="hero-stat">
                    <div class="hero-stat-num">{v.supporters}</div>
                    <div class="hero-stat-lbl">supporters</div>
                  </div>
                  <div class="hero-stat">
                    <div class="hero-stat-num">{v.raisedShort}</div>
                    <div class="hero-stat-lbl">this month</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* BODY */}
          <div class="body-grid">
            {/* LEFT */}
            <div class="col-left">
              {c.bio && (
                <>
                  <div class="story-eyebrow">The story</div>
                  <p class="story-lead">{c.bio}</p>
                </>
              )}

              {/* GOAL */}
              <div class="goal-card">
                <div class="goal-card-head">
                  <div>
                    <div class="goal-card-label">Monthly goal</div>
                    <div class="goal-card-fig">
                      {v.raisedLabel} <span class="goal-card-of">/ {v.goalLabel}</span>
                    </div>
                  </div>
                  <div class="goal-card-pct">{v.goalPct}% there</div>
                </div>
                <div class="goal-card-track">
                  <div class="bar-fill" style={`width:${v.goalPct}%;`}></div>
                </div>
              </div>

              {/* LOVE NOTES */}
              <div class="notes-title-row">
                <span class="notes-h">Love notes</span>
                <span class="notes-count">{v.supporters}</span>
              </div>
              <div class="notes-grid">
                {v.notes.map((note) => (
                  <div class="note-card">
                    <div class="note-card-head">
                      <div class="avatar" style={`width:36px;height:36px;font-size:15px;background:${note.color};`}>
                        {note.initial}
                      </div>
                      <div style="flex:1;min-width:0;">
                        <div class="note-card-name">{note.name}</div>
                        <div class="note-card-time">{note.timeAgo}</div>
                      </div>
                      <div class="note-card-amount">{note.amountLabel}</div>
                    </div>
                    {note.message && <div class="note-card-quote">{note.message}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — SUPPORT CARD */}
            <aside class="support-card" data-handle={c.handle} data-sym={v.sym} data-currency={c.currency}>
              {/* STATE: FORM */}
              <div id="supportForm">
                <div class="support-head">
                  <svg width="22" height="22" viewBox="0 0 24 24" style="fill:var(--brand)">
                    <path d={HEART_PATH} />
                  </svg>
                  <h2 class="support-title">Show {c.displayName.split(' ')[0]} some love</h2>
                </div>
                <div class="support-sub">Pick an amount — or give what feels right.</div>

                {!v.isByo && (
                  <div class="freq" role="tablist">
                    <button class="freq-btn is-active" data-freq="once">
                      Once
                    </button>
                    <button class="freq-btn" data-freq="monthly">
                      Monthly
                    </button>
                  </div>
                )}

                <div class="amounts" id="amounts"></div>

                <div class="custom">
                  <span class="custom-naira">{v.sym}</span>
                  <input id="customInput" inputmode="numeric" placeholder="Other amount" class="custom-input" />
                </div>

                {!v.isByo && c.currency !== 'USD' && (
                  <div class="freq pay-in" role="tablist" aria-label="Pay in">
                    <button class="freq-btn pay-btn is-active" data-pay={c.currency}>
                      Pay in {c.currency}
                    </button>
                    <button class="freq-btn pay-btn" data-pay="USD">
                      Pay in USD
                    </button>
                  </div>
                )}

                <input
                  id="supportName"
                  class="message"
                  placeholder="Your name (optional — leave blank to stay anonymous)"
                  autocomplete="name"
                  maxlength={40}
                  style="margin-bottom:12px;"
                />
                <input
                  id="supportEmail"
                  class="message"
                  type="email"
                  placeholder="Email (for your receipt)"
                  autocomplete="email"
                  maxlength={120}
                  style="margin-bottom:12px;"
                />
                <input id="supportMessage" class="message" placeholder="Say something nice (optional)" maxlength={280} />

                <button class="support-cta" id="supportCta">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff">
                    <path d={HEART_PATH} />
                  </svg>
                  <span id="ctaLabel">Send your love</span>
                </button>
                <div class="secure">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8A7F6B"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Secure payment
                </div>
              </div>

              {/* STATE: PROCESSING */}
              <div id="supportProcessing" class="support-state" hidden>
                <div class="state-spinner"></div>
                <div class="state-title">Sending your love…</div>
                <div class="state-sub">Confirming your payment securely. Hang tight.</div>
              </div>

              {/* STATE: PAYMENT (Stripe Elements) */}
              <div id="supportPayment" class="support-state" hidden>
                <div class="state-title">Complete your payment</div>
                <div class="state-sub">Enter your card to send your support securely.</div>
                <div id="payment-element"></div>
                <div id="payError" class="pay-error" hidden></div>
                <button class="support-cta state-action" id="payNow">
                  <span id="payLabel">Pay now</span>
                </button>
                <button class="pay-cancel" id="payCancel">
                  Cancel
                </button>
              </div>

              {/* STATE: SUCCESS */}
              <div id="supportSuccess" class="support-state" hidden>
                <div class="state-badge state-badge-ok">
                  <svg
                    width="34"
                    height="34"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    stroke-width="2.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <div class="state-title">Love sent! 🧡</div>
                <div class="state-sub" id="successSub">
                  {c.displayName} just got your support. Thank you for backing the work.
                </div>
                <button class="btn-outline state-action" id="sendAnother">
                  Send more love
                </button>
              </div>

              {/* STATE: ERROR */}
              <div id="supportError" class="support-state" hidden>
                <div class="state-badge state-badge-err">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 8v5M12 16.5v.5" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </div>
                <div class="state-title">Payment didn't go through</div>
                <div class="state-sub" id="errorSub">
                  No money left your account. This happens sometimes — give it another try.
                </div>
                <button class="support-cta state-action" id="retryPay">
                  Try again
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <script src="https://js.stripe.com/v3/"></script>
      <script src="/assets/support.js"></script>
    </Document>
  )
}
