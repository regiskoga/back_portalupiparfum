/**
 * Migration: Customer Gifts (Brindes de Clientes)
 * Prompt #3: Alerta de brinde duplicado
 * 
 * Registra todos os brindes dados aos clientes para evitar duplicação
 */

exports.up = function(knex) {
  return knex.schema.createTable('customer_gifts', table => {
    table.increments('id').primary()
    
    // Relacionamentos
    table.integer('customer_id')
      .references('id')
      .inTable('customers')
      .notNullable()
      .onDelete('CASCADE')
    
    table.integer('order_id')
      .references('id')
      .inTable('orders')
      .nullable()
      .onDelete('SET NULL')
    
    // Dados do brinde
    table.text('gift_name').notNullable()
    table.text('gift_type').nullable() // Amostra, Brinde, Cortesia, etc.
    table.text('gift_description').nullable()
    table.decimal('gift_value', 14, 2).defaultTo(0) // Valor do brinde para controle
    
    // Controle
    table.text('operator').defaultTo('system')
    table.text('notes').nullable()
    
    // Timestamps
    table.timestamp('given_at').defaultTo(knex.fn.now())
    table.timestamp('created_at').defaultTo(knex.fn.now())
    
    // Índices para performance
    table.index(['customer_id', 'gift_name'], 'idx_customer_gifts_lookup')
    table.index('given_at', 'idx_customer_gifts_date')
    table.index('order_id', 'idx_customer_gifts_order')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('customer_gifts')
}