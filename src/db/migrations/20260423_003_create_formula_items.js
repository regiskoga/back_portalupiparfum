/**
 * Migration: Create formula_items table
 * Itens das fórmulas (insumos com seus percentuais)
 */

exports.up = function(knex) {
  return knex.schema.createTable('formula_items', function(table) {
    table.increments('id').primary()
    
    // Relacionamentos
    table.integer('formula_id').unsigned().notNullable()
    table.foreign('formula_id').references('id').inTable('formulas').onDelete('CASCADE')
    
    table.integer('supply_id').unsigned().notNullable()
    table.foreign('supply_id').references('id').inTable('supplies').onDelete('RESTRICT')
    
    // Percentual do insumo na fórmula
    table.decimal('percentage', 5, 2).notNullable()    // Ex: 15.50%
    table.text('notes').defaultTo('')                  // Observações específicas
    
    // Ordem de adição (para receitas que importam a sequência)
    table.integer('order_index').defaultTo(0)
    
    table.timestamps(true, true)
    
    // Índices
    table.index('formula_id')
    table.index('supply_id')
    
    // Constraints
    table.check('percentage > 0 AND percentage <= 100')
    table.unique(['formula_id', 'supply_id']) // Mesmo insumo não pode repetir na fórmula
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('formula_items')
}