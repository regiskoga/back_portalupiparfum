/**
 * Migration: Add formatted sequential code to suppliers
 * Generates "00001" style code derived from the primary key.
 */

exports.up = function(knex) {
  return knex.raw(`
    ALTER TABLE suppliers
    ADD COLUMN code text GENERATED ALWAYS AS (LPAD(id::text, 5, '0')) STORED
  `)
}

exports.down = function(knex) {
  return knex.schema.alterTable('suppliers', (table) => {
    table.dropColumn('code')
  })
}
