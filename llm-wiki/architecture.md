# Architecture

## Surfaces and routing

One Cloudflare Worker serves everything. Static files under `public/` (CSS,
client JS, fonts) are served by Workers Static Assets before the Worker runs;
every other request reaches `src/index.ts`. Pages are Hono JSX in
`src/views/`, rendered on the server; each page pulls its own stylesheet and
script from `public/assets` (no bundler for page JS).

`src/index.ts` mounts the route groups in order: `webhookRoutes`,
`authRoutes`, `landingRoutes`, `creatorArea`, then `publicRoutes`. The last
holds the public creator page, a catch-all (`GET /:handle`,
`POST /:handle/support`), so it is **mounted last**. Any new top-level route
must go above it, or `/:handle` swallows it and you get "Creator not found".

Each creator-area route takes `requireAuth` itself. Don't replace that with
`creatorArea.use('*', requireAuth)`: Hono runs a sub-app's `'*'` middleware
for every later route too, which would put `/:handle` behind login.

`src/app.ts` builds the global stack, in order: per-request services (`db`,
`auth`, `khaime` on `c.var`), security headers, CSRF, Better Auth at
`/api/auth/*`, then the current user. `/api/auth/*` (Better Auth checks origins
itself) and `/webhooks/*` (verified by signature, see payments.md) skip CSRF
and the session middleware. CSRF is Hono's `csrf()`: cross-site form posts are
rejected by Origin / Sec-Fetch-Site, and all client JS posts JSON, which can't
cross sites without a CORS preflight. `onError` must pass `HTTPException`
through, or `csrf()`'s 403 becomes a 500.

## Auth and the creator lifecycle

Better Auth (email and password, `autoSignIn`) is created per request
(`src/lib/auth.ts`) because bindings only exist per request. It gets the D1
binding directly and uses its built-in D1 dialect; its tables (`user`,
`session`, `account`, `verification`) are in migration 0001 alongside the app's.
`APP_KEY` is its secret: change it and every session cookie stops validating.
Verification and reset emails go through Brevo (`src/lib/email.ts`); with no
`BREVO_API_KEY` they are printed to the Worker log, which is how local auth
works. The auth forms (`public/assets/auth.js`, `auth-reset.js`) validate in
the browser and map Better Auth error codes to plain messages; never show its
raw messages.

`src/middleware/current_user.ts` runs on every non-exempt request. It resolves
the session, then:

1. `ensureCreatorFor(db, user)` creates the user's creator on first sight, with
   defaults: NGN, ₦100,000 monthly goal, `payoutMode: 'managed'`, and a handle
   slugified from the name or email. D1 has no interactive transactions, so a
   taken handle is detected by the unique index (insert, catch, try the next
   number) rather than "find a free one, then insert".
2. For managed creators without one, `khaime.ensureMerchant` provisions a Khaime
   sub-merchant (awaited, so the page that triggers it sees the id). Failures
   are logged as a warning, never thrown, so a Khaime outage never blocks a
   page load; the creator just has no `khaimeMerchantId` yet.

It sets `c.var.user`, `c.var.creator`, and `c.var.origin` / `c.var.siteHost`
for page links (no hardcoded host).

## Payout modes

`creators.payout_mode` is the "invisible fork" from the PRD:

- `managed` (default): Khaime collects and pays out. Everything in payments.md
  applies.
- `byo`: set via `/connect` with a `processor` of `paystack` or `stripe`;
  `/connect/reset` goes back to managed. Charging is not built, so supporters
  get a 402. The landing page marks it "coming soon" with no link.

The payout rail for a managed creator follows the creator's currency
(`src/routes/creator_area.tsx`): African currencies (`NGN GHS KES ZAR TZS XAF
XOF`) pay out to a local bank, everything else through a Khaime-managed Stripe
Connect account.

## Branding

Each creator has a `brand_color`; the server renders it as `--brand` on every
page that belongs to them. The floating picker (`public/assets/theme.js`)
appears only on the creator's own pages (`body[data-brand-save="1"]`) and saves
picks with `POST /brand`. Visitors never see it.

## Data model

D1 database `showmelove`; DDL in `migrations/` (apply with
`npm run db:migrate:local` / `:remote`), Drizzle types in `src/db/schema.ts`.
Timestamps are text, `YYYY-MM-DD HH:MM:SS` UTC (what `CURRENT_TIMESTAMP` writes).

- `creators`: owner `user_id` (Better Auth id), `handle` (unique), `currency`
  and `currency_symbol`, `monthly_goal` (major units), `brand_color`,
  `payout_mode`, `processor`, and the Khaime state: `khaime_merchant_id`,
  `payout_status` (`null`, `pending`, `action_needed`, `ready`),
  `payout_provider` (`bank`/`stripe`), `settlement_currency`,
  `stripe_account_id`.
- `supports`: one tip. `amount` and `currency` are what the creator is owed, in
  major units of the creator's currency. `charge_amount` and `charge_currency`
  are what the supporter paid (minor units). `status` is `pending`,
  `succeeded` or `failed`. `reference` is the `sml_…` partner reference sent to
  Khaime. `khaime_split` holds the marketplace split as JSON.
  `khaime_transaction_id` (migration 0002) lets the Cron look the payment up.

`payout_status` is persisted so pages can render payout state without a live
Khaime call; `/payouts` and `account.updated` refresh it.

## Deploy

`npx wrangler deploy` uploads the Worker and `public/`, binds D1, attaches the
custom domain and the Cron. Apply migrations to the remote database first
(`npm run db:migrate:remote`). Secrets are `wrangler secret`s; non-secret
config is `vars` in `wrangler.jsonc`. Staging is
https://showmelove.kreativekorna.com on Khaime's dev API. D1 is managed and
backed up by Cloudflare (Time Travel); there is no volume to lose.
