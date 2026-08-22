/**
 * Migration (Fase 1): vincula cupom a parceiro + override de comissão.
 *
 *  partner_id      → partners  (RESTRICT: não deixa apagar parceiro com cupom;
 *                    de todo jeito o parceiro é inativado, nunca apagado)
 *  commission_rate → override opcional. NULL = usa partners.default_commission_rate.
 *
 * Assim um parceiro pode ter um cupom sazonal ("Dia dos Pais do canal X") com uma
 * % diferente da padrão, sem duplicar cadastro.
 */

exports.up = function (knex) {
  return knex.schema.alterTable('coupons', (table) => {
    table.integer('partner_id').unsigned().nullable()
      .references('id').inTable('partners').onDelete('RESTRICT')
    table.decimal('commission_rate', 5, 2).nullable()
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('coupons', (table) => {
    table.dropColumn('partner_id')
    table.dropColumn('commission_rate')
  })
}
