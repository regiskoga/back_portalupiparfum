/**
 * Migration: Create orders table
 */

exports.up = function(knex) {
  return knex.schema.createTable('orders', (table) => {
    table.increments('id').primary()
    table.integer('customer_id').unsigned().notNullable()
      .references('id').inTable('customers').onDelete('CASCADE')
    table.text('code').defaultTo('')
    table.enu('status', ['Pending', 'Confirmed', 'In Production', 'Shipped', 'Delivered', 'Cancelled'])
      .notNullable().defaultTo('Pending')
    table.enu('channel', ['', 'Physical Store', 'WhatsApp', 'Instagram', 'Website', 'Referral', 'Other'])
      .defaultTo('')
    table.decimal('discount', 14, 2).notNullable().defaultTo(0)
    table.decimal('shipping', 14, 2).notNullable().defaultTo(0)
    table.text('notes').defaultTo('')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // Indexes
    table.index('customer_id')
    table.index('status')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('orders')
}
