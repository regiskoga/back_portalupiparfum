/**
 * Migration: Limpa todos os dados operacionais para reset de testes.
 * Preserva: users, user_profiles, system_screens, profile_permissions,
 *           parameters, system_rules, packaging_types, volume_discounts.
 */

const TABLES_IN_ORDER = [
  // dependentes primeiro
  'sessions',
  'activity_logs',
  'batch_essences',
  'batch_movements',
  'batch_transfers',
  'customer_gifts',
  'losses',
  'donations',
  'occurrences',
  'bottling_batches',
  'bottling_orders',
  'production_orders',
  'purchase_orders',
  'order_items',
  'orders',
  'bottlings',
  'batches',
  'formula_items',
  'formulas',
  'price_lists',
  'supplies',
  'products',
  'customers',
  'coupons',
  'suppliers',
]

exports.up = async function (knex) {
  const isPg = knex.client.config.client === 'postgresql' || knex.client.config.client === 'pg'

  if (isPg) {
    const tableList = TABLES_IN_ORDER.join(', ')
    await knex.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`)
  } else {
    // SQLite: desabilita FK, apaga em ordem, reabilita
    await knex.raw('PRAGMA foreign_keys = OFF')
    for (const table of TABLES_IN_ORDER) {
      await knex(table).delete()
    }
    await knex.raw('PRAGMA foreign_keys = ON')
  }
}

exports.down = function () {
  // Dados apagados não têm reversão
}
