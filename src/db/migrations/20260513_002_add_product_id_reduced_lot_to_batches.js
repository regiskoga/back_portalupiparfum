/**
 * Migration: Adiciona product_id e reduced_lot_number à tabela batches
 * - product_id: referência direta ao projeto (independente da fórmula)
 * - reduced_lot_number: número sequencial do lote por projeto (Lote 1, Lote 2...)
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('batches', (table) => {
    table.integer('product_id').unsigned().nullable().references('id').inTable('products').onDelete('RESTRICT')
    table.integer('reduced_lot_number').notNullable().defaultTo(1)
    table.index('product_id')
    table.index('reduced_lot_number')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('batches', (table) => {
    table.dropIndex('reduced_lot_number')
    table.dropIndex('product_id')
    table.dropColumn('reduced_lot_number')
    table.dropColumn('product_id')
  })
}
