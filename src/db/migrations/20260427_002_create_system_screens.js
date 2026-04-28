/**
 * Migration: Create system_screens table
 */

exports.up = function(knex) {
  return knex.schema.createTable('system_screens', (table) => {
    table.increments('id').primary()
    table.text('screen_key').notNullable().unique() // dashboard-overview, insumos, etc
    table.text('screen_name').notNullable() // Nome para exibição
    table.text('category').defaultTo('') // Dashboard, Estoque, Produção, etc
    table.text('route').defaultTo('') // Rota no frontend
    table.integer('sort_order').defaultTo(0)
    table.boolean('is_active').defaultTo(true)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('system_screens')
}