# Payments (Khaime)

All Khaime calls live in `app/services/khaime.ts`. showmelove is a Khaime
**marketplace operator**: each managed creator is a sub-merchant under it, and
showmelove takes a commission on every tip.

## Configuration

- `KHAIME_API_URL`: base URL, **already including `/partner`**. Defaults to
  production (`https://api.khaime.com/api/v1/partner`); local `.env` points at
  `api.khaimedev.com`.
- `KHAIME_API_KEY`: partner key, sent as `X-API-Key`. If unset,
  `isConfigured()` is false and managed payments return 503 instead of charging.
- `KHAIME_WEBHOOK_SECRET`: verifies webhooks.
- `KHAIME_COMMISSION_RATE`: defaults to 0.05; sent as `commission_rate` when a
  sub-merchant is created.

## Sub-merchants

`ensureMerchant` runs from the auth middleware (architecture.md). It creates the
sub-merchant with the creator's own email; if Khaime rejects that, it re-links
an existing sub-merchant with that email, and failing that creates one under a
per-handle `+alias` address. That fallback exists because the operator's own
login email is already a Khaime account and can't also be a sub-merchant.

A sub-merchant **can't be charged until its payout is configured**; Khaime
rejects the charge with `MARKETPLACE_SUB_MERCHANT_PAYOUT_NOT_CONFIGURED`.
Payout setup is on `/payouts`: NGN-style currencies post bank details to
`/marketplace/merchants/:id/payout` (bank names must match
`/marketplace/payout/banks` exactly); others start Stripe Connect onboarding via
`/marketplace/merchants/:id/kyc`. Withdrawals go through
`/marketplace/merchants/:id/payouts` and are staged for approval.

## Charging a tip

`POST /:handle/support` → `khaime.createCharge` → `POST /payments/charge` with
the current contract:

- `merchant_amount` / `merchant_currency`: what the creator is owed (the tip, in
  the creator's currency).
- `charge_amount` / `charge_currency`: what the supporter pays.
- All amounts in **minor units**. The older `amount` / `total_amount` fields
  are rejected by Khaime's validator.

Supporters of a non-USD creator can choose "Pay in USD" (`payCurrency`,
allowed values in `PAY_CURRENCIES`). Then the USD amount comes from
`GET /pricing/calculate?amount=<major>&source_currency&target_currency&sub_merchant_id`,
whose `data.pricing.local.amount` is in **major** units, and the charge also
sends `converted_total_amount` / `converted_total_currency` so Khaime uses that
figure instead of re-converting and failing with an amount mismatch.

The gateway follows the charge currency:

- NGN → Paystack: the response has `payment_url`; the browser is redirected to
  hosted checkout.
- USD → Stripe: the response has `client_secret`, `publishable_key` and maybe
  `stripe_account_id`; `public/assets/support.js` mounts Stripe Elements and
  confirms on the page.

Either way the support is saved as `pending` with its `sml_…` reference, and
the supporter lands back on `/:handle?thanks=1`.

## Webhooks

`POST /webhooks/khaime` checks `x-khaime-signature` = hex HMAC-SHA256 of the
**raw body** with `KHAIME_WEBHOOK_SECRET` (constant-time). Parsing the body
before verifying, or re-serialising it, breaks every signature.

- `payment.succeeded` / `payment.failed`: matched by `metadata.partner_reference`;
  the only thing that marks a tip paid. A `succeeded` support never goes back.
- `account.updated`: re-fetches the merchant and sets `payoutStatus` from
  `payout_ready`, plus provider, Stripe account and settlement currency.

Khaime only reaches a local server through a tunnel. Without one, read a payment
with `GET /partner/transactions/:id`, which returns the same payment object as
the webhook.

## The marketplace split

On `payment.succeeded`, `marketplaceSplitFrom` keeps the top-level
`marketplace_*` metadata fields and, on Stripe platform charges, the
`marketplace_settlement` block, stores them in `supports.khaime_split`, and logs
a warning listing any field where the two disagree.

Who bears Khaime's processing fee depends on the payment path, and **no setting
controls it**:

- Paystack (NGN): the fee comes out of showmelove's commission; the creator
  gets gross minus commission.
- Stripe platform charge (for example an NGN tip paid in USD): commission is
  taken on gross, and the fee comes out of the creator's share.

Khaime's fees: NGN domestic 2.9% + ₦100, international 6% + ₦100, no cap. The
`/payouts` page estimates the creator's net as gross minus commission only, so
it overstates net on Stripe-path tips.

History: Khaime bug 9dfna24x made the top-level fields contradict
`marketplace_settlement` on Stripe charges; the fix reached the dev API on
2026-10-06. Khaime feature request mmv425cc tracks a per-marketplace fee-bearer
setting. Treat `marketplace_settlement` as authoritative when they differ.
