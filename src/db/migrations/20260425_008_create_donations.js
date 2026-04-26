/**
 * Migration: Create donations table
 * Registra doações e presentes (sem gerar receita)
 */

exports.up = function(knex) {
  return knex.schema.createTable('donations', (table) => {
    table.increments('id').primary()
    table.integer('customer_id').unsigned()
      .references('id').inTable('customers').onDelete('SET NULL')
    table.text('recipient_name').defaultTo('') // Nome do destinatário (se não for cliente cadastrado)
    table.integer('product_id').unsigned()
      .references('id').inTable('products').onDelete('SET NULL')
    table.text('product_name').notNullable()
    table.integer('bottling_id').unsigned()
      .references('id').inTable('bottlings').onDelete('SET NULL')
    table.decimal('volume_ml', 14, 2).notNullable()
    table.integer('quantity').notNullable()
    table.decimal('unit_cost', 14, 2).notNullable() // Custo unitário calculado
    table.decimal('total_cost', 14, 2).notNullable() // Custo total calculado
    table.enu('donation_type', ['Gift', 'Sample', 'Promotion', 'Charity', 'Other'])
      .notNullable().defaultTo('Gift')
    table.text('reason').defaultTo('') // Motivo da doação
    table.text('operator').defaultTo('') // Quem registrou
    table.timestamp('donated_at').notNullable() // Quando foi doado
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // Indexes
    table.index('customer_id')
    table.index('product_id')
    table.index('donation_type')
    table.index('donated_at')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('donations')
}
