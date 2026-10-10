import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Drizzle mapping of the app tables. migrations/0001_init.sql is the source of
 * truth for the DDL (0001 mirrors the original SQLite schema exactly); this file
 * only types queries against it.
 *
 * Timestamps are text in `YYYY-MM-DD HH:MM:SS` UTC format, which is
 * what SQLite's CURRENT_TIMESTAMP produces, so old and new rows sort together.
 *
 * Better Auth's tables (user, session, account, verification) are not mapped:
 * Better Auth reads and writes them itself through the D1 binding.
 */

export type PayoutMode = 'managed' | 'byo'
export type Processor = 'paystack' | 'stripe' | null
export type PayoutStatus = 'pending' | 'action_needed' | 'ready' | null
export type PayoutProvider = 'bank' | 'stripe' | null
export type SupportStatus = 'pending' | 'succeeded' | 'failed'

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
}

export const creators = sqliteTable(
  'creators',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id'),
    displayName: text('display_name').notNull(),
    handle: text('handle').notNull(),
    bio: text('bio'),
    location: text('location'),
    currency: text('currency').notNull().default('NGN'),
    currencySymbol: text('currency_symbol').notNull().default('₦'),
    /** Major units of `currency`. */
    monthlyGoal: integer('monthly_goal').notNull().default(0),
    brandColor: text('brand_color').notNull().default('#FF5A36'),
    payoutMode: text('payout_mode').$type<PayoutMode>().notNull().default('managed'),
    processor: text('processor').$type<Processor>(),
    khaimeMerchantId: text('khaime_merchant_id'),
    payoutStatus: text('payout_status').$type<PayoutStatus>(),
    payoutProvider: text('payout_provider').$type<PayoutProvider>(),
    settlementCurrency: text('settlement_currency'),
    stripeAccountId: text('stripe_account_id'),
    ...timestamps,
  },
  (t) => [uniqueIndex('creators_handle_unique').on(t.handle), index('creators_user_id_index').on(t.userId)]
)

export const supports = sqliteTable('supports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  creatorId: integer('creator_id').references(() => creators.id, { onDelete: 'cascade' }),
  supporterName: text('supporter_name'),
  message: text('message'),
  /** What the creator is owed, in MAJOR units of `currency`. Khaime takes minor units; convert only in the Khaime service. */
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('NGN'),
  recurring: integer('recurring', { mode: 'boolean' }).notNull().default(false),
  /** Only the payment.succeeded / payment.failed webhook moves this off 'pending'. */
  status: text('status').$type<SupportStatus>().notNull().default('pending'),
  /** `sml_…` partner reference sent to Khaime. */
  reference: text('reference').notNull(),
  /** What the supporter paid, in MINOR units, when it differs from amount/currency. */
  chargeAmount: integer('charge_amount'),
  chargeCurrency: text('charge_currency'),
  /** Marketplace split from the payment.succeeded webhook, as JSON. */
  khaimeSplit: text('khaime_split'),
  /** Khaime's transaction id from Create Charge; lets the reconcile Cron look the payment up. */
  khaimeTransactionId: text('khaime_transaction_id'),
  ...timestamps,
})

export type Creator = typeof creators.$inferSelect
export type Support = typeof supports.$inferSelect
