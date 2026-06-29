import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'creators'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Persisted payout-setup state so completion is knowable without a live
      // Khaime call. null = nothing set up; 'pending' = submitted/verifying;
      // 'action_needed' = Khaime wants more info; 'ready' = payouts live.
      table.string('payout_status').nullable()
      // Which rail the creator set up: 'bank' (local) or 'stripe' (foreign).
      table.string('payout_provider').nullable()
      // Currency Khaime settles in once known (e.g. USD, NGN).
      table.string('settlement_currency').nullable()
      // Khaime-managed Stripe Connect account id, when applicable.
      table.string('stripe_account_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('payout_status')
      table.dropColumn('payout_provider')
      table.dropColumn('settlement_currency')
      table.dropColumn('stripe_account_id')
    })
  }
}
