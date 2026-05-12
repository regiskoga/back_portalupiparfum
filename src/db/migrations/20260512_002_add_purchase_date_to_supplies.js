/**
 * Migration: Add purchase_date to supplies
 * Backfills existing rows with DATE(created_at)
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('supplies', (table) => {
    table.date('purchase_date').nullable()
  })
  await knex.raw(`UPDATE supplies SET purchase_date = DATE(created_at)`)
}

exports.down = function(knex) {
  return knex.schema.alterTable('supplies', (table) => {
    table.dropColumn('purchase_date')
  })
}
