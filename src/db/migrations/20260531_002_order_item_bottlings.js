/**
 * Migration: cria tabela order_item_bottlings (N envases por item de pedido).
 * Migra os vínculos existentes de order_items.bottling_id para a nova tabela,
 * ignorando referências órfãs (bottling deletado) para evitar violação de FK.
 */

exports.up = async function (knex) {
  // Idempotente: se a migration falhou parcialmente na tentativa anterior,
  // a tabela pode já existir — não recria.
  const exists = await knex.schema.hasTable('order_item_bottlings')
  if (!exists) {
    await knex.schema.createTable('order_item_bottlings', t => {
      t.increments('id')
      t.integer('order_item_id').notNullable()
        .references('id').inTable('order_items').onDelete('CASCADE')
      t.integer('bottling_id').notNullable()
        .references('id').inTable('bottlings').onDelete('RESTRICT')
      t.integer('quantity').notNullable().defaultTo(1)
      t.timestamp('created_at').defaultTo(knex.fn.now())
    })
  }

  // Só migra se a coluna bottling_id existir em order_items
  const hasColumn = await knex.schema.hasColumn('order_items', 'bottling_id')
  if (!hasColumn) return

  // JOIN garante que só migramos vínculos com envase ainda existente.
  // whereNotExists evita duplicatas se a migration for re-executada.
  const items = await knex('order_items as oi')
    .join('bottlings as b', 'b.id', 'oi.bottling_id')
    .whereNotNull('oi.bottling_id')
    .whereNotExists(
      knex('order_item_bottlings as oib')
        .whereRaw('oib.order_item_id = oi.id')
        .select(1)
    )
    .select('oi.id', 'oi.bottling_id', 'oi.quantity')

  if (items.length > 0) {
    await knex('order_item_bottlings').insert(
      items.map(i => ({
        order_item_id: parseInt(i.id,          10),
        bottling_id:   parseInt(i.bottling_id, 10),
        quantity:      Math.max(1, parseInt(i.quantity, 10) || 1),
      }))
    )
  }
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('order_item_bottlings')
}
