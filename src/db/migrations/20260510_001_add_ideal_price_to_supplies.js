exports.up = function (knex) {
  return knex.schema.alterTable('supplies', (table) => {
    table.decimal('ideal_unit_price', 14, 6).nullable().defaultTo(null)
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('supplies', (table) => {
    table.dropColumn('ideal_unit_price')
  })
}
