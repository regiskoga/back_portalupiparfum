/**
 * Migration: Add decision engine fields to orders and order_items
 */

exports.up = function(knex) {
  return knex.schema
    .table('orders', (table) => {
      table.integer('estimated_days').defaultTo(0) // Prazo estimado em dias úteis
      table.date('estimated_delivery') // Data estimada de entrega
      table.integer('coupon_id').unsigned()
        .references('id').inTable('coupons').onDelete('SET NULL')
      table.decimal('coupon_discount', 14, 2).defaultTo(0)
      table.boolean('is_kit').defaultTo(false)
      table.integer('kit_id').unsigned()
        .references('id').inTable('kits').onDelete('SET NULL')
    })
    .then(() => {
      return knex.schema.table('order_items', (table) => {
        table.integer('product_id').unsigned()
          .references('id').inTable('products').onDelete('SET NULL')
        table.decimal('volume_ml', 14, 2).defaultTo(0)
        table.enu('decision_status', [
          'Ready Stock',      // Situação 1: Frasco pronto
          'Needs Bottling',   // Situação 2: Precisa envase
          'In Maceration',    // Situação 3: Lote em maceração
          'Needs Production', // Situação 4: Precisa produção
          'Needs Purchase'    // Situação 5: Precisa compra
        ])
        table.integer('estimated_days').defaultTo(0)
        table.text('decision_notes').defaultTo('')
      })
    })
}

exports.down = function(knex) {
  return knex.schema
    .table('order_items', (table) => {
      table.dropColumn('product_id')
      table.dropColumn('volume_ml')
      table.dropColumn('decision_status')
      table.dropColumn('estimated_days')
      table.dropColumn('decision_notes')
    })
    .then(() => {
      return knex.schema.table('orders', (table) => {
        table.dropColumn('estimated_days')
        table.dropColumn('estimated_delivery')
        table.dropColumn('coupon_id')
        table.dropColumn('coupon_discount')
        table.dropColumn('is_kit')
        table.dropColumn('kit_id')
      })
    })
}
