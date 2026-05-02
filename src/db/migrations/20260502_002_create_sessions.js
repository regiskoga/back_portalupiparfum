/**
 * Migration: Sessões de Usuários
 * Controla sessões ativas e tokens de autenticação
 */

exports.up = function(knex) {
  return knex.schema.createTable('sessions', table => {
    table.increments('id').primary()
    table.integer('user_id').unsigned().notNullable()
    table.string('token', 500).notNullable().unique()
    table.string('ip_address', 45).nullable()
    table.string('user_agent', 500).nullable()
    table.timestamp('expires_at').notNullable()
    table.timestamps(true, true)
    
    // Foreign key
    table.foreign('user_id').references('users.id').onDelete('CASCADE')
    
    // Índices
    table.index('token')
    table.index('user_id')
    table.index('expires_at')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('sessions')
}
