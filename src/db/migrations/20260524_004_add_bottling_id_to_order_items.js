/**
 * Migration: Add bottling_id to order_items for traceability (M16).
 * Links a fulfilled order item to the specific bottling that supplied it.
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('order_items', table => {
    table.integer('bottling_id').unsigned().nullable()
      .references('id').inTable('bottlings').onDelete('SET NULL')
    table.index('bottling_id')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('order_items', table => {
    table.dropIndex('bottling_id')
    table.dropColumn('bottling_id')
  })
}
