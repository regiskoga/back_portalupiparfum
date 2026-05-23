/**
 * Migration: Add is_open to supplies
 * Permite marcar uma compra de insumo como "fechada" (totalmente consumida ou descontinuada).
 * Insumos fechados ficam ocultos nas listas de seleção.
 */

exports.up = function (knex) {
  return knex.schema.alterTable('supplies', (table) => {
    table.boolean('is_open').notNullable().defaultTo(true)
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('supplies', (table) => {
    table.dropColumn('is_open')
  })
}
