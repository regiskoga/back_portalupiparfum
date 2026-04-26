/**
 * Migration: Create purchase_orders table
 * Ordens de compra geradas automaticamente pelo motor de decisão
 */

exports.up = function(knex) {
  return knex.schema.createTable('purchase_orders', (table) => {
    table.increments('id').primary()
    table.integer('order_id').unsigned().notNullable()
      .references('id').inTable('orders').onDelete('CASCADE')
    table.integer('order_item_id').unsigned().notNullable()
      .references('id').inTable('order_items').onDelete('CASCADE')
    table.integer('supply_id').unsigned().notNullable()
      .references('id').inTable('supplies').onDelete('RESTRICT')
    table.integer('supplier_id').unsigned().notNullable()
      .references('id').inTable('suppliers').onDelete('RESTRICT')
    table.decimal('quantity_needed', 14, 2).notNullable()
    table.enu('status', ['Pending', 'Ordered', 'Received', 'Cancelled'])
      .notNullable().defaultTo('Pending')
    table.text('notes').defaultTo('')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('ordered_at')
    table.timestamp('received_at')

    // Indexes
    table.index('order_id')
    table.index('order_item_id')
    table.index('supply_id')
    table.index('supplier_id')
    table.index('status')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('purchase_orders')
}
