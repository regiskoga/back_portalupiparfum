/**
 * Migration: introduz brindes no sistema.
 *   1. Adiciona coluna `type` em bottlings ('normal' | 'brinde').
 *   2. Cria tabela order_gifts (vínculo entre pedido e envase do tipo brinde).
 */

exports.up = async function (knex) {
  const hasType = await knex.schema.hasColumn('bottlings', 'type')
  if (!hasType) {
    await knex.schema.alterTable('bottlings', t => {
      t.string('type', 20).notNullable().defaultTo('normal')
    })
    await knex('bottlings').whereNull('type').update({ type: 'normal' })
  }

  const hasOrderGifts = await knex.schema.hasTable('order_gifts')
  if (!hasOrderGifts) {
    await knex.schema.createTable('order_gifts', t => {
      t.increments('id')
      t.integer('order_id').notNullable()
        .references('id').inTable('orders').onDelete('CASCADE')
      t.integer('bottling_id').notNullable()
        .references('id').inTable('bottlings').onDelete('RESTRICT')
      t.integer('quantity').notNullable().defaultTo(1)
      t.text('notes').defaultTo('')
      t.timestamp('created_at').defaultTo(knex.fn.now())

      t.index('order_id')
      t.index('bottling_id')
    })
  }
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('order_gifts')
  const hasType = await knex.schema.hasColumn('bottlings', 'type')
  if (hasType) {
    await knex.schema.alterTable('bottlings', t => {
      t.dropColumn('type')
    })
  }
}
