import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'supports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('creator_id')
        .unsigned()
        .references('id')
        .inTable('creators')
        .onDelete('CASCADE')
      table.string('supporter_name').nullable()
      table.text('message').nullable()
      table.integer('amount').notNullable()
      table.string('currency').notNullable().defaultTo('NGN')
      table.boolean('recurring').notNullable().defaultTo(false)
      table.string('status').notNullable().defaultTo('pending')
      table.string('reference').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
