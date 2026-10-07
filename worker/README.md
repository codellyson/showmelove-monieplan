# showmelove on Cloudflare Workers (migration in progress)

This directory is the Workers port of the AdonisJS app in the repo root. It
lives alongside it until cutover, so the AdonisJS app keeps working.

Stack: Hono on Workers, D1 (SQLite) with Drizzle, Better Auth on D1, Workers
Static Assets serving the repo's `../public`.

## Status

Phase 1 (platform scaffold) is done:

- `wrangler.jsonc`: D1 binding `DB`, assets from `../public`, `nodejs_compat`.
- `migrations/0001_init.sql`: the live schema, copied from `tmp/db.sqlite3`
  (app tables plus Better Auth tables, without Lucid's `adonis_schema*`).
- `src/db/schema.ts`: Drizzle types for `creators` and `supports`.
- `src/lib/auth.ts`, `src/lib/email.ts`: Better Auth and Brevo, ported as
  per-request factories reading the Worker env.
- `src/index.ts`: `/api/auth/*` and a `/health` check.

Phase 2 (services) is done, in `src/services/`:

- `khaime.ts`: `createKhaime(env)` per request. Pure helpers (`toMinor`,
  `marketplaceSplitFrom`, `payoutStatusFor`, `decodeCheckoutToken`,
  `verifyWebhook`) are plain exports. The webhook HMAC uses WebCrypto, and the
  checkout token is decoded with `atob` instead of Node's `Buffer`.
- `creator_provisioner.ts`, `creator_profile.ts`, `creator_presenter.ts`: take a
  Drizzle `db` as their first argument. `applyProfile` returns the updated
  creator instead of mutating its input. Handle uniqueness is enforced by the
  unique index (insert, catch, retry) because D1 has no interactive
  transactions. The presenter takes an optional `now`, used for both the deltas
  and the "2 days ago" labels.

Phase 3 (middleware) is done:

- `src/app.ts`: `createApp()` builds the global stack, the counterpart of
  `start/kernel.ts`: per-request `db`/`auth`/`khaime`, security headers matching
  the old shield config, CSRF, the `/api/auth/*` mount, then the current user.
  `src/index.ts` adds routes to it; tests build their own.
- `src/middleware/current_user.ts`: session → `c.var.user`, creator created on
  first sight → `c.var.creator`, Khaime sub-merchant provisioned for managed
  creators (awaited, as before; failures logged, never thrown), plus
  `c.var.origin` / `c.var.siteHost` for page links.
- `src/middleware/require_auth.ts`: guests go to `/login?next=<path>`.
- CSRF changed shape: shield's session token (`_csrf` field, `X-CSRF-TOKEN`)
  becomes Hono's `csrf()`, which rejects cross-site form posts by Origin /
  Sec-Fetch-Site and needs no session. Ported views can drop `csrfField()` and
  the `csrf-token` meta; client JS still sending `X-CSRF-TOKEN` is harmless.
  `/api/auth/*` (Better Auth's own origin check) and `/webhooks/*` are exempt.

Phase 4 (routes and views) is done:

- `src/routes/`: `auth.tsx` (login, register, forgot, reset, logout),
  `public.tsx` (landing, `/:handle`, `POST /:handle/support`) and
  `creator_area.tsx` (setup, dashboard, supporters, connect, settings,
  payouts). `src/index.ts` mounts them with `publicRoutes` last. Each
  creator-area route takes `requireAuth` itself; a sub-app `use('*')` would
  also guard `/:handle`.
- `src/views/`: Hono JSX ports of the 13 rendered Edge pages and 4 partials.
  `resources/views/pages/home.edge` was never rendered and is not ported.
- `src/lib/http.ts`: `readInput` (query + JSON or form body, like
  `request.input`), and cookie-based one-shot flash messages replacing
  AdonisJS session flash.

Checked for parity against the AdonisJS app: both apps served the same copy
of the database, the Worker using the session cookie AdonisJS issued, and
every page's HTML was compared after normalising (attribute order, entity
escaping, whitespace, host). All pages matched for guests and signed-in
creators across managed/bring-your-own, NGN/USD and every payout status, as
did the JSON and form actions (status, body, follow-up page, resulting row).
The remaining intentional differences: no `csrf-token` meta or `_csrf` field,
and lowercase `method="post"`.

Still to port: the Khaime webhook (`POST /webhooks/khaime`).

## Tests

```bash
npm test
```

Vitest runs inside the Workers runtime (`@cloudflare/vitest-pool-workers`) on a
local D1 with the migrations applied. `fetch` is stubbed per test and the
Khaime config in `vitest.config.ts` is fake, so tests never reach Khaime.

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in values; APP_KEY can be any random string locally
npm run db:migrate:local
npx wrangler dev --port 8790
```

From the repo root, the "showmelove-worker" config in `.claude/launch.json`
starts the same thing. Port 8790, not 8787, because another `workerd` on this
machine already holds 8787.

## First deploy

```bash
npx wrangler d1 create showmelove   # paste the database_id into wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put APP_KEY      # the SAME value as the AdonisJS app
npx wrangler secret put KHAIME_API_KEY
npx wrangler secret put KHAIME_WEBHOOK_SECRET
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put MAIL_FROM_EMAIL
```

Set `APP_URL` in `wrangler.jsonc` `vars` to the deployed origin.

## Moving data

The schema matches the old database column for column, so plain `INSERT`s
import as they are. Dump only the data, table by table (parents first), then
load it:

```bash
for t in creators supports user session account verification; do
  sqlite3 ../tmp/db.sqlite3 ".mode insert \"$t\"" "select * from \"$t\""
done > data.sql
npx wrangler d1 execute showmelove --remote --file data.sql
```

Compare `select count(*)` per table on both sides afterwards. This was tested
against a fresh local D1: creators, supports, user, session and account counts
all matched. Delete `data.sql` afterwards; it holds user emails and password
hashes.
