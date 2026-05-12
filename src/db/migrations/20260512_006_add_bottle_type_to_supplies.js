/**
 * Migration: Add bottle_type to supplies
 * Free-text classification for packaging sub-types (e.g. "Frasco 50ml", "Decant 2ml").
 */

exports.up = function(knex) {
  return knex.schema.alterTable('supplies', (table) => {
    table.text('bottle_type').defaultTo('')
    table.index('bottle_type')
  })
}

exports.down = function(knex) {
  return knex.schema.alterTable('supplies', (table) => {
    table.dropIndex('bottle_type')
    table.dropColumn('bottle_type')
  })
}
