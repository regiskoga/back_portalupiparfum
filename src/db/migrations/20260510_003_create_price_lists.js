exports.up = function (knex) {
  return knex.schema.createTable('price_lists', table => {
    table.increments('id').primary()
    table.integer('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE')
    table.decimal('volume_ml', 10, 2).notNullable()
    table.decimal('price', 14, 2).notNullable()
    table.date('valid_from').notNullable()
    table.date('valid_to').nullable().defaultTo(null)
    table.text('notes').defaultTo('')
    table.timestamps(true, true)

    table.index('product_id')
    table.index('valid_from')
    table.index('valid_to')
  })
}

exports.down = function (knex) {
  return knex.schema.dropTable('price_lists')
}
