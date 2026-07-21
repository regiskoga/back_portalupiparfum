/**
 * Migration: add freight_type to orders
 * Snapshot do nome do tipo de frete escolhido no pedido (o valor já existe em `shipping`).
 * Nullable — pedidos sem frete (retirada/digital/catálogo) não precisam informar.
 */

exports.up = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.string('freight_type').nullable()
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.dropColumn('freight_type')
  })
}
