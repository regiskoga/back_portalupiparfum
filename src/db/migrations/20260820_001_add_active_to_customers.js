/**
 * Migration (Fase 0): soft-delete em customers.
 *
 * A FK customers→orders é CASCADE: apagar um cliente apagava todo o histórico de
 * pedidos dele em cascata. Como o financeiro de parceiros (Fase 2) e a
 * rastreabilidade dependem desse histórico, clientes passam a ser INATIVADOS,
 * nunca removidos fisicamente. Mesmo padrão de suppliers.active.
 */

exports.up = function (knex) {
  return knex.schema.alterTable('customers', (table) => {
    table.boolean('active').notNullable().defaultTo(true)
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('customers', (table) => {
    table.dropColumn('active')
  })
}
