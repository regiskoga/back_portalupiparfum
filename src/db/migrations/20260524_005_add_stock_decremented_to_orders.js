/**
 * Migration: Add stock_decremented flag to orders.
 * Prevents double-decrement of bottling quantity_available when an order
 * is marked Delivered, and tracks whether the reverse is needed on Cancel.
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('orders', table => {
    table.boolean('stock_decremented').notNullable().defaultTo(false)
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('orders', table => {
    table.dropColumn('stock_decremented')
  })
}
