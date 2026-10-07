# showmelove

A creator support / tip-jar app for the Nigerian market (Naira-first), built with
**AdonisJS 6** (Edge views + Lucid + SQLite). One product, two invisible payout
modes (managed vs bring-your-own), per the product PRD.

## Stack

- AdonisJS 6 (web starter kit) — routes, controllers, Edge templates
- Lucid ORM on SQLite (`better-sqlite3`)
- **Better Auth** (email/password) for authentication
- Vanilla CSS/JS design system served from `public/assets` (no bundler step)

## Run

```bash
npm install
node ace migration:run     # create tables
node ace db:seed           # seed Ada Obi + 23 supporters (₦45,000 raised)
node ace serve --hmr       # dev server
```

The dev server prints its address (e.g. http://localhost:3333). Open `/` for the
landing page.

## Pages / routes

| Route | What |
|-------|------|
| `GET /` | Landing (marketing; real love notes from DB) |
| `GET /login` · `GET /register` · `POST /logout` | Auth pages / sign-out |
| `ANY /api/auth/*` | Better Auth handler (sign-up/sign-in/session/sign-out) |
| `GET /setup` 🔒 | Creator setup wizard (client-side steps) |
| `GET /:handle` | Public support page, e.g. `/adabuilds` |
| `POST /:handle/support` | Send support — runs the mock payment seam |
| `GET /dashboard` 🔒 | Creator dashboard (`?state=managed\|empty\|byo` previews variants) |
| `GET /connect` · `POST /connect` · `POST /connect/reset` 🔒 | Connect a processor |

🔒 = requires a signed-in user (redirects to `/login`).

## Auth (Better Auth)

- Config: `app/lib/auth.ts` (no AdonisJS imports, so the Better Auth CLI can load it).
  Opens its own better-sqlite3 connection to the same DB file; tables created via
  `npx @better-auth/cli migrate --config app/lib/auth.ts`.
- Bridge: `app/lib/auth_http.ts` converts AdonisJS ↔ web Request/Response; the handler is
  mounted at `/api/auth/*` and exempted from shield CSRF (`config/shield.ts`).
- `current_user_middleware` resolves the session on every request, shares `user`/`creator`
  with views, and **lazily provisions a creator** for new users (`creator_provisioner.ts`).
- `require_auth` named middleware guards the creator area.
- Account menu lives in `resources/views/partials/menu.edge` (used in the nav); the dropdown
  toggle is in `theme.js`.

## Domain

- `app/models/creator.ts`, `app/models/support.ts` — Lucid models
- `app/services/creator_presenter.ts` — aggregates (raised, supporters, goal, notes)
- `app/services/payment_rail.ts` — the swappable payment **seam** (PRD §5); ships a
  `MockRail` that always settles. Real Paystack/Stripe rails slot in here.
- `database/seeders/creator_seeder.ts` — demo data (Ada Obi, ₦45,000 / 23 supporters)

## Notes

- Brand color is server-set per creator (`--brand`). The floating picker appears
  only on the creator's own pages and saves the choice to the creator
  (`POST /brand`); visitors can't recolor a page.
- `_design_reference/` holds the original static HTML/CSS/JS the views were ported from.
- Monthly support is managed-mode only in v1; bring-your-own pages are one-time.
