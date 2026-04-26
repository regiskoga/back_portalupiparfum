/**
 * Seed: Migrate data from Portuguese to English tables
 */

const { DatabaseSync } = require('node:sqlite')
const path = require('path')

// Translation maps
const typeMap = {
  'Essência': 'Essence',
  'Base': 'Base',
  'Químico': 'Chemical',
  'Embalagem': 'Packaging',
  'Frasco': 'Bottle',
  'Rótulo': 'Label'
}

const unitMap = {
  'unidade': 'unit',
  'ml': 'ml',
  'g': 'g'
}

const statusMap = {
  'Pendente': 'Pending',
  'Confirmado': 'Confirmed',
  'Em produção': 'In Production',
  'Enviado': 'Shipped',
  'Entregue': 'Delivered',
  'Cancelado': 'Cancelled'
}

const channelMap = {
  '': '',
  'Loja física': 'Physical Store',
  'WhatsApp': 'WhatsApp',
  'Instagram': 'Instagram',
  'Site': 'Website',
  'Indicação': 'Referral',
  'Outro': 'Other'
}

exports.seed = async function(knex) {
  // Path to SQLite database
  const sqlitePath = path.join(__dirname, '../../../parfumerie.db')
  
  // Check if SQLite file exists
  const fs = require('fs')
  if (!fs.existsSync(sqlitePath)) {
    console.log('⚠️  SQLite database not found. Inserting sample data...')
    
    // Insert sample data
    await knex('suppliers').del()
    await knex('suppliers').insert([
      { name: 'Aromax Essences', tax_id: '12.345.678/0001-90', contact: 'Carlos Silva', email: 'carlos@aromax.com.br', phone: '(11) 9 8888-0001', address: 'Rua das Flores, 123 - São Paulo/SP', type: 'Essence' },
      { name: 'QuimiBase LTDA', tax_id: '98.765.432/0001-10', contact: 'Ana Ferreira', email: 'ana@quimibase.com.br', phone: '(11) 9 7777-0002', address: 'Av. Industrial, 456 - Guarulhos/SP', type: 'Chemical' },
      { name: 'EmbalMax', tax_id: '11.222.333/0001-44', contact: 'Pedro Souza', email: 'pedro@embalmax.com.br', phone: '(11) 9 6666-0003', address: 'Rua do Comércio, 789 - Osasco/SP', type: 'Packaging' },
      { name: 'Frasco & Cia', tax_id: '55.666.777/0001-88', contact: 'Lucia Rocha', email: 'lucia@frasccia.com.br', phone: '(11) 9 5555-0004', address: 'Alameda Santos, 321 - São Paulo/SP', type: 'Bottle' },
      { name: 'RótuloArt', tax_id: '33.444.555/0001-22', contact: 'Marcos Lima', email: 'marcos@rotuloart.com.br', phone: '(11) 9 4444-0005', address: 'Rua Gráfica, 654 - Santo André/SP', type: 'Label' }
    ])
    
    console.log('✅ Sample data inserted successfully!')
    return
  }

  console.log('📦 Migrating data from Portuguese to English...')
  
  try {
    // Connect to SQLite
    const sqlite = new DatabaseSync(sqlitePath)
    
    // Clear English tables (in reverse order due to foreign keys)
    await knex('order_items').del()
    await knex('orders').del()
    await knex('supplies').del()
    await knex('customers').del()
    await knex('suppliers').del()
    
    // Migrate suppliers (fornecedores)
    const fornecedores = sqlite.prepare('SELECT * FROM fornecedores').all()
    if (fornecedores.length > 0) {
      const suppliers = fornecedores.map(f => ({
        id: f.id,
        name: f.nome,
        tax_id: f.cnpj_cpf || '',
        contact: f.contato || '',
        email: f.email || '',
        phone: f.telefone || '',
        address: f.endereco || '',
        notes: f.observacoes || '',
        type: f.tipo || '',
        created_at: f.criado_em,
        updated_at: f.atualizado_em
      }))
      await knex('suppliers').insert(suppliers)
      console.log(`✅ ${suppliers.length} suppliers migrated`)
    }
    
    // Migrate supplies (insumos)
    const insumos = sqlite.prepare('SELECT id, nome, tipo, fornecedor_id, unidade, quantidade_comprada, valor_total_pago, lote, observacoes, criado_em, atualizado_em FROM insumos').all()
    if (insumos.length > 0) {
      const supplies = insumos.map(i => ({
        id: i.id,
        name: i.nome,
        type: typeMap[i.tipo] || i.tipo,
        supplier_id: i.fornecedor_id,
        unit: unitMap[i.unidade] || i.unidade,
        quantity_purchased: i.quantidade_comprada,
        total_amount_paid: i.valor_total_pago,
        batch: i.lote || '',
        notes: i.observacoes || '',
        created_at: i.criado_em,
        updated_at: i.atualizado_em
      }))
      await knex('supplies').insert(supplies)
      console.log(`✅ ${supplies.length} supplies migrated`)
    }
    
    // Migrate customers (clientes)
    const clientes = sqlite.prepare('SELECT * FROM clientes').all()
    if (clientes.length > 0) {
      const customers = clientes.map(c => ({
        id: c.id,
        name: c.nome,
        tax_id: c.cpf_cnpj || '',
        phone: c.telefone || '',
        email: c.email || '',
        address: c.endereco || '',
        city: c.cidade || '',
        state: c.uf || '',
        zip_code: c.cep || '',
        notes: c.observacoes || '',
        created_at: c.criado_em,
        updated_at: c.atualizado_em
      }))
      await knex('customers').insert(customers)
      console.log(`✅ ${customers.length} customers migrated`)
    }
    
    // Migrate orders (pedidos)
    const pedidos = sqlite.prepare('SELECT * FROM pedidos').all()
    if (pedidos.length > 0) {
      const orders = pedidos.map(p => ({
        id: p.id,
        customer_id: p.cliente_id,
        code: p.codigo || '',
        status: statusMap[p.status] || p.status,
        channel: channelMap[p.canal] || p.canal || '',
        discount: p.desconto,
        shipping: p.frete,
        notes: p.observacoes || '',
        created_at: p.criado_em,
        updated_at: p.atualizado_em
      }))
      await knex('orders').insert(orders)
      console.log(`✅ ${orders.length} orders migrated`)
    }
    
    // Migrate order_items (pedido_itens)
    const pedidoItens = sqlite.prepare('SELECT * FROM pedido_itens').all()
    if (pedidoItens.length > 0) {
      const orderItems = pedidoItens.map(pi => ({
        id: pi.id,
        order_id: pi.pedido_id,
        product_name: pi.produto_nome,
        product_ref: pi.produto_ref || '',
        quantity: pi.quantidade,
        unit_price: pi.preco_unitario,
        created_at: pi.criado_em
      }))
      await knex('order_items').insert(orderItems)
      console.log(`✅ ${orderItems.length} order items migrated`)
    }
    
    console.log('🎉 Data migration completed successfully!')
    
  } catch (error) {
    console.error('❌ Error migrating data:', error.message)
    throw error
  }
}
