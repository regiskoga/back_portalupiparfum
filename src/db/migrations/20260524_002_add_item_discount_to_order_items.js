exports.up = function (knex) {
  return knex.schema.alterTable('order_items', (table) => {
    table.decimal('item_discount', 10, 2).notNullable().defaultTo(0)
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('order_items', (table) => {
    table.dropColumn('item_discount')
  })
}
