/**
 * Migration: Create products table
 * Produtos são os conceitos dos perfumes (ex: "Inspirado em Sauvage")
 */

exports.up = function(knex) {
  return knex.schema.createTable('products', function(table) {
    table.increments('id').primary()
    
    // Informações básicas do produto
    table.string('project_name').notNullable()           // Nome do projeto
    table.string('inspiration_brand').defaultTo('')     // Marca inspiração (ex: "Dior")
    table.string('inspiration_name').defaultTo('')      // Nome inspiração (ex: "Sauvage")
    table.string('commercial_name').defaultTo('')       // Nome comercial
    table.enu('gender', ['Masculino', 'Feminino', 'Unissex']).defaultTo('Unissex')
    
    // Descrições
    table.text('narrative').defaultTo('')               // História/narrativa do perfume
    table.text('top_notes').defaultTo('')              // Notas de saída
    table.text('heart_notes').defaultTo('')            // Notas de coração  
    table.text('base_notes').defaultTo('')             // Notas de fundo
    table.text('notes').defaultTo('')                  // Observações gerais
    
    // Status e controle
    table.boolean('active').defaultTo(true)
    table.timestamps(true, true)                        // created_at, updated_at
    
    // Índices
    table.index('project_name')
    table.index('inspiration_brand')
    table.index('active')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('products')
}