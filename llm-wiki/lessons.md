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
