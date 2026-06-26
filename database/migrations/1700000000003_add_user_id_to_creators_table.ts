import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'creators'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Links a creator to its Better Auth user (null for the seeded demo creator).
      table.string('user_id').nullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('user_id')
    })
  }
}
