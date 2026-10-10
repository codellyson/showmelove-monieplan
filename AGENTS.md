# showmelove — agent notes

A Cloudflare Worker (Hono + server-rendered JSX, D1, Better Auth) for a
Naira-first creator tip jar, with managed payouts through the Khaime Partner
API and a Cron that reconciles payments.

**Read `llm-wiki/` before any non-trivial task.** It records how each subsystem
works, why, and what breaks if changed naively; `llm-wiki/lessons.md` lists the
environment traps. Update the wiki when a task changes how a subsystem works or
teaches a new lesson.

Quick rules (details in `llm-wiki/README.md`):

- Never print or commit a secret from `.dev.vars`, `.env` or `wrangler secret`.
- `Support.amount` is major units in the creator's currency; Khaime takes minor
  units. Convert only in `src/services/khaime.ts`.
- A tip is paid only when Khaime says so: the `payment.succeeded` webhook, or
  the reconcile Cron's `GET /transactions/:id` lookup. Never optimistically,
  and a succeeded tip never goes back.
- New top-level routes go above the `/:handle` catch-all (`publicRoutes`, mounted
  last in `src/index.ts`).
- Schema changes are new files in `migrations/`; never edit an applied one.
