/**
 * Migration: Create supplies table
 */

exports.up = function(knex) {
  return knex.schema.createTable('supplies', (table) => {
    table.increments('id').primary()
    table.text('name').notNullable()
    table.enu('type', ['Essence', 'Base', 'Chemical', 'Packaging', 'Bottle', 'Label']).notNullable()
    table.integer('supplier_id').unsigned().notNullable()
      .references('id').inTable('suppliers').onDelete('RESTRICT')
    table.enu('unit', ['ml', 'g', 'unit', 'unidade']).notNullable()
    table.decimal('quantity_purchased', 14, 6).notNullable()
    table.decimal('total_amount_paid', 14, 2).notNullable()
    table.text('batch').defaultTo('')
    table.text('notes').defaultTo('')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // Indexes
    table.index('type')
    table.index('supplier_id')
    table.index('name')
  }).then(() => {
    // Add generated column (computed column) with raw SQL
    return knex.raw(`
      ALTER TABLE supplies 
      ADD COLUMN unit_cost DECIMAL(14,6) 
      GENERATED ALWAYS AS (
        CASE 
          WHEN quantity_purchased > 0 
          THEN ROUND(total_amount_paid / quantity_purchased, 6) 
          ELSE 0 
        END
      ) STORED
    `)
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('supplies')
}
