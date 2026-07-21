/**
 * Migration: Create freight_types table
 * Tipos de frete cadastráveis (Sedex, PAC, Loggi, J&T Express...) usados no pedido.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('freight_types', function (table) {
    table.increments('id').primary()
    table.string('name').notNullable()
    table.boolean('active').defaultTo(true)
    table.timestamps(true, true)

    table.index('active')
  })

  // Tipos comuns já disponíveis no deploy (deploy roda migrations, não seeds).
  await knex('freight_types').insert([
    { name: 'Sedex' },
    { name: 'PAC' },
    { name: 'Loggi' },
    { name: 'J&T Express' },
  ])
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('freight_types')
}
