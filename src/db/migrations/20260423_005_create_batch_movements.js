/**
 * Migration: Create batch_movements table
 * Log de todas as movimentações dos lotes (produção, envase, perdas, etc.)
 */

exports.up = function(knex) {
  return knex.schema.createTable('batch_movements', function(table) {
    table.increments('id').primary()
    
    // Relacionamento com lote
    table.integer('batch_id').unsigned().notNullable()
    table.foreign('batch_id').references('id').inTable('batches').onDelete('CASCADE')
    
    // Tipo de movimentação
    table.enu('movement_type', [
      'production',      // Produção inicial
      'bottling',        // Envase
      'loss',           // Perda
      'donation',       // Doação
      'transfer_out',   // Transferência saída
      'transfer_in',    // Transferência entrada
      'adjustment'      // Ajuste manual
    ]).notNullable()
    
    // Quantidades
    table.decimal('quantity_ml', 10, 2).notNullable()  // Quantidade movimentada
    table.decimal('previous_ml', 10, 2).notNullable()  // ML antes da movimentação
    table.decimal('current_ml', 10, 2).notNullable()   // ML após a movimentação
    
    // Referências cruzadas (opcional, dependendo do tipo)
    table.integer('reference_id').nullable()           // ID do envase, perda, etc.
    table.string('reference_type').nullable()          // Tipo da referência
    
    // Observações e controle
    table.text('notes').defaultTo('')
    table.string('operator').defaultTo('system')       // Quem fez a movimentação
    table.timestamp('created_at').defaultTo(knex.fn.now())
    
    // Índices
    table.index('batch_id')
    table.index('movement_type')
    table.index('created_at')
    table.index(['reference_type', 'reference_id'])
    
    // Constraints
    table.check('quantity_ml != 0') // Não permitir movimentação zero
    table.check('current_ml >= 0')  // Não permitir saldo negativo
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('batch_movements')
}