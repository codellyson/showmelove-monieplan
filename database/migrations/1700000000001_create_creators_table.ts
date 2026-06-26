import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'creators'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('display_name').notNullable()
      table.string('handle').notNullable().unique()
      table.text('bio').nullable()
      table.string('location').nullable()
      table.string('currency').notNullable().defaultTo('NGN')
      table.string('currency_symbol').notNullable().defaultTo('₦')
      table.integer('monthly_goal').notNullable().defaultTo(0)
      table.string('brand_color').notNullable().defaultTo('#FF5A36')
      table.string('payout_mode').notNullable().defaultTo('managed')
      table.string('processor').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
