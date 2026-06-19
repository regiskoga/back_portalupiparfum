exports.up = function (knex) {
  return knex.schema.alterTable('products', (table) => {
    table.enu('catalog_status', ['Lançado', 'Lote único', 'Pré-venda']).nullable()
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('products', (table) => {
    table.dropColumn('catalog_status')
  })
}
