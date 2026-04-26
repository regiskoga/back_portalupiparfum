/**
 * Migration: Create bottlings table
 * Envases transformam lotes em produtos finais vendáveis
 */

exports.up = function(knex) {
  return knex.schema.createTable('bottlings', function(table) {
    table.increments('id').primary()
    
    // Código único do envase
    table.string('bottling_code').notNullable().unique()
    
    // Data do envase
    table.date('bottling_date').notNullable()
    
    // Produto final
    table.string('product_name').notNullable()           // Nome do produto final
    table.string('product_ref').nullable()               // Referência/SKU
    table.decimal('volume_ml', 8, 2).notNullable()       // Volume por unidade (3ml, 5ml, 10ml, etc.)
    table.integer('quantity').notNullable()              // Quantidade de frascos
    
    // Insumos utilizados
    table.integer('bottle_supply_id').unsigned().nullable()  // Frasco usado
    table.integer('label_supply_id').unsigned().nullable()   // Rótulo usado
    
    // Custos calculados
    table.decimal('liquid_cost', 10, 4).notNullable().defaultTo(0)    // Custo do líquido
    table.decimal('bottle_cost', 10, 4).notNullable().defaultTo(0)    // Custo dos frascos
    table.decimal('label_cost', 10, 4).notNullable().defaultTo(0)     // Custo dos rótulos
    table.decimal('total_cost', 10, 4).notNullable().defaultTo(0)     // Custo total
    table.decimal('unit_cost', 10, 4).notNullable().defaultTo(0)      // Custo por unidade
    
    // Controle
    table.text('notes').defaultTo('')
    table.boolean('active').defaultTo(true)
    table.timestamps(true, true)
    
    // Foreign keys
    table.foreign('bottle_supply_id').references('id').inTable('supplies').onDelete('SET NULL')
    table.foreign('label_supply_id').references('id').inTable('supplies').onDelete('SET NULL')
    
    // Índices
    table.index('bottling_code')
    table.index('bottling_date')
    table.index('product_name')
    table.index('bottle_supply_id')
    table.index('label_supply_id')
    
    // Constraints
    table.check('volume_ml > 0')
    table.check('quantity > 0')
    table.check('total_cost >= 0')
    table.check('unit_cost >= 0')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('bottlings')
}