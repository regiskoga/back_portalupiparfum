/**
 * Migration: Adiciona campo para forçar troca de senha no primeiro login
 * Data: 03/05/2026
 */

exports.up = function(knex) {
  return knex.schema.table('users', table => {
    table.boolean('must_change_password').notNullable().defaultTo(true)
    table.timestamp('password_changed_at').nullable()
  })
}

exports.down = function(knex) {
  return knex.schema.table('users', table => {
    table.dropColumn('must_change_password')
    table.dropColumn('password_changed_at')
  })
}
