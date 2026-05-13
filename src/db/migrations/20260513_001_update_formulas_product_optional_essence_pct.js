/**
 * Migration: Desvincula fórmulas de projeto + adiciona percentual de essência
 * - product_id torna-se opcional (fórmula padrão não precisa estar ligada a um projeto)
 * - essence_percentage: percentual reservado para a essência (sem insumo específico)
 */

exports.up = async function (knex) {
  await knex.raw('ALTER TABLE formulas ALTER COLUMN product_id DROP NOT NULL')

  await knex.schema.alterTable('formulas', (table) => {
    table.decimal('essence_percentage', 5, 2).notNullable().defaultTo(0)
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('formulas', (table) => {
    table.dropColumn('essence_percentage')
  })
  // Só funciona se não houver linhas com product_id nulo
  await knex.raw('ALTER TABLE formulas ALTER COLUMN product_id SET NOT NULL')
}
