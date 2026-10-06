# showmelove LLM wiki

Working notes for AI agents on this codebase. Each page says how a subsystem
works, why it is that way, and what breaks if you change it naively. The
[README](../README.md) at the repo root is for humans and has the run
instructions; this wiki records the decisions and failure modes behind them.

showmelove is a Naira-first creator tip jar. A creator gets a public page at
`/:handle`; supporters send one-off or monthly "love" (tips) with an optional
note, without an account. Behind one product there are two payout modes the
supporter never sees: `managed`, where Khaime collects the money and pays the
creator out, and `byo` (bring your own processor), which is not built yet.
AdonisJS 6 with Edge views, Lucid on a single SQLite file, Better Auth for
creator accounts, and plain CSS/JS from `public/assets`.

## Pages

- [architecture.md](architecture.md): routes, auth and the creator lifecycle, payout modes, data model
- [payments.md](payments.md): the Khaime contract, gateways, webhooks, payouts, the marketplace split
- [lessons.md](lessons.md): environment traps; read before long tasks

## Standing rules (apply to every task)

- **Never print or commit a secret.** `.env` holds a real Khaime partner key,
  webhook secret, `APP_KEY` and Brevo key. Name the variable and what it is
  for; check presence with patterns that print "(set)/(empty)", never values.
- **Amounts on a `Support` are major units in the creator's currency.**
  Khaime wants minor units; convert only at the edge in `app/services/khaime.ts`
  (`toMinor`). Mixing the two silently charges 100x or 1/100th.
- **A tip is only paid when the `payment.succeeded` webhook says so.** The
  support controller records `pending`; nothing else flips it. Don't add
  "optimistic success" paths.
- **Payment failures are honest.** If Khaime is unconfigured, the creator is
  not provisioned, or the creator is `byo`, the support endpoint returns a clear
  402/503 instead of pretending. Keep that behaviour.
- **The Khaime dev API is shared.** `KHAIME_API_URL` points at
  `api.khaimedev.com` locally; sub-merchants and charges you create there are
  visible to everyone testing on it.

## What deliberately does not exist (don't assume it)

- **BYO charging.** `/connect` records a processor choice and flips the creator
  to `byo`, but charging on the creator's own Paystack/Stripe returns 402.
- **Payers in currencies other than the creator's own or USD.**
  `PAY_CURRENCIES` is `['USD']`; there is no general currency picker.
- **Polling for payment status.** No job checks Khaime; a lost webhook means the
  support stays `pending` until someone reads `GET /partner/transactions/:id`.
- **Supporter accounts.** Supporters are anonymous or name-only; only creators
  sign in.
- **Seed data.** The README mentions `node ace db:seed`, but there are no
  seeders in the repo.
- **A fee-bearer choice.** Who pays Khaime's processing fee is decided by the
  payment path, not by any setting here or in Khaime (see payments.md).
