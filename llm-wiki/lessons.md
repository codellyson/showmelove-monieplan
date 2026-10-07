# Lessons (environment traps and practices)

- **`better-sqlite3` after a Node upgrade.** It is a native module. After a
  Node major change (the machine is on Node 22) the server fails to load it, and
  `npm rebuild` silently skips because install scripts are blocked. Rebuild it
  with `node-gyp` directly inside `node_modules/better-sqlite3`, then
  `node ace migration:run` should report "Already up to date".
- **Starting the app.** `.claude/launch.json` has a "showmelove" config
  (`node ace serve --hmr`, port 3333); use the preview tool with that name
  rather than starting the server in a shell. If it is already up, reuse it.
- **Two migrators, one file.** Lucid migrations (`node ace migration:run`) and
  Better Auth's (`bin/migrate-auth.ts`) both write `tmp/db.sqlite3`. A fresh
  database needs both; the Docker entrypoint runs them in that order.
- **Route order.** New top-level routes go above the `/:handle` catch-all in
  `start/routes.ts`, or they render "Creator not found".
- **Secrets.** `.env` holds live-looking keys. Read a single non-secret variable
  with `grep -E "^NAME="` only when needed, never `cat .env`; the permission
  classifier blocks reading credentials into output anyway.
- **Testing payments needs a payout-ready sub-merchant.** A creator only works
  end to end once its Khaime payout is configured. Setting up bank details is
  for the user to do; don't enter account numbers yourself.
- **Local webhooks need a tunnel.** Khaime posts to the URL registered for the
  partner key, not to localhost. Without a tunnel, tips stay `pending`; check
  the payment through `GET /transactions/:id` instead.
- **The README's `node ace db:seed` is stale.** No seeders are committed; a new
  database starts empty and creators appear on first sign-in.
- **Unit mistakes are silent.** Khaime takes minor units, `/pricing/calculate`
  returns major units, `Support.amount` is major. A wrong conversion still
  produces a valid-looking charge; check the amount on the Khaime side.
- **Workers port lives in `worker/`.** The Cloudflare migration (Hono, D1,
  Better Auth on D1) is built beside the AdonisJS app, not in place of it; see
  `worker/README.md` for status. Its `migrations/0001_init.sql` mirrors the
  live SQLite schema exactly so old data imports as plain `INSERT`s; change
  the schema through new D1 migrations, not by editing that file. Pass the D1
  binding straight to Better Auth (`database: env.DB`): its built-in D1
  dialect writes ISO date text like the old setup. Run `wrangler dev` on 8790;
  8787 is held by another `workerd` on this machine.
- **Worker `compatibility_date` is capped by the test runner.** The `workerd`
  bundled with `@cloudflare/vitest-pool-workers` lags wrangler's; a newer date
  fails every test with "requires compatibility date ... newest supported is
  ...". Keep `worker/wrangler.jsonc` at or below what `npm test` accepts.
- **Khaime provisioning failures used to be silent.** `provisionMerchantId`
  catches every Khaime error to try its fallbacks and returns null, so the
  AdonisJS middleware's "log on failure" never fired. The Workers port warns
  ("Khaime sub-merchant provisioning failed for creator N") when that happens.
- **Hono `onError` must pass `HTTPException` through.** A catch-all 500 handler
  turns `csrf()`'s 403 (and any deliberate `HTTPException`) into a 500;
  `worker/src/app.ts` returns `err.getResponse()` for those.
- **Hono sub-app middleware leaks.** `sub.use('*', mw)` on a sub-app mounted
  with `app.route('/', sub)` runs for every later route too, including the
  `/:handle` catch-all. In `worker/src/routes/creator_area.tsx` each route
  takes `requireAuth` itself.
- **Hono `setCookie` already URL-encodes.** Encoding the value yourself
  double-encodes it; `getCookie` only decodes once.
- **Parity-checking the Workers port.** Run a copy of the AdonisJS app (rsync
  without node_modules, symlink them, `sqlite3 .backup` the database, blank
  `KHAIME_API_KEY` in the copy's `.env` so nothing reaches the shared Khaime
  dev API) on port 3340 (a Better Auth trusted origin), load the same data into
  a separate local D1 (`--persist-to`), and give the Worker the copy's
  `APP_KEY` through `--env-file`. One AdonisJS session cookie then works on
  both, and normalised HTML can be diffed page by page. Delete the copy after:
  it holds `.env` secrets and user data.
