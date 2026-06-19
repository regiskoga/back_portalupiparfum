exports.up = function (knex) {
  return knex.schema.alterTable('products', (table) => {
    table.text('main_accords').defaultTo('')
    table.string('perfumer').defaultTo('')
    table.integer('launch_year').nullable()
    table.enu('day_night_profile', ['Dia', 'Noite', 'Ambos']).nullable()
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('products', (table) => {
    table.dropColumn('main_accords')
    table.dropColumn('perfumer')
    table.dropColumn('launch_year')
    table.dropColumn('day_night_profile')
  })
}
