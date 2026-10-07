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

Still to port: the current-user and auth middleware, the 9 controllers and 22
Edge views (as Hono JSX), and the Khaime webhook.

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
