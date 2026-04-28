/**
 * Migration: Create profile_permissions table
 */

exports.up = function(knex) {
  return knex.schema.createTable('profile_permissions', (table) => {
    table.increments('id').primary()
    table.integer('profile_id').unsigned().notNullable()
      .references('id').inTable('user_profiles').onDelete('CASCADE')
    table.integer('screen_id').unsigned().notNullable()
      .references('id').inTable('system_screens').onDelete('CASCADE')
    table.boolean('can_view').defaultTo(false)
    table.boolean('can_create').defaultTo(false)
    table.boolean('can_edit').defaultTo(false)
    table.boolean('can_delete').defaultTo(false)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // Índices
    table.index(['profile_id', 'screen_id'])
    table.unique(['profile_id', 'screen_id'])
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('profile_permissions')
}