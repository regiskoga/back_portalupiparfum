/**
 * Migration: guarda a embalagem escolhida no item do pedido.
 *
 * O frontend já enviava `packaging_type_id` por item, mas a coluna não existia
 * e o valor era descartado no insert — por isso, ao editar um item, não havia
 * como mostrar qual frasco tinha sido vendido, e trocar o volume não achava o
 * preço certo (o preço é resolvido por produto + embalagem + volume).
 *
 * Backfill: para os itens antigos, deduz a embalagem pelo volume, mas SÓ quando
 * existe exatamente uma embalagem ativa com aquele volume (hoje 3/15/30/50/100
 * são 1:1). Volume ambíguo ou sem embalagem fica NULL.
 */

exports.up = async function (knex) {
  const exists = await knex.schema.hasColumn('order_items', 'packaging_type_id')
  if (!exists) {
    await knex.schema.alterTable('order_items', (t) => {
      t.integer('packaging_type_id').nullable()
        .references('id').inTable('packaging_types').onDelete('SET NULL')
      t.index('packaging_type_id')
    })
  }

  await knex.raw(`
    UPDATE order_items oi
       SET packaging_type_id = pt.id
      FROM packaging_types pt
     WHERE oi.packaging_type_id IS NULL
       AND pt.active = true
       AND pt.volume_ml = oi.volume_ml
       AND (SELECT COUNT(*) FROM packaging_types p2
             WHERE p2.active = true AND p2.volume_ml = oi.volume_ml) = 1
  `)
}

exports.down = function (knex) {
  return knex.schema.alterTable('order_items', (t) => {
    t.dropColumn('packaging_type_id')
  })
}
