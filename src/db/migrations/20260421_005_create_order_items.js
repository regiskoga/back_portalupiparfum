/**
 * Migration: Create order_items table
 */

exports.up = function(knex) {
  return knex.schema.createTable('order_items', (table) => {
    table.increments('id').primary()
    table.integer('order_id').unsigned().notNullable()
      .references('id').inTable('orders').onDelete('CASCADE')
    table.text('product_name').notNullable()
    table.text('product_ref').defaultTo('')
    table.decimal('quantity', 14, 6).notNullable()
    table.decimal('unit_price', 14, 2).notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // Index
    table.index('order_id')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('order_items')
}
