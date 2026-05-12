/**
 * Migration: Add active (soft delete) to suppliers
 */

exports.up = function(knex) {
  return knex.schema.alterTable('suppliers', (table) => {
    table.boolean('active').notNullable().defaultTo(true)
  })
}

exports.down = function(knex) {
  return knex.schema.alterTable('suppliers', (table) => {
    table.dropColumn('active')
  })
}
