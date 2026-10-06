import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'supports'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // What the supporter was charged, when it differs from the creator's currency.
      table.integer('charge_amount').nullable()
      table.string('charge_currency').nullable()
      // Marketplace split Khaime reported on payment.succeeded (JSON).
      table.text('khaime_split').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('charge_amount')
      table.dropColumn('charge_currency')
      table.dropColumn('khaime_split')
    })
  }
}
