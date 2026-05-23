/**
 * Migration: Fix nullable constraints on automatic order tables
 * - bottling_orders.batch_id: nullable when batch doesn't exist yet (future production)
 * - purchase_orders.supplier_id: nullable when supply has no preferred supplier
 * - production_orders.formula_id: nullable to guard against products without formulas
 */

exports.up = function (knex) {
  return knex.schema
    .alterTable('bottling_orders', (table) => {
      table.integer('batch_id').unsigned().nullable().alter()
    })
    .then(() =>
      knex.schema.alterTable('purchase_orders', (table) => {
        table.integer('supplier_id').unsigned().nullable().alter()
      })
    )
    .then(() =>
      knex.schema.alterTable('production_orders', (table) => {
        table.integer('formula_id').unsigned().nullable().alter()
      })
    )
}

exports.down = function (knex) {
  return knex.schema
    .alterTable('bottling_orders', (table) => {
      table.integer('batch_id').unsigned().notNullable().alter()
    })
    .then(() =>
      knex.schema.alterTable('purchase_orders', (table) => {
        table.integer('supplier_id').unsigned().notNullable().alter()
      })
    )
    .then(() =>
      knex.schema.alterTable('production_orders', (table) => {
        table.integer('formula_id').unsigned().notNullable().alter()
      })
    )
}
