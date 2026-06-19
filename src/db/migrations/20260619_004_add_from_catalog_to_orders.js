exports.up = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.boolean('from_catalog').defaultTo(false).notNullable()
    table.index('from_catalog')
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('orders', (table) => {
    table.dropIndex('from_catalog')
    table.dropColumn('from_catalog')
  })
}
