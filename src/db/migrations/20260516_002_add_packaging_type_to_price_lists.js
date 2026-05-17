exports.up = function (knex) {
  return knex.schema.alterTable('price_lists', table => {
    table.integer('packaging_type_id').nullable().references('id').inTable('packaging_types').onDelete('SET NULL')
    table.index('packaging_type_id')
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('price_lists', table => {
    table.dropColumn('packaging_type_id')
  })
}
