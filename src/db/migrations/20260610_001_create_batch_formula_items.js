exports.up = async function (knex) {
  await knex.schema.createTable('batch_formula_items', table => {
    table.increments('id')
    table.integer('batch_id').notNullable()
      .references('id').inTable('batches').onDelete('CASCADE')
    table.integer('supply_id')
      .references('id').inTable('supplies').onDelete('SET NULL')
    table.decimal('quantity', 14, 6).notNullable()
    table.string('unit', 20)
    table.timestamps(true, true)
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('batch_formula_items')
}
