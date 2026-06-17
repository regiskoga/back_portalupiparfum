/**
 * Migration: apaga todos os dados operacionais para deploy em produção.
 * Preserva: users, sessions, user_profiles, system_screens,
 *           profile_permissions, parameters, packaging_types,
 *           volume_discounts, system_rules (+ history + notifications).
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
  const { rows } = await knex.raw(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `)

  const tables = rows.map(r => r.tablename).filter(t => !KEEP.has(t))
  if (tables.length === 0) return

  const list = tables.map(t => `"${t}"`).join(', ')
  await knex.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

exports.down = function () {}
