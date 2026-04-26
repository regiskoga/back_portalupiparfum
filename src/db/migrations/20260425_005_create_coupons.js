/**
 * Migration: Create coupons table
 * Sistema de cupons de desconto
 */

exports.up = function(knex) {
  return knex.schema.createTable('coupons', (table) => {
    table.increments('id').primary()
    table.text('code').notNullable().unique()
    table.text('description').defaultTo('')
    table.enu('type', ['Percentage', 'Fixed Amount', 'Progressive', 'Buy X Get Y'])
      .notNullable().defaultTo('Percentage')
    table.decimal('discount_value', 14, 2).notNullable() // % ou valor fixo
    table.integer('min_items') // Para "Buy X Get Y"
    table.integer('free_items') // Para "Buy X Get Y"
    table.decimal('min_order_value', 14, 2).defaultTo(0) // Valor mínimo do pedido
    table.integer('max_uses') // Limite de usos (null = ilimitado)
    table.integer('current_uses').notNullable().defaultTo(0)
    table.boolean('active').notNullable().defaultTo(true)
    table.timestamp('valid_from').defaultTo(knex.fn.now())
    table.timestamp('valid_until')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // Indexes
    table.index('code')
    table.index('active')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('coupons')
}
