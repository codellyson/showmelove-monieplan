import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'creators'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Khaime marketplace sub-merchant id (managed payouts). Null until provisioned.
      table.string('khaime_merchant_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('khaime_merchant_id')
    })
  }
}
