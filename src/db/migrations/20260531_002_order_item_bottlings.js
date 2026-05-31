/**
 * Migration: cria tabela order_item_bottlings (N envases por item de pedido).
 * Migra os vínculos existentes de order_items.bottling_id para a nova tabela.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('order_item_bottlings', t => {
    t.increments('id')
    t.integer('order_item_id').notNullable()
      .references('id').inTable('order_items').onDelete('CASCADE')
    t.integer('bottling_id').notNullable()
      .references('id').inTable('bottlings').onDelete('RESTRICT')
    t.integer('quantity').notNullable().defaultTo(1)
    t.timestamp('created_at').defaultTo(knex.fn.now())
  })

  // Migra vínculos já existentes
  const items = await knex('order_items')
    .whereNotNull('bottling_id')
    .select('id', 'bottling_id', 'quantity')

  if (items.length > 0) {
    await knex('order_item_bottlings').insert(
      items.map(i => ({
        order_item_id: i.id,
        bottling_id:   i.bottling_id,
        quantity:      i.quantity,
      }))
    )
  }
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('order_item_bottlings')
}
