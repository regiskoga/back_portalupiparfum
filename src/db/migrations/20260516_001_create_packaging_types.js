exports.up = function(knex) {
  return knex.schema.createTable('packaging_types', function(table) {
    table.increments('id').primary()
    table.string('name').notNullable()
    table.decimal('volume_ml', 8, 2).notNullable()
    table.string('format').nullable()                          // identidade: "quadrado", "redondo", "roll-on", etc.
    table.decimal('suggested_price', 10, 2).nullable()        // preço sugerido padrão para tabela de preços
    table.boolean('active').defaultTo(true)
    table.timestamps(true, true)

    table.check('volume_ml > 0')
    table.check('suggested_price IS NULL OR suggested_price >= 0')
    table.index('active')
    table.index('volume_ml')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('packaging_types')
}
