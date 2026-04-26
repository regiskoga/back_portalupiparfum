/**
 * Migration: Create bottling_batches table
 * Relacionamento entre envases e lotes (um envase pode usar múltiplos lotes)
 */

exports.up = function(knex) {
  return knex.schema.createTable('bottling_batches', function(table) {
    table.increments('id').primary()
    
    // Relacionamentos
    table.integer('bottling_id').unsigned().notNullable()
    table.integer('batch_id').unsigned().notNullable()
    
    // Quantidade utilizada deste lote
    table.decimal('ml_used', 10, 2).notNullable()
    
    // Custo proporcional deste lote
    table.decimal('proportional_cost', 10, 4).notNullable().defaultTo(0)
    
    // Timestamps
    table.timestamps(true, true)
    
    // Foreign keys
    table.foreign('bottling_id').references('id').inTable('bottlings').onDelete('CASCADE')
    table.foreign('batch_id').references('id').inTable('batches').onDelete('RESTRICT')
    
    // Índices
    table.index('bottling_id')
    table.index('batch_id')
    
    // Constraint: não permitir duplicatas
    table.unique(['bottling_id', 'batch_id'])
    
    // Constraints
    table.check('ml_used > 0')
    table.check('proportional_cost >= 0')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('bottling_batches')
}