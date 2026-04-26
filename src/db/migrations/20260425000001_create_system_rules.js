/**
 * Migration: Sistema de Regras Configuráveis
 * Cria tabelas para regras de sistema com versionamento e histórico
 */

exports.up = function(knex) {
  return knex.schema
    // Tabela principal de regras
    .createTable('system_rules', function(table) {
      table.increments('id').primary();
      table.string('key', 100).notNullable().unique(); // chave única da regra
      table.string('category', 50).notNullable(); // categoria (calculo, temporal, estoque, etc)
      table.string('title', 200).notNullable(); // título da regra
      table.text('description').notNullable(); // descrição detalhada
      table.json('config').nullable(); // configurações específicas (JSON)
      table.decimal('numeric_value', 10, 4).nullable(); // valor numérico se aplicável
      table.string('text_value', 500).nullable(); // valor texto se aplicável
      table.boolean('is_active').defaultTo(true); // regra ativa/inativa
      table.boolean('is_editable').defaultTo(true); // pode ser editada
      table.integer('version').defaultTo(1); // versão atual
      table.integer('created_by').nullable(); // ID do usuário que criou
      table.integer('updated_by').nullable(); // ID do usuário que atualizou
      table.timestamps(true, true); // created_at, updated_at
      
      // Índices
      table.index(['category']);
      table.index(['is_active']);
      table.index(['key']);
    })
    
    // Histórico de mudanças das regras
    .createTable('system_rules_history', function(table) {
      table.increments('id').primary();
      table.integer('rule_id').notNullable();
      table.string('action', 20).notNullable(); // CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE
      table.json('old_values').nullable(); // valores anteriores
      table.json('new_values').nullable(); // novos valores
      table.text('change_reason').nullable(); // motivo da mudança
      table.integer('changed_by').nullable(); // ID do usuário
      table.timestamp('changed_at').defaultTo(knex.fn.now());
      
      // Foreign key
      table.foreign('rule_id').references('id').inTable('system_rules').onDelete('CASCADE');
      
      // Índices
      table.index(['rule_id']);
      table.index(['changed_at']);
      table.index(['action']);
    })
    
    // Notificações de mudanças nas regras
    .createTable('system_rules_notifications', function(table) {
      table.increments('id').primary();
      table.integer('rule_id').notNullable();
      table.string('type', 30).notNullable(); // RULE_CREATED, RULE_UPDATED, RULE_DELETED
      table.string('title', 200).notNullable();
      table.text('message').notNullable();
      table.json('metadata').nullable(); // dados extras
      table.boolean('is_read').defaultTo(false);
      table.integer('user_id').nullable(); // usuário específico (null = todos)
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Foreign key
      table.foreign('rule_id').references('id').inTable('system_rules').onDelete('CASCADE');
      
      // Índices
      table.index(['is_read']);
      table.index(['created_at']);
      table.index(['type']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('system_rules_notifications')
    .dropTableIfExists('system_rules_history')
    .dropTableIfExists('system_rules');
};