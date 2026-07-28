/**
 * Migration: add cancellation_reason to orders
 * Guarda o motivo obrigatório informado ao cancelar um pedido (trava contra
 * cancelamento acidental). Nullable — só é preenchido quando o pedido é cancelado.
 */

exports.up = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.text('cancellation_reason').nullable()
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.dropColumn('cancellation_reason')
  })
}
