/**
 * Migration: Add quantity_available to supplies
 * Tracks current stock available (starts equal to quantity_purchased).
 */

exports.up = async function(knex) {
  await knex.schema.alterTable('supplies', (table) => {
    table.decimal('quantity_available', 14, 6).notNullable().defaultTo(0)
  })
  // Backfill: todo insumo comprado começa com disponibilidade = quantidade comprada
  await knex.raw('UPDATE supplies SET quantity_available = quantity_purchased')
}

exports.down = function(knex) {
  return knex.schema.alterTable('supplies', (table) => {
    table.dropColumn('quantity_available')
  })
}
