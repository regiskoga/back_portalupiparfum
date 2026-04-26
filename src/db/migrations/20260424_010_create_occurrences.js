/**
 * Migration: Ocorrências de Pós-venda
 * 
 * Registra problemas após o envio dos pedidos e as ações tomadas.
 * Tipos: Item faltante, Item errado
 * Ações: Reenvio, Crédito, Reembolso
 */

exports.up = function(knex) {
  return knex.schema.createTable('occurrences', table => {
    table.increments('id').primary()
    
    // Pedido relacionado (obrigatório)
    table.integer('order_id')
      .notNullable()
      .references('id')
      .inTable('orders')
      .onDelete('RESTRICT')
      .comment('Pedido que teve o problema')
    
    // Tipo do problema
    table.enu('type', [
      'Missing Item',      // Item faltante
      'Wrong Item',        // Item errado
      'Damaged Item',      // Item danificado
      'Quality Issue',     // Problema de qualidade
      'Other'              // Outro
    ]).notNullable().comment('Tipo do problema')
    
    // Produto envolvido
    table.integer('product_id')
      .nullable()
      .references('id')
      .inTable('products')
      .onDelete('SET NULL')
      .comment('Produto envolvido (opcional)')
    
    table.text('product_name').nullable()
      .comment('Nome do produto (para referência)')
    
    table.integer('bottling_id')
      .nullable()
      .references('id')
      .inTable('bottlings')
      .onDelete('SET NULL')
      .comment('Envase envolvido (para rastreabilidade)')
    
    table.integer('quantity').nullable()
      .comment('Quantidade de itens afetados')
    
    // Ação tomada
    table.enu('action', [
      'Resend',           // Reenvio
      'Credit',           // Crédito
      'Partial Refund',   // Reembolso parcial
      'Full Refund',      // Reembolso total
      'Replacement',      // Substituição
      'None'              // Nenhuma ação ainda
    ]).defaultTo('None').comment('Ação tomada')
    
    // Crédito (se aplicável)
    table.decimal('credit_amount', 14, 2).nullable()
      .comment('Valor do crédito concedido')
    
    table.date('credit_expiry').nullable()
      .comment('Data de validade do crédito')
    
    table.boolean('credit_used').defaultTo(false)
      .comment('Se o crédito já foi usado')
    
    // Status
    table.enu('status', [
      'Open',           // Aberta
      'In Progress',    // Em andamento
      'Resolved',       // Resolvida
      'Cancelled'       // Cancelada
    ]).defaultTo('Open').comment('Status da ocorrência')
    
    // Descrição e notas
    table.text('description').nullable()
      .comment('Descrição do problema')
    
    table.text('notes').nullable()
      .comment('Observações e histórico de tratativas')
    
    // Controle
    table.string('operator').notNullable().defaultTo('system')
      .comment('Quem registrou a ocorrência')
    
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('resolved_at').nullable()
      .comment('Quando foi resolvida')
    table.timestamp('updated_at').defaultTo(knex.fn.now())
    
    // Índices
    table.index('order_id')
    table.index('status')
    table.index('type')
    table.index('created_at')
    table.index(['order_id', 'status'])
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('occurrences')
}
