/**
 * Migration: Corrige is_formula_ingredient para insumos existentes.
 * Essence, Base e Chemical são sempre ingredientes de fórmula.
 */
exports.up = function (knex) {
  return knex('supplies')
    .whereIn('type', ['Essence', 'Base', 'Chemical'])
    .update({ is_formula_ingredient: true })
}

exports.down = function () {}
