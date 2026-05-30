/**
 * Migration: Apaga todos os dados operacionais (reset de testes).
 * Preserva: users, sessions, user_profiles, system_screens,
 *           profile_permissions, parameters, packaging_types,
 *           volume_discounts, system_rules.
 */

const KEEP = new Set([
  'knex_migrations',
  'knex_migrations_lock',
  'users',
  'sessions',
  'user_profiles',
  'system_screens',
  'profile_permissions',
  'parameters',
  'packaging_types',
  'volume_discounts',
  'system_rules',
  'system_rules_notifications',
  'system_rules_history',
])

exports.up = async function (knex) {
  const isPg = ['pg', 'postgresql'].includes(knex.client.config.client)

  if (isPg) {
    const { rows } = await knex.raw(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)
    const tables = rows.map(r => r.tablename).filter(t => !KEEP.has(t))
    if (tables.length === 0) return
    const list = tables.map(t => `"${t}"`).join(', ')
    await knex.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
  } else {
    const ordered = [
      'activity_logs', 'batch_essences', 'batch_movements', 'batch_transfers',
      'bottling_batches', 'bottling_orders', 'production_orders', 'purchase_orders',
      'order_items', 'orders', 'customer_gifts', 'losses', 'donations', 'occurrences',
      'bottlings', 'batches', 'formula_items', 'formulas', 'price_lists',
      'products', 'customers', 'coupons', 'kits', 'suppliers', 'supplies',
    ]
    await knex.raw('PRAGMA foreign_keys = OFF')
    for (const t of ordered) {
      await knex(t).delete().catch(() => {})
    }
    await knex.raw('PRAGMA foreign_keys = ON')
  }
}

exports.down = function () {}
