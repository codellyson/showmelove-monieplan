import type { Creator } from '../../db/schema'
import type { CreatorView } from '../../services/creator_presenter'
import { Brand, Document, HEART_PATH, type Shared } from '../layout'
import { Menu } from '../partials'

export interface LandingProps {
  shared: Shared
  example: Creator | null
  stats: CreatorView | null
  platformCreators: number
  platformSupporters: number
  /** Managed-payout fee shown in the copy, from KHAIME_COMMISSION_RATE. */
  commissionPct: number
}

/** The marketing home. */
export function LandingPage(props: LandingProps) {
  const { shared, example, stats, platformCreators, platformSupporters, commissionPct } = props
  const exampleHref = example ? '/' + example.handle : '/setup'
  const proof = (stats?.notes ?? []).filter((note, i) => i < 3 && note.message)
  return (
    <Document
      title="showmelove — Tip jar for Nigerian creators, in Naira"
      description="A tip-jar page made for Naira. Go live in under a minute, share one link, and let fans send love in Naira or USD. Free to start."
      pageCss="landing.css"
      brandColor={example ? example.brandColor : null}
    >
      <div class="page">
        <div class="wrap">
          {/* NAV */}
          <header class="nav-bar">
            <Brand />
            <div class="nav-links">
              <a class="nav-link" href={exampleHref}>
                See an example
              </a>
              <Menu {...shared} />
            </div>
          </header>

          {/* HERO */}
          <section class="hero">
            <div class="hero-copy">
              <span class="eyebrow">Built for Nigerian creators · Naira-first</span>
              <h1 class="hero-title">
                Get paid by the people who <span class="hl">love</span> your work.
              </h1>
              <p class="hero-sub">
                A tip-jar page made for Naira. Claim your link, share it anywhere, and let fans send love in Naira or
                dollars, once or every month. No setup wall, no account for your supporters.
              </p>
              <div class="hero-cta">
                <a class="btn-primary btn-lg" href="/setup">
                  Start your page — free
                </a>
                <a class="btn-outline btn-lg" href={exampleHref}>
                  See a live page
                </a>
              </div>
              <div class="hero-stats">
                <div class="hstat">
                  <div class="hstat-num">{platformCreators.toLocaleString('en-US')}</div>
                  <div class="hstat-lbl">{platformCreators === 1 ? 'creator' : 'creators'}</div>
                </div>
                <div class="hstat-div"></div>
                <div class="hstat">
                  <div class="hstat-num">{platformSupporters.toLocaleString('en-US')}</div>
                  <div class="hstat-lbl">{platformSupporters === 1 ? 'supporter' : 'supporters'}</div>
                </div>
                <div class="hstat-div"></div>
                <div class="hstat">
                  <div class="hstat-num">&lt;60s</div>
                  <div class="hstat-lbl">to go live</div>
                </div>
              </div>
            </div>

            {/* HERO VISUAL: mini support card */}
            <div class="hero-art">
              <div class="mini-card mini-card-back">
                <div class="mini-note">
                  <div class="avatar" style="width:34px;height:34px;font-size:14px;background:var(--gold);">
                    K
                  </div>
                  <div style="flex:1;">
                    <div class="mini-note-name">Kemi</div>
                    <div class="mini-note-quote">"You earned it. 🧡"</div>
                  </div>
                  <div class="mini-amt">₦5,000</div>
                </div>
              </div>
              <div class="mini-card mini-card-front">
                <div class="mini-head">
                  <svg width="18" height="18" viewBox="0 0 24 24" style="fill:var(--brand)">
                    <path d={HEART_PATH} />
                  </svg>
                  <span>Show Ada some love</span>
                </div>
                <div class="mini-amts">
                  <span class="mini-chip">₦1,000</span>
                  <span class="mini-chip is-on">₦2,000</span>
                  <span class="mini-chip">₦5,000</span>
                </div>
                <div class="mini-send">Send ₦2,000 of love</div>
              </div>
            </div>
          </section>

          {/* VALUE PROPS */}
          <section class="props">
            <div class="prop">
              <div class="prop-emoji">🇳🇬</div>
              <h3 class="prop-title">Naira first, not Naira later</h3>
              <p class="prop-body">
                Your page, your goal and your payouts are in Naira by default. Fans abroad can pay in USD, and you still
                see it in Naira.
              </p>
            </div>
            <div class="prop">
              <div class="prop-emoji">⚡</div>
              <h3 class="prop-title">Live before your tea cools</h3>
              <p class="prop-body">
                Pick a name, claim <code>{shared.siteHost}/you</code>, add a line about your work. You're collecting
                support in under a minute.
              </p>
            </div>
            <div class="prop">
              <div class="prop-emoji">💌</div>
              <h3 class="prop-title">Every tip comes with a note</h3>
              <p class="prop-body">
                Supporters leave their name, or stay anonymous, plus a message. Your page shows the love, not just the
                numbers.
              </p>
            </div>
            <div class="prop">
              <div class="prop-emoji">🔁</div>
              <h3 class="prop-title">One-off or monthly</h3>
              <p class="prop-body">
                Fans can back you once or every month. Set a monthly goal and let everyone watch the bar fill.
              </p>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section class="how">
            <div class="section-head">
              <span class="section-eyebrow">How it works</span>
              <h2 class="section-title">Three steps to your first love note.</h2>
            </div>
            <div class="steps">
              <div class="how-step">
                <div class="how-num">1</div>
                <h3 class="how-title">Claim your page</h3>
                <p class="how-body">
                  Choose a display name and your <code>{shared.siteHost}/</code> link.
                </p>
              </div>
              <div class="how-step">
                <div class="how-num">2</div>
                <h3 class="how-title">Make it yours</h3>
                <p class="how-body">A short bio, your currency, a monthly goal and your brand colour.</p>
              </div>
              <div class="how-step">
                <div class="how-num">3</div>
                <h3 class="how-title">Share and get paid</h3>
                <p class="how-body">
                  Drop the link in your bio, your stories, your group chats. Payouts go straight to your local bank.
                </p>
              </div>
            </div>
          </section>

          {/* PAYOUT MODES */}
          <section class="modes">
            <div class="section-head">
              <span class="section-eyebrow">Two ways to get paid</span>
              <h2 class="section-title">One page. Your money, your way.</h2>
            </div>
            <div class="mode-cards">
              <div class="mode-card">
                <span class="badge badge-brand">Recommended</span>
                <h3 class="mode-title">Managed payouts</h3>
                <p class="mode-body">
                  We handle the payments. Support lands in your wallet, and you withdraw to your Nigerian bank when
                  you're ready. A small {commissionPct}% platform fee covers processing.
                </p>
                <ul class="mode-list">
                  <li>Start with one tap</li>
                  <li>Monthly support included</li>
                  <li>Withdraw to your local bank</li>
                </ul>
                <a class="btn-primary mode-cta" href="/setup">
                  Start managed
                </a>
              </div>
              <div class="mode-card mode-card-dark">
                <span class="badge badge-muted">Coming soon · 0% platform fee</span>
                <h3 class="mode-title">Bring your own processor</h3>
                <p class="mode-body">
                  Already on Paystack or Stripe? Soon you'll be able to connect it and keep 100% of every tip. Your page,
                  link and supporters stay exactly as they are.
                </p>
                <ul class="mode-list">
                  <li>0% platform fee</li>
                  <li>Funds settle to your own account</li>
                  <li>Switch anytime, no data lost</li>
                </ul>
                {/* Bring-your-own charging isn't built yet (it returns 402), so no link to switch to it. */}
                <span class="mode-soon">Coming soon</span>
              </div>
            </div>
          </section>

          {/* FOR SUPPORTERS */}
          <section class="fans">
            <div class="fans-card">
              <span class="section-eyebrow">For your supporters</span>
              <h2 class="fans-title">No account. No hassle.</h2>
              <p class="fans-body">
                Your fans pick an amount, add a note and pay by card or bank, in Naira or dollars. That's it.
              </p>
            </div>
          </section>

          {/* SOCIAL PROOF (real love notes from the database; hidden until there are some) */}
          {proof.length > 0 && (
            <section class="proof">
              <div class="section-head">
                <span class="section-eyebrow">Real love notes</span>
                <h2 class="section-title">Support that feels personal.</h2>
              </div>
              <div class="proof-grid">
                {proof.map((note) => (
                  <div class="proof-card">
                    <div class="proof-quote">“{note.message}”</div>
                    <div class="proof-foot">
                      <div class="avatar" style={`width:32px;height:32px;font-size:13px;background:${note.color};`}>
                        {note.initial}
                      </div>
                      <span class="proof-name">{note.name}</span>
                      <span class="proof-amt">{note.amountLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* FAQ */}
          <section class="faq">
            <div class="section-head">
              <span class="section-eyebrow">Questions</span>
              <h2 class="section-title">Good to know.</h2>
            </div>
            <div class="faq-list">
              <details class="faq-item">
                <summary>How much does it cost?</summary>
                <p>
                  Starting is free. On managed payouts we take a small fee ({commissionPct}%) from each tip, which covers
                  payment processing.
                </p>
              </details>
              <details class="faq-item">
                <summary>How do I get my money?</summary>
                <p>
                  Add your bank details on the Payouts page. Once they're verified, you can withdraw from your wallet.
                  Requests are reviewed before they settle.
                </p>
              </details>
              <details class="faq-item">
                <summary>Do my supporters need an account?</summary>
                <p>No. They just pay. They can leave their name, or stay anonymous.</p>
              </details>
              <details class="faq-item">
                <summary>Can fans outside Nigeria support me?</summary>
                <p>Yes. Supporters can choose to pay in USD.</p>
              </details>
              <details class="faq-item">
                <summary>Can I change my link later?</summary>
                <p>Yes, anytime from Settings.</p>
              </details>
            </div>
          </section>

          {/* FINAL CTA */}
          <section class="cta-band">
            <h2 class="cta-title">Your work is worth supporting.</h2>
            <p class="cta-sub">Set up your page in under a minute. It's free to start.</p>
            <a class="btn-primary btn-lg" href="/setup">
              Start your page
            </a>
          </section>

          {/* FOOTER */}
          <footer class="footer">
            <div class="brand">
              <div class="brand-mark">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff">
                  <path d={HEART_PATH} />
                </svg>
              </div>
              <span class="brand-name" style="font-size:18px;">
                showmelove
              </span>
            </div>
            <div class="footer-links">
              <a href={exampleHref}>Explore</a>
              <a href="/setup">Start a page</a>
              <a href="/dashboard">Dashboard</a>
              <a href="/connect">Connect</a>
            </div>
            <div class="footer-note">Made for Nigerian creators · Naira-first</div>
          </footer>
        </div>
      </div>
    </Document>
  )
}
