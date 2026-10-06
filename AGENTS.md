# showmelove — agent notes

An AdonisJS 6 app (Edge views, Lucid on SQLite, Better Auth) for a Naira-first
creator tip jar, with managed payouts through the Khaime Partner API.

**Read `llm-wiki/` before any non-trivial task.** It records how each subsystem
works, why, and what breaks if changed naively; `llm-wiki/lessons.md` lists the
environment traps. Update the wiki when a task changes how a subsystem works or
teaches a new lesson.

Quick rules (details in `llm-wiki/README.md`):

- Never print or commit a value from `.env`.
- `Support.amount` is major units in the creator's currency; Khaime takes minor
  units. Convert only in `app/services/khaime.ts`.
- A tip is paid only when the `payment.succeeded` webhook says so.
- New top-level routes go above the `/:handle` catch-all.
