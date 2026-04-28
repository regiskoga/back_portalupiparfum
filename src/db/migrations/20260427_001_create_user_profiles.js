/**
 * Migration: Create user_profiles table
 */

exports.up = function(knex) {
  return knex.schema.createTable('user_profiles', (table) => {
    table.increments('id').primary()
    table.text('name').notNullable().unique() // ADM, Vendedor, Visualizador
    table.text('description').defaultTo('')
    table.boolean('is_active').defaultTo(true)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_profiles')
}