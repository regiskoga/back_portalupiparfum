exports.up = function (knex) {
  return knex.schema.table('orders', table => {
    table.string('payment_method').nullable()
    table.decimal('amount_paid', 10, 2).nullable()
    table.date('payment_date').nullable()
  })
}

exports.down = function (knex) {
  return knex.schema.table('orders', table => {
    table.dropColumn('payment_method')
    table.dropColumn('amount_paid')
    table.dropColumn('payment_date')
  })
}
