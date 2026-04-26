/**
 * Migration: Create formulas table
 * Fórmulas são as receitas dos produtos (lista de insumos com percentuais)
 */

exports.up = function(knex) {
  return knex.schema.createTable('formulas', function(table) {
    table.increments('id').primary()
    
    // Relacionamento com produto
    table.integer('product_id').unsigned().notNullable()
    table.foreign('product_id').references('id').inTable('products').onDelete('CASCADE')
    
    // Informações da fórmula
    table.string('name').notNullable()                  // Nome da fórmula (ex: "Versão 1.0")
    table.text('description').defaultTo('')            // Descrição da fórmula
    table.decimal('total_percentage', 5, 2).notNullable().defaultTo(0) // Soma dos percentuais
    
    // Status e controle
    table.boolean('active').defaultTo(true)
    table.boolean('validated').defaultTo(false)        // Se soma = 100%
    table.timestamps(true, true)
    
    // Índices
    table.index('product_id')
    table.index('active')
    table.index('validated')
    
    // Constraint: total_percentage deve ser 100 para fórmulas validadas
    table.check('total_percentage >= 0 AND total_percentage <= 100')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('formulas')
}