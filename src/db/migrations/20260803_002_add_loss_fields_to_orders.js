/**
 * Migration: add loss fields to orders
 * loss_reason      — observação obrigatória informada ao marcar Perdido/Avariado.
 * lost_from_status — fase de origem no momento da perda (espelha cancelled_from_status).
 * Ambos nullable — só preenchidos quando o pedido é marcado como perdido/avariado.
 */

exports.up = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.text('loss_reason').nullable()
    table.string('lost_from_status').nullable()
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.dropColumn('loss_reason')
    table.dropColumn('lost_from_status')
  })
}
