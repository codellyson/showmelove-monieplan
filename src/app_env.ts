import type { Db } from './db/client'
import type { Creator } from './db/schema'
import type { Auth, SessionUser } from './lib/auth'
import type { Khaime } from './services/khaime'

/**
 * Per-request context: services, the signed-in user and their creator, and the
 * values pages need for links. Set by the middleware in src/app.ts; read with
 * `c.var.<name>`.
 */
export interface AppEnv {
  Bindings: Env
  Variables: {
    db: Db
    auth: Auth
    khaime: Khaime
    /** Signed-in Better Auth user, or null for guests. */
    user: SessionUser | null
    /** The user's creator page, created on first sight. Null for guests. */
    creator: Creator | null
    /** Origin the request was served on, for page links (no hardcoded host). */
    origin: string
    siteHost: string
  }
}
