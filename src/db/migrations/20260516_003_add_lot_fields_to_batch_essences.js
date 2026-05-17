exports.up = function (knex) {
  return knex.schema.alterTable('batch_essences', table => {
    table.string('essence_code').nullable()      // código/ref da essência (do fornecedor)
    table.string('supplier_lot_ref').nullable()  // lote do fornecedor (rastreabilidade)
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('batch_essences', table => {
    table.dropColumn('essence_code')
    table.dropColumn('supplier_lot_ref')
  })
}
