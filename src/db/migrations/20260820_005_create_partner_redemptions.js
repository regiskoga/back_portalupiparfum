/**
 * Migration (Fase 4): resgate de saldo do parceiro (troca por mercadoria/pix).
 *
 * O saldo (comissões aprovadas) é debitado por um RESGATE. Quando é em mercadoria,
 * os envases dados SAEM do estoque na mesma transação (bottlings.quantity_available),
 * documentados em partner_redemption_items — nada de saída "invisível" de estoque.
 *
 * Saldo do parceiro = SUM(partner_commissions aprovado) − SUM(partner_redemptions ativo).
 * Resgate cancelado (status='cancelado') volta ao saldo e restaura o estoque.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('partner_redemptions', (table) => {
    table.increments('id').primary()
    table.integer('partner_id').unsigned().notNullable()
      .references('id').inTable('partners').onDelete('RESTRICT')
    table.decimal('amount', 14, 2).notNullable().defaultTo(0) // R$ debitado do saldo
    table.enu('payout_mode', ['mercadoria', 'pix']).notNullable().defaultTo('mercadoria')
    table.text('description').defaultTo('')
    table.enu('status', ['ativo', 'cancelado']).notNullable().defaultTo('ativo')
    table.date('redeemed_at').defaultTo(knex.fn.now())
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    table.index('partner_id')
    table.index('status')
  })

  await knex.schema.createTable('partner_redemption_items', (table) => {
    table.increments('id').primary()
    table.integer('redemption_id').unsigned().notNullable()
      .references('id').inTable('partner_redemptions').onDelete('CASCADE')
    table.integer('bottling_id').unsigned().notNullable()
      .references('id').inTable('bottlings').onDelete('RESTRICT')
    table.integer('quantity').notNullable().defaultTo(1)
    table.text('product_name').defaultTo('')      // snapshot p/ histórico
    table.decimal('volume_ml', 14, 2).defaultTo(0) // snapshot
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('partner_redemption_items')
  await knex.schema.dropTableIfExists('partner_redemptions')
}
