/**
 * Migration: Sistema de Autenticação de Usuários
 * Cria tabela de usuários com controle de acesso por perfil
 */

exports.up = function(knex) {
  return knex.schema.createTable('users', table => {
    table.increments('id').primary()
    table.string('name', 255).notNullable()
    table.string('email', 255).notNullable().unique()
    table.string('password_hash', 255).notNullable()
    table.enum('profile', ['ADM', 'GERENTE', 'OPERADOR', 'VISUALIZADOR']).notNullable().defaultTo('VISUALIZADOR')
    table.boolean('active').notNullable().defaultTo(true)
    table.timestamp('last_login').nullable()
    table.timestamps(true, true) // created_at, updated_at
    
    // Índices
    table.index('email')
    table.index('profile')
    table.index('active')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users')
}
