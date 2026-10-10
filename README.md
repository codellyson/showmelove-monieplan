# showmelove

A Naira-first tip jar for creators. A creator gets a public page at `/:handle`;
supporters send one-off or monthly "love" (tips) with an optional note, in the
creator's currency or USD, without an account. Payments run through the Khaime
Partner API.

Runs on Cloudflare: a Worker (Hono, server-rendered JSX) with D1 (SQLite) for
data, Better Auth for creator accounts, Workers Static Assets for `public/`,
and a Cron Trigger that reconciles payments.

## Layout

| Path | What |
| --- | --- |
| `src/index.ts` | Routes, plus the Cron's `scheduled` handler |
| `src/app.ts` | Global middleware: services per request, security headers, CSRF, Better Auth at `/api/auth/*`, current user |
| `src/routes/` | `auth.tsx`, `public.tsx` (landing, `/:handle`, tips), `creator_area.tsx`, `webhooks.ts` |
| `src/views/` | Hono JSX pages and partials |
| `src/services/` | Khaime client, creator provisioning, profile, presenter, payment outcomes |
| `src/jobs/reconcile_pending.ts` | The reconcile Cron |
| `src/db/schema.ts` | Drizzle types; the DDL lives in `migrations/` |
| `public/assets/` | Hand-written CSS, client JS and fonts (no bundler) |
| `test/` | Vitest in the Workers runtime |
| `llm-wiki/` | How each subsystem works and why; read before changing one |
| `_design_reference/` | The original static design pages |

## Routes

| Route | What |
| --- | --- |
| `GET /` | Landing page |
| `GET /login` · `/register` · `/forgot` · `/reset` · `POST /logout` | Auth pages |
| `GET, POST /api/auth/*` | Better Auth |
| `GET /setup` · `/dashboard` · `/supporters` · `/connect` · `/settings` · `/payouts` 🔒 | Creator area |
| `POST /setup` · `/connect` · `/connect/reset` · `/settings` · `/brand` · `/payouts/*` 🔒 | Creator actions |
| `GET, POST /webhooks/khaime` | Khaime webhook (signature-verified) and a GET health check |
| `GET /health` | Database check |
| `GET /:handle` · `POST /:handle/support` | Public creator page and checkout. Registered last. |

🔒 requires a signed-in creator (guests go to `/login?next=…`).

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in values; APP_KEY can be any random string locally
npm run db:migrate:local
npx wrangler dev
```

It serves on http://localhost:8790 (the `dev` block in `wrangler.jsonc`), and
the "showmelove" config in `.claude/launch.json` starts the same thing.

## Tests

```bash
npm test
```

Vitest runs inside the Workers runtime (`@cloudflare/vitest-pool-workers`) on a
local D1 with the migrations applied. `fetch` is stubbed per test and the
Khaime config in `vitest.config.ts` is fake, so tests never reach Khaime.
Typecheck with `npm run typecheck`.

## Deployed

Staging runs at https://showmelove.kreativekorna.com (custom domain in
`wrangler.jsonc`), on the D1 database `showmelove`, against Khaime's shared
dev API, with the Cron every 10 minutes. Redeploy with `npx wrangler deploy`;
apply new migrations first with `npm run db:migrate:remote`.

Secrets (`npx wrangler secret put <NAME>`): `APP_KEY`, `KHAIME_API_KEY`,
`KHAIME_WEBHOOK_SECRET`, `BREVO_API_KEY`, `MAIL_FROM_EMAIL`. Non-secret config
is in `wrangler.jsonc` `vars`; for production, set `KHAIME_API_URL` to
`https://api.khaime.com/api/v1` and use a live `KHAIME_API_KEY`.

Khaime sends webhooks to the URL registered for the partner key (Khaime
Dashboard → Settings → API). Until that is
`https://showmelove.kreativekorna.com/webhooks/khaime`, tips are confirmed by
the reconcile Cron instead, within about 10 minutes.

## Reconcile Cron

Every 10 minutes (`triggers.crons`), `src/jobs/reconcile_pending.ts` looks up
tips still `pending` 10 minutes after creation (up to 3 days old, 50 per run,
newest first) with Khaime's `GET /transactions/:id`, which returns the same
payment object as the webhook. `succeeded` / `failed` go through the same
`applyPaymentOutcome` as the webhook. `refunded` / `disputed` stay pending and
are logged for review. Lookup errors (including 404 while a checkout is
unfinished) are retried next run. Tips need `supports.khaime_transaction_id`,
which is stored from Create Charge (migration 0002); older tips have none.

Locally: `curl "localhost:8790/cdn-cgi/handler/scheduled?cron=*/10+*+*+*+*"`
runs it once against the dev database.

## Importing the old database

The app used to be an AdonisJS app on SQLite (removed; see git history before
the "Remove the AdonisJS app" commit). Migration 0001 matches its schema column
for column; 0002 adds a column the old rows don't have, so dump with column
names, table by table (parents first), then load:

```bash
for t in creators supports user session account verification; do
  sqlite3 -cmd ".headers on" -cmd ".mode insert \"$t\"" tmp/db.sqlite3 "select * from \"$t\""
done > data.sql
npx wrangler d1 execute showmelove --remote --file data.sql
```

Compare `select count(*)` per table afterwards, then delete `data.sql`: it holds
user emails and password hashes. Keep `APP_KEY` the same as the old app's, or
imported sessions stop validating.
