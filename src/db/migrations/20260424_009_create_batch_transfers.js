/**
 * Migration: Transferências de Lotes
 * 
 * Registra movimentações internas de líquido entre frascos âmbar.
 * Transferências não alteram o custo do lote, apenas reorganizam fisicamente.
 */

exports.up = function(knex) {
  return knex.schema.createTable('batch_transfers', table => {
    table.increments('id').primary()
    
    // Lotes envolvidos
    table.integer('source_batch_id')
      .notNullable()
      .references('id')
      .inTable('batches')
      .onDelete('RESTRICT')
      .comment('Lote de origem')
    
    table.integer('destination_batch_id')
      .notNullable()
      .references('id')
      .inTable('batches')
      .onDelete('RESTRICT')
      .comment('Lote de destino (pode ser o mesmo para reorganização)')
    
    // Quantidade transferida
    table.decimal('quantity_ml', 14, 6)
      .notNullable()
      .comment('Quantidade em ML transferida')
    
    // Informações adicionais
    table.text('reason').nullable().comment('Motivo da transferência')
    table.text('notes').nullable().comment('Observações')
    
    // Controle
    table.string('operator').notNullable().defaultTo('system')
      .comment('Quem realizou a transferência')
    
    table.timestamp('transferred_at').defaultTo(knex.fn.now())
      .comment('Quando foi transferido')
    
    table.timestamp('created_at').defaultTo(knex.fn.now())
    
    // Índices para performance
    table.index('source_batch_id')
    table.index('destination_batch_id')
    table.index('transferred_at')
    table.index(['source_batch_id', 'transferred_at'])
    table.index(['destination_batch_id', 'transferred_at'])
    
    // Constraint: não pode transferir quantidade negativa
    table.check('quantity_ml > 0', [], 'check_positive_quantity')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('batch_transfers')
}
