exports.up = function (knex) {
  return knex.schema.alterTable('products', (table) => {
    table.string('bottle_photo_url').nullable()
    table.string('original_photo_url').nullable()
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('products', (table) => {
    table.dropColumn('bottle_photo_url')
    table.dropColumn('original_photo_url')
  })
}
