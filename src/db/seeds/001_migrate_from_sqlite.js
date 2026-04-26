/**
 * Seed: Migrar dados do SQLite para PostgreSQL
 */

const { DatabaseSync } = require('node:sqlite')
const path = require('path')

exports.seed = async function(knex) {
  // Caminho do banco SQLite
  const sqlitePath = path.join(__dirname, '../../../parfumerie.db')
  
  // Verificar se o arquivo SQLite existe
  const fs = require('fs')
  if (!fs.existsSync(sqlitePath)) {
    console.log('⚠️  Banco SQLite não encontrado. Pulando migração de dados.')
    console.log('   Inserindo dados de exemplo...')
    
    // Inserir dados de exemplo (seed padrão)
    await knex('supplies').del()
    await knex('suppliers').del()
    await knex('suppliers').insert([
      { name: 'Aromax Essências', tax_id: '12.345.678/0001-90', contact: 'Carlos Silva', email: 'carlos@aromax.com.br', phone: '(11) 9 8888-0001', address: 'Rua das Flores, 123 - São Paulo/SP', type: 'Essência' },
      { name: 'QuimiBase LTDA', tax_id: '98.765.432/0001-10', contact: 'Ana Ferreira', email: 'ana@quimibase.com.br', phone: '(11) 9 7777-0002', address: 'Av. Industrial, 456 - Guarulhos/SP', type: 'Químico' },
      { name: 'EmbalMax', tax_id: '11.222.333/0001-44', contact: 'Pedro Souza', email: 'pedro@embalmax.com.br', phone: '(11) 9 6666-0003', address: 'Rua do Comércio, 789 - Osasco/SP', type: 'Embalagem' },
      { name: 'Frasco & Cia', tax_id: '55.666.777/0001-88', contact: 'Lucia Rocha', email: 'lucia@frasccia.com.br', phone: '(11) 9 5555-0004', address: 'Alameda Santos, 321 - São Paulo/SP', type: 'Frasco' },
      { name: 'RótuloArt', tax_id: '33.444.555/0001-22', contact: 'Marcos Lima', email: 'marcos@rotuloart.com.br', phone: '(11) 9 4444-0005', address: 'Rua Gráfica, 654 - Santo André/SP', type: 'Rótulo' }
    ])
    
    console.log('✅ Dados de exemplo inseridos com sucesso!')
    return
  }

  console.log('📦 Migrando dados do SQLite para PostgreSQL...')
  
  try {
    // Conectar ao SQLite
    const sqlite = new DatabaseSync(sqlitePath)
    
    // Limpar tabelas PostgreSQL (em ordem reversa por causa das foreign keys)
    await knex('order_items').del()
    await knex('orders').del()
    await knex('supplies').del()
    await knex('customers').del()
    await knex('suppliers').del()
    
    // Migrar fornecedores
    const fornecedores = sqlite.prepare('SELECT * FROM fornecedores').all()
    if (fornecedores.length > 0) {
      await knex('suppliers').insert(fornecedores)
      console.log(`✅ ${fornecedores.length} fornecedores migrados`)
    }
    
    // Migrar insumos
    const insumos = sqlite.prepare('SELECT id, nome, tipo, fornecedor_id, unidade, quantidade_comprada, valor_total_pago, lote, observacoes, criado_em, atualizado_em FROM insumos').all()
    if (insumos.length > 0) {
      await knex('supplies').insert(insumos)
      console.log(`✅ ${insumos.length} insumos migrados`)
    }
    
    // Migrar clientes
    const clientes = sqlite.prepare('SELECT * FROM clientes').all()
    if (clientes.length > 0) {
      await knex('customers').insert(clientes)
      console.log(`✅ ${clientes.length} clientes migrados`)
    }
    
    // Migrar pedidos
    const pedidos = sqlite.prepare('SELECT * FROM pedidos').all()
    if (pedidos.length > 0) {
      await knex('orders').insert(pedidos)
      console.log(`✅ ${pedidos.length} pedidos migrados`)
    }
    
    // Migrar pedido_itens
    const pedidoItens = sqlite.prepare('SELECT * FROM pedido_itens').all()
    if (pedidoItens.length > 0) {
      await knex('order_items').insert(pedidoItens)
      console.log(`✅ ${pedidoItens.length} itens de pedidos migrados`)
    }
    
    console.log('🎉 Migração de dados concluída com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro ao migrar dados:', error.message)
    throw error
  }
}
