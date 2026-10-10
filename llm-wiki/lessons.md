# Lessons (environment traps and practices)

## Running and deploying

- **Starting the app.** `.claude/launch.json` has a "showmelove" config
  (`npx wrangler dev`, port 8790); use the preview tool with that name rather
  than starting the server in a shell. If it is already up, reuse it. 8790,
  not 8787, because another `workerd` on this machine holds 8787.
- **A custom domain changes `wrangler dev`.** With `routes` set to
  `showmelove.kreativekorna.com`, local requests are rewritten to that host:
  pages show the production domain and Better Auth answers every local sign-in
  with `INVALID_ORIGIN`. The `dev` block in `wrangler.jsonc`
  (`host: localhost:8790`, `upstream_protocol: http`) keeps local requests local.
- **Changing `database_id` empties the local D1.** Local state is keyed by the
  id, so after changing it run `npm run db:migrate:local` again ("no such
  table: creators" otherwise).
- **Migrations are append-only.** `migrations/0001_init.sql` mirrors the
  original SQLite schema exactly so old data imports as plain `INSERT`s. Change
  the schema with a new numbered file; apply it locally and with
  `npm run db:migrate:remote` before deploying code that needs it.
- **`compatibility_date` is capped by the test runner.** The `workerd` bundled
  with `@cloudflare/vitest-pool-workers` lags wrangler's; a newer date fails
  every test with "requires compatibility date ... newest supported is ...".
  Keep `wrangler.jsonc` at or below what `npm test` accepts.
- **Secrets on deploy.** `wrangler deploy --secrets-file` can't read a pipe
  (`<(...)`): wrangler opens it after the shell closed it. Use a `mktemp` file
  under `umask 077`, removed by `trap ... EXIT`. Confirm with
  `wrangler secret list` that each shows `secret_text`, not a plain var.

## Secrets and data

- **Never print a secret.** `.dev.vars` (and the old AdonisJS `.env`, kept
  locally) hold live-looking keys. Check presence with patterns that print
  "(set)/(empty)", never values, and never `cat` those files.
- **Importing the old AdonisJS database needs column names.** Migration 0002
  added `supports.khaime_transaction_id`, so a column-less `INSERT ... VALUES`
  dump fails on `supports` and imports nothing. Use
  `sqlite3 -cmd ".headers on" -cmd ".mode insert <table>"` (README, "Importing
  the old database"). The old database is `tmp/db.sqlite3`, gitignored.
- **Better Auth on D1.** Pass the binding straight in (`database: env.DB`): its
  built-in D1 dialect writes ISO date text, matching the imported rows. Keep
  `APP_KEY` stable; it signs session cookies.

## Payments

- **Testing payments needs a payout-ready sub-merchant.** A creator only works
  end to end once its Khaime payout is configured. Setting up bank details is
  for the user to do; don't enter account numbers yourself.
- **Webhooks only reach the registered URL.** Khaime posts to the URL set for
  the partner key (Dashboard → Settings → API, which needs the user's login).
  Locally, or until that URL points at the Worker, tips are confirmed by the
  reconcile Cron (`GET /transactions/:id`) instead.
- **Unit mistakes are silent.** Khaime takes minor units, `/pricing/calculate`
  returns major units, `Support.amount` is major. A wrong conversion still
  produces a valid-looking charge; check the amount on the Khaime side.
- **Khaime's API is documented at docs.khaime.com.** Pages are available as
  markdown by appending `.md` (e.g.
  `https://docs.khaime.com/api-reference/payments/get-transaction.md`,
  `https://docs.khaime.com/webhooks/events.md`); `llms.txt` lists them. Payment
  `status` values (`succeeded`, `failed`, `refunded`, `disputed`) and the
  `GET /transactions/:id` contract come from there.
- **Idempotency on D1 lives in the UPDATE.** Without interactive transactions,
  "read the support, then decide" can race a duplicate delivery.
  `src/services/payment_outcome.ts` writes the rule into the statement
  (`UPDATE ... WHERE reference = ? AND status != 'succeeded'`), so a late
  `payment.failed` can never undo a `payment.succeeded`.
- **Provisioning failures are swallowed by design.** `provisionMerchantId`
  catches each Khaime error to try its fallbacks and returns null;
  `ensureMerchant` logs "Khaime sub-merchant provisioning failed for creator N"
  so a bad key doesn't look like nothing happened.

## Hono

- **`onError` must pass `HTTPException` through.** A catch-all 500 handler
  turns `csrf()`'s 403 (and any deliberate `HTTPException`) into a 500;
  `src/app.ts` returns `err.getResponse()` for those.
- **Sub-app middleware leaks.** `sub.use('*', mw)` on a sub-app mounted with
  `app.route('/', sub)` runs for every later route too, including the
  `/:handle` catch-all. In `src/routes/creator_area.tsx` each route takes
  `requireAuth` itself.
- **`setCookie` already URL-encodes.** Encoding the value yourself
  double-encodes it; `getCookie` only decodes once.
- **Route order.** New top-level routes go above `publicRoutes` (the
  `/:handle` catch-all) in `src/index.ts`, or they render "Creator not found".

## UI

- **Never show Better Auth's raw messages.** They read like
  `[body.email] Invalid email address`. `public/assets/auth.js` and
  `auth-reset.js` validate in the browser first and map error `code`s
  (`INVALID_EMAIL_OR_PASSWORD`, `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`, …) to
  plain messages, with a generic fallback.
- **The brand picker is for owners only.** `public/assets/theme.js` renders it
  only where `body[data-brand-save="1"]` (the creator's own pages) and saves
  picks via `POST /brand`. The server-rendered `--brand` is the source of
  truth; an older version let a per-browser `localStorage` pick recolor every
  creator, and the script still clears that `sml-brand` key.
- **Links styled as buttons need centring.** `.btn-primary` and friends have a
  fixed height and no vertical padding, which only centres text on a
  `<button>`; `base.css` centres `a.btn-*` with inline-flex.
- **Press feedback convention.** Buttons with an offset shadow press into it
  (`translate(2px,2px)` and a smaller shadow); shadowless buttons and cards use
  `:active { scale: 0.96 }` with `transition: scale 150ms ease-out`. Name
  transition properties; no `transition: all`.
- **No CSRF token in pages.** CSRF is an Origin check; client JS posts JSON
  with no token header.
