exports.up = function (knex) {
  return knex.schema.table('bottlings', table => {
    table.integer('quantity_available').notNullable().defaultTo(0)
  }).then(() =>
    knex.raw('UPDATE bottlings SET quantity_available = quantity')
  )
}

exports.down = function (knex) {
  return knex.schema.table('bottlings', table => {
    table.dropColumn('quantity_available')
  })
}
