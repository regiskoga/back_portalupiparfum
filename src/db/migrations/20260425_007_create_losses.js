/**
 * Migration: Create losses table
 * Registra perdas de insumos e lotes (vazamento, quebra, roubo, evaporação)
 */

exports.up = function(knex) {
  return knex.schema.createTable('losses', (table) => {
    table.increments('id').primary()
    table.enu('loss_type', ['Leakage', 'Breakage', 'Theft', 'Evaporation', 'Expiration', 'Other'])
      .notNullable()
    table.enu('item_type', ['Supply', 'Batch', 'Bottling'])
      .notNullable()
    table.integer('item_id').unsigned().notNullable() // ID do insumo, lote ou envase
    table.text('item_name').notNullable() // Nome para referência
    table.decimal('quantity_lost', 14, 6).notNullable()
    table.text('unit').notNullable() // ml, g, unidade
    table.decimal('cost', 14, 2).notNullable() // Custo calculado automaticamente
    table.text('reason').notNullable() // Motivo detalhado
    table.text('operator').defaultTo('') // Quem registrou
    table.timestamp('occurred_at').notNullable() // Quando ocorreu
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // Indexes
    table.index('loss_type')
    table.index('item_type')
    table.index('item_id')
    table.index('occurred_at')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('losses')
}
