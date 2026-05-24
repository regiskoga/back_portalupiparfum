exports.up = async function (knex) {
  await knex.schema.alterTable('supplies', (table) => {
    table.boolean('is_formula_ingredient').notNullable().defaultTo(false)
  })
  // Insumos do tipo Essence, Base e Chemical já são ingredientes de fórmula
  await knex('supplies')
    .whereIn('type', ['Essence', 'Base', 'Chemical'])
    .update({ is_formula_ingredient: true })
}

exports.down = function (knex) {
  return knex.schema.alterTable('supplies', (table) => {
    table.dropColumn('is_formula_ingredient')
  })
}
