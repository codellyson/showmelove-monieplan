# Architecture

## Surfaces and routing

One AdonisJS app serves everything (`start/routes.ts`): the landing page, the
auth pages, the signed-in creator area, the public creator page, and the Khaime
webhook. Views are Edge templates in `resources/views/pages`; each page pulls
its own stylesheet and script from `public/assets` (no bundler for page JS).

The public creator page is a catch-all, `GET /:handle` and
`POST /:handle/support`, so it is **registered last**. Any new top-level route
must go above it, or `/:handle` swallows it and you get "Creator not found".

`/webhooks/khaime` is outside auth and CSRF: it is verified by signature
instead (see payments.md).

## Auth and the creator lifecycle

Better Auth (email and password, `autoSignIn`) is mounted at `/api/auth/*`
through a small adapter (`app/lib/auth_http.ts`) that converts between Adonis
and Web `Request`/`Response`. It keeps its own tables in the same SQLite file,
opened with its own `better-sqlite3` connection (`app/lib/auth.ts`); its schema
is migrated by `bin/migrate-auth.ts`, separately from Lucid migrations.
Verification and reset emails go through Brevo (`app/lib/email.ts`); with no
`BREVO_API_KEY` they are printed to the server console, which is how local auth
works.

`current_user_middleware.ts` runs on every routed request. It resolves the
session, then:

1. `ensureCreatorFor(user)` creates the user's `Creator` on first sight, with
   defaults: NGN, ₦100,000 monthly goal, `payoutMode: 'managed'`, and a handle
   slugified from the name or email (numbered on collision).
2. For managed creators without one, `khaime.ensureMerchant` provisions a Khaime
   sub-merchant. Failures are logged, not thrown, so a Khaime outage never
   blocks a page load; the creator just has no `khaimeMerchantId` yet.

Both are shared with views as `user` and `creator`. Protected pages use
`middleware.auth()`.

## Payout modes

`Creator.payoutMode` is the "invisible fork" from the PRD:

- `managed` (default): Khaime collects and pays out. Everything in payments.md
  applies.
- `byo`: set via `/connect` with a `processor` of `paystack` or `stripe`;
  `/connect/reset` goes back to managed. Charging is not built, so supporters
  get a 402.

The payout rail for a managed creator follows the creator's currency
(`payouts_controller.ts`): African currencies (`NGN GHS KES ZAR TZS XAF XOF`)
pay out to a local bank, everything else through a Khaime-managed Stripe
Connect account.

## Data model

Two Lucid models on SQLite (`tmp/db.sqlite3`; migrations numbered
`17000000000NN_*`):

- `Creator`: owner `userId` (Better Auth id), `handle`, `currency` and
  `currencySymbol`, `monthlyGoal` (major units), `brandColor`, `payoutMode`,
  `processor`, and the Khaime state: `khaimeMerchantId`, `payoutStatus`
  (`null`, `pending`, `action_needed`, `ready`), `payoutProvider`
  (`bank`/`stripe`), `settlementCurrency`, `stripeAccountId`.
- `Support`: one tip. `amount` and `currency` are what the creator is owed, in
  major units of the creator's currency. `chargeAmount` and `chargeCurrency`
  are what the supporter paid (minor units), set when they differ.
  `status` is `pending`, `succeeded` or `failed`. `reference` is the
  `sml_…` partner reference sent to Khaime. `khaimeSplit` holds the marketplace
  split from the webhook as JSON.

`payoutStatus` is persisted so pages can render payout state without a live
Khaime call; `/payouts` and `account.updated` refresh it.

## Deploy

`Dockerfile` (Node 22) plus `docker-entrypoint.sh`, built for Coolify. On boot
the entrypoint runs Lucid migrations, then Better Auth migrations, then the
server. `/app/tmp` is a volume because it holds the SQLite database; lose the
volume and you lose every creator and tip.
