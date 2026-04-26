/**
 * Migration: Create customers table
 */

exports.up = function(knex) {
  return knex.schema.createTable('customers', (table) => {
    table.increments('id').primary()
    table.text('name').notNullable()
    table.text('tax_id').defaultTo('') // cpf_cnpj
    table.text('phone').defaultTo('')
    table.text('email').defaultTo('')
    table.text('address').defaultTo('')
    table.text('city').defaultTo('')
    table.text('state').defaultTo('') // uf
    table.text('zip_code').defaultTo('') // cep
    table.text('notes').defaultTo('')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // Index
    table.index('name')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('customers')
}
