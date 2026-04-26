/**
 * Migration: Create activity_logs table
 * Log centralizado de todas as movimentações do sistema
 */

exports.up = function(knex) {
  return knex.schema.createTable('activity_logs', function(table) {
    table.increments('id').primary()
    
    // Tipo de atividade
    table.enu('activity_type', [
      'product_created',
      'product_updated',
      'product_deleted',
      'formula_created',
      'formula_updated',
      'formula_deleted',
      'formula_validated',
      'batch_created',
      'batch_updated',
      'batch_deleted',
      'batch_maceration_started',
      'bottling_created',
      'bottling_updated',
      'bottling_deleted',
      'supply_created',
      'supply_updated',
      'supply_deleted',
      'supplier_created',
      'supplier_updated',
      'supplier_deleted',
      'customer_created',
      'customer_updated',
      'customer_deleted',
      'order_created',
      'order_updated',
      'order_deleted',
      'loss_recorded',
      'donation_recorded',
      'transfer_recorded'
    ]).notNullable()
    
    // Entidade afetada
    table.string('entity_type').notNullable()  // 'product', 'formula', 'batch', etc.
    table.integer('entity_id').unsigned().notNullable()
    table.string('entity_name').nullable()     // Nome/código da entidade
    
    // Detalhes da mudança
    table.jsonb('changes').nullable()          // Dados antes/depois
    table.text('description').nullable()       // Descrição legível
    
    // Rastreabilidade
    table.string('operator').defaultTo('system')  // Quem fez a ação
    table.string('ip_address').nullable()
    table.string('user_agent').nullable()
    
    // Timestamps
    table.timestamps(true, true)
    
    // Índices para busca rápida
    table.index('activity_type')
    table.index('entity_type')
    table.index('entity_id')
    table.index('created_at')
    table.index(['entity_type', 'entity_id'])
    
    // Índice composto para rastreabilidade
    table.index(['entity_type', 'entity_id', 'created_at'])
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('activity_logs')
}