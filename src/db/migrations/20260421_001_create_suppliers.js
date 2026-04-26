/**
 * Migration: Create suppliers table
 */

exports.up = function(knex) {
  return knex.schema.createTable('suppliers', (table) => {
    table.increments('id').primary()
    table.text('name').notNullable()
    table.text('tax_id').defaultTo('') // cnpj_cpf
    table.text('contact').defaultTo('')
    table.text('email').defaultTo('')
    table.text('phone').defaultTo('')
    table.text('address').defaultTo('')
    table.text('notes').defaultTo('')
    table.text('type').defaultTo('')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('suppliers')
}
