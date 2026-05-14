exports.up = function (knex) {
  return knex.schema.alterTable('products', (table) => {
    table.string('sku', 100).nullable()
    table.index('sku')
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('products', (table) => {
    table.dropIndex('sku')
    table.dropColumn('sku')
  })
}
