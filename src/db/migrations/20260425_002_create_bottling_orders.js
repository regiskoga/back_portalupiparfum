/**
 * Migration: Create bottling_orders table
 * Ordens de envase geradas automaticamente pelo motor de decisão
 */

exports.up = function(knex) {
  return knex.schema.createTable('bottling_orders', (table) => {
    table.increments('id').primary()
    table.integer('order_id').unsigned().notNullable()
      .references('id').inTable('orders').onDelete('CASCADE')
    table.integer('order_item_id').unsigned().notNullable()
      .references('id').inTable('order_items').onDelete('CASCADE')
    table.integer('batch_id').unsigned().notNullable()
      .references('id').inTable('batches').onDelete('RESTRICT')
    table.integer('product_id').unsigned().notNullable()
      .references('id').inTable('products').onDelete('RESTRICT')
    table.decimal('volume_ml', 14, 2).notNullable()
    table.integer('quantity').notNullable()
    table.enu('status', ['Pending', 'In Progress', 'Completed', 'Cancelled'])
      .notNullable().defaultTo('Pending')
    table.text('notes').defaultTo('')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('completed_at')

    // Indexes
    table.index('order_id')
    table.index('order_item_id')
    table.index('batch_id')
    table.index('product_id')
    table.index('status')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('bottling_orders')
}
