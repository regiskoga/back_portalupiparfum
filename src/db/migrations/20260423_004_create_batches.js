/**
 * Migration: Create batches table
 * Lotes são as produções físicas das fórmulas
 */

exports.up = function(knex) {
  return knex.schema.createTable('batches', function(table) {
    table.increments('id').primary()
    
    // Relacionamento com fórmula
    table.integer('formula_id').unsigned().notNullable()
    table.foreign('formula_id').references('id').inTable('formulas').onDelete('RESTRICT')
    
    // Informações do lote
    table.string('batch_code').notNullable().unique()  // Código único do lote
    table.date('production_date').notNullable()        // Data de produção
    table.decimal('quantity_ml', 10, 2).notNullable()  // Quantidade produzida em ml
    table.decimal('remaining_ml', 10, 2).notNullable() // ML restante (atualizado com envases)
    
    // Custos (calculados automaticamente)
    table.decimal('total_cost', 10, 4).notNullable().defaultTo(0)     // Custo total do lote
    table.decimal('cost_per_ml', 10, 6).notNullable().defaultTo(0)    // Custo por ml
    
    // Status do lote
    table.enu('status', [
      'Em maceração',
      'Pronto para envase', 
      'Finalizado'
    ]).defaultTo('Em maceração')
    
    // Controle de maceração
    table.date('maceration_start').nullable()          // Início da maceração
    table.date('maceration_end').nullable()            // Fim da maceração (calculado)
    
    // Observações e controle
    table.text('notes').defaultTo('')
    table.boolean('active').defaultTo(true)
    table.timestamps(true, true)
    
    // Índices
    table.index('formula_id')
    table.index('batch_code')
    table.index('production_date')
    table.index('status')
    table.index('maceration_end')
    
    // Constraints
    table.check('quantity_ml > 0')
    table.check('remaining_ml >= 0')
    table.check('remaining_ml <= quantity_ml')
    table.check('total_cost >= 0')
    table.check('cost_per_ml >= 0')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('batches')
}