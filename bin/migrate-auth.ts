/*
|--------------------------------------------------------------------------
| Better Auth migrations
|--------------------------------------------------------------------------
|
| Better Auth manages its own tables (user/session/account/verification) in the
| SAME SQLite file Lucid uses. Locally these are created with the Better Auth
| CLI; in a container we can't rely on the dev CLI, so this script applies them
| programmatically using the same `getMigrations` helper the CLI uses.
|
| Run AFTER `node ace migration:run` (which creates the app tables) so the
| shared db file already exists. It is idempotent — safe to run on every boot.
|
*/

import { getMigrations } from 'better-auth/db/migration'
import { auth } from '#lib/auth'

const { runMigrations } = await getMigrations(auth.options)
await runMigrations()

// eslint-disable-next-line no-console
console.log('✓ Better Auth tables are up to date')
process.exit(0)
