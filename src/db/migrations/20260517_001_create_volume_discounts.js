exports.up = function (knex) {
  return knex.schema.createTable('volume_discounts', table => {
    table.increments('id').primary()
    table.integer('packaging_type_id').nullable().references('id').inTable('packaging_types').onDelete('CASCADE')
    table.integer('min_quantity').notNullable()
    table.decimal('discount_percentage', 5, 2).notNullable()
    table.boolean('active').defaultTo(true)
    table.timestamps(true, true)
  })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('volume_discounts')
}
