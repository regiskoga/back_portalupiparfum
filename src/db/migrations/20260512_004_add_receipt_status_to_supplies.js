/**
 * Migration: Add receipt_status to supplies
 * Tracks whether a purchased supply has been received, is pending, or was cancelled.
 * Existing rows default to 'Recebido' (assumed received if already in the system).
 */

exports.up = function(knex) {
  return knex.schema.alterTable('supplies', (table) => {
    table.enu('receipt_status', ['Recebido', 'Pendente', 'Cancelado'])
      .notNullable()
      .defaultTo('Recebido')
  })
}

exports.down = function(knex) {
  return knex.schema.alterTable('supplies', (table) => {
    table.dropColumn('receipt_status')
  })
}
