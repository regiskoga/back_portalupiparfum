/**
 * Migration: Cria tabela batch_essences
 * Registra quais essências (insumos tipo Essence) foram usadas em cada lote,
 * com fornecedor, quantidade e unidade — para rastreabilidade e custo.
 */

exports.up = function (knex) {
  return knex.schema.createTable('batch_essences', (table) => {
    table.increments('id').primary()
    table.integer('batch_id').unsigned().notNullable().references('id').inTable('batches').onDelete('CASCADE')
    table.integer('supply_id').unsigned().notNullable().references('id').inTable('supplies').onDelete('RESTRICT')
    table.decimal('quantity', 10, 3).notNullable()
    table.string('unit').notNullable().defaultTo('ml')
    table.timestamps(true, true)
    table.index('batch_id')
    table.index('supply_id')
    table.check('quantity > 0')
  })
}

exports.down = function (knex) {
  return knex.schema.dropTable('batch_essences')
}
