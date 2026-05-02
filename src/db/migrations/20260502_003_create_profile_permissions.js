/**
 * Migration: Permissões por Perfil
 * Define quais telas cada perfil pode acessar
 */

exports.up = function(knex) {
  return knex.schema.createTable('profile_screen_permissions', table => {
    table.increments('id').primary()
    table.enum('profile', ['ADM', 'GERENTE', 'OPERADOR', 'VISUALIZADOR']).notNullable()
    table.string('screen_key', 100).notNullable() // Ex: 'dashboard', 'insumos', 'usuarios'
    table.boolean('can_view').notNullable().defaultTo(false)
    table.boolean('can_create').notNullable().defaultTo(false)
    table.boolean('can_edit').notNullable().defaultTo(false)
    table.boolean('can_delete').notNullable().defaultTo(false)
    table.timestamps(true, true)
    
    // Índices
    table.unique(['profile', 'screen_key'])
    table.index('profile')
    table.index('screen_key')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('profile_screen_permissions')
}
