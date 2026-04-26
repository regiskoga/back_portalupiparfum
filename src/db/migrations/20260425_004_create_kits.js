/**
 * Migration: Create kits table
 * Kits automáticos (ex: Kit 3x15ml, Kit 2x30ml)
 */

exports.up = function(knex) {
  return knex.schema.createTable('kits', (table) => {
    table.increments('id').primary()
    table.text('name').notNullable()
    table.text('description').defaultTo('')
    table.integer('quantity').notNullable() // Quantidade de itens no kit
    table.decimal('volume_ml', 14, 2).notNullable() // Volume de cada item
    table.decimal('discount_percentage', 5, 2).notNullable().defaultTo(0) // Desconto do kit
    table.boolean('active').notNullable().defaultTo(true)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // Index
    table.index('active')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('kits')
}
