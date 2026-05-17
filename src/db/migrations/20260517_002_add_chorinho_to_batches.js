exports.up = function (knex) {
  return knex.schema.alterTable('batches', table => {
    table.decimal('chorinho_ml', 10, 2).defaultTo(0).notNullable()
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('batches', table => {
    table.dropColumn('chorinho_ml')
  })
}
