/**
 * Migration: add cancelled_from_status to orders
 * Guarda a FASE (status) em que o pedido estava no momento do cancelamento,
 * para destacar de onde o cancelamento partiu. Nullable — só é preenchido
 * quando o pedido é cancelado e limpo quando o pedido é reaberto.
 */

exports.up = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.string('cancelled_from_status').nullable()
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.dropColumn('cancelled_from_status')
  })
}
