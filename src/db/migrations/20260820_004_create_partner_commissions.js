/**
 * Migration (Fase 2): livro-razão de comissões de parceiros.
 *
 * Mesma filosofia do batch_movements: registro IMUTÁVEL por evento, nunca um
 * SUM() recalculado na hora. Cada pedido com cupom de parceiro gera UMA linha
 * (UNIQUE order_id → idempotência, nunca credita 2x). rate/base são congelados
 * no ato: mudar a % do parceiro depois não altera o histórico.
 *
 * status: 'aprovado' (conta no saldo) | 'estornado' (pedido cancelado).
 * competence: 'YYYY-MM' do pedido, para o extrato mensal sem tabela de fechamento.
 *
 * Base da comissão = perfumes − desconto − cupom (SEM frete). O saldo do parceiro
 * (Fase 4, resgate) = SUM(amount aprovado) − SUM(partner_redemptions).
 */

exports.up = function (knex) {
  return knex.schema.createTable('partner_commissions', (table) => {
    table.increments('id').primary()
    table.integer('partner_id').unsigned().notNullable()
      .references('id').inTable('partners').onDelete('RESTRICT')
    table.integer('coupon_id').unsigned().nullable()
      .references('id').inTable('coupons').onDelete('RESTRICT')
    table.integer('order_id').unsigned().notNullable().unique()
      .references('id').inTable('orders').onDelete('RESTRICT')
    table.decimal('base_amount', 14, 2).notNullable().defaultTo(0)
    table.decimal('rate', 5, 2).notNullable().defaultTo(0)
    table.decimal('amount', 14, 2).notNullable().defaultTo(0)
    table.enu('status', ['aprovado', 'estornado']).notNullable().defaultTo('aprovado')
    table.string('competence', 7).notNullable() // YYYY-MM
    table.timestamp('reversed_at').nullable()
    table.text('reversal_reason').nullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    table.index('partner_id')
    table.index('competence')
    table.index('status')
  })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('partner_commissions')
}
