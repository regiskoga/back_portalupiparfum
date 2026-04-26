const { db } = require('../models/db')

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER DE BRINDES DE CLIENTES - PROMPT #3
// ═══════════════════════════════════════════════════════════════════════════════

// ─── VERIFICAR BRINDE DUPLICADO ───────────────────────────────────────────────
async function checkDuplicateGift(req, res) {
  try {
    const { customer_id, gift_name } = req.query
    
    if (!customer_id || !gift_name) {
      return res.status(400).json({ 
        error: 'customer_id e gift_name são obrigatórios' 
      })
    }
    
    // Buscar histórico de brindes do cliente
    const existingGifts = await db('customer_gifts as cg')
      .leftJoin('orders as o', 'cg.order_id', 'o.id')
      .select(
        'cg.*',
        'o.code as order_code',
        'o.created_at as order_date'
      )
      .where('cg.customer_id', parseInt(customer_id))
      .where('cg.gift_name', 'ilike', `%${gift_name}%`)
      .orderBy('cg.given_at', 'desc')
    
    const isDuplicate = existingGifts.length > 0
    
    if (isDuplicate) {
      const lastGift = existingGifts[0]
      const daysSince = Math.floor((new Date() - new Date(lastGift.given_at)) / (1000 * 60 * 60 * 24))
      
      res.json({
        is_duplicate: true,
        warning: true,
        message: `⚠️ ATENÇÃO: Cliente já recebeu "${gift_name}" há ${daysSince} dias`,
        details: {
          last_given_at: lastGift.given_at,
          days_since: daysSince,
          order_code: lastGift.order_code,
          gift_type: lastGift.gift_type,
          notes: lastGift.notes
        },
        history: existingGifts.map(gift => ({
          id: gift.id,
          given_at: gift.given_at,
          order_code: gift.order_code,
          gift_type: gift.gift_type,
          gift_value: parseFloat(gift.gift_value || 0),
          notes: gift.notes
        }))
      })
    } else {
      res.json({
        is_duplicate: false,
        warning: false,
        message: `✅ Cliente nunca recebeu "${gift_name}" antes`,
        history: []
      })
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar brinde duplicado:', error)
    res.status(500).json({ error: error.message })
  }
}

// ─── REGISTRAR BRINDE DADO ────────────────────────────────────────────────────
async function recordGift(req, res) {
  try {
    const {
      customer_id,
      order_id = null,
      gift_name,
      gift_type = 'Brinde',
      gift_description = '',
      gift_value = 0,
      operator = 'system',
      notes = ''
    } = req.body
    
    // Validações
    if (!customer_id || !gift_name) {
      return res.status(400).json({ 
        error: 'customer_id e gift_name são obrigatórios' 
      })
    }
    
    // Verificar se cliente existe
    const customer = await db('customers').where('id', parseInt(customer_id)).first()
    if (!customer) {
      return res.status(404).json({ error: 'Cliente não encontrado' })
    }
    
    // Verificar se pedido existe (se fornecido)
    if (order_id) {
      const order = await db('orders').where('id', parseInt(order_id)).first()
      if (!order) {
        return res.status(404).json({ error: 'Pedido não encontrado' })
      }
      
      if (order.customer_id !== parseInt(customer_id)) {
        return res.status(400).json({ error: 'Pedido não pertence ao cliente informado' })
      }
    }
    
    // Registrar brinde
    const [gift] = await db('customer_gifts').insert({
      customer_id: parseInt(customer_id),
      order_id: order_id ? parseInt(order_id) : null,
      gift_name: gift_name.trim(),
      gift_type: gift_type.trim(),
      gift_description: gift_description.trim(),
      gift_value: parseFloat(gift_value || 0),
      operator: operator.trim(),
      notes: notes.trim()
    }).returning('*')
    
    // Log da atividade
    await db('activity_logs').insert({
      activity_type: 'gift_given',
      entity_type: 'customer',
      entity_id: parseInt(customer_id),
      entity_name: customer.name,
      changes: JSON.stringify({
        gift_id: gift.id,
        gift_name,
        gift_type,
        gift_value: parseFloat(gift_value || 0),
        order_id
      }),
      description: `Brinde registrado: ${gift_name} (${gift_type})`,
      operator
    })
    
    console.log(`🎁 Brinde registrado: ${gift_name} para cliente ${customer.name}`)
    
    res.status(201).json({
      message: 'Brinde registrado com sucesso',
      gift: {
        ...gift,
        gift_value: parseFloat(gift.gift_value || 0)
      }
    })
    
  } catch (error) {
    console.error('❌ Erro ao registrar brinde:', error)
    res.status(500).json({ error: error.message })
  }
}

// ─── LISTAR BRINDES DE UM CLIENTE ─────────────────────────────────────────────
async function getCustomerGifts(req, res) {
  try {
    const { customer_id } = req.params
    const { limit = 50, offset = 0 } = req.query
    
    const gifts = await db('customer_gifts as cg')
      .leftJoin('orders as o', 'cg.order_id', 'o.id')
      .select(
        'cg.*',
        'o.code as order_code',
        'o.status as order_status'
      )
      .where('cg.customer_id', parseInt(customer_id))
      .orderBy('cg.given_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
    
    const total = await db('customer_gifts')
      .where('customer_id', parseInt(customer_id))
      .count('* as count')
      .first()
    
    // Estatísticas
    const stats = await db('customer_gifts')
      .where('customer_id', parseInt(customer_id))
      .select(
        db.raw('COUNT(*) as total_gifts'),
        db.raw('SUM(gift_value) as total_value'),
        db.raw('COUNT(DISTINCT gift_name) as unique_gifts'),
        db.raw('MIN(given_at) as first_gift'),
        db.raw('MAX(given_at) as last_gift')
      )
      .first()
    
    res.json({
      data: gifts.map(gift => ({
        ...gift,
        gift_value: parseFloat(gift.gift_value || 0)
      })),
      stats: {
        total_gifts: parseInt(stats.total_gifts || 0),
        total_value: parseFloat(stats.total_value || 0),
        unique_gifts: parseInt(stats.unique_gifts || 0),
        first_gift: stats.first_gift,
        last_gift: stats.last_gift
      },
      pagination: {
        total: parseInt(total.count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(parseInt(total.count) / parseInt(limit))
      }
    })
    
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── LISTAR TODOS OS BRINDES ──────────────────────────────────────────────────
async function listAllGifts(req, res) {
  try {
    const { gift_name, gift_type, limit = 50, offset = 0 } = req.query
    
    let query = db('customer_gifts as cg')
      .join('customers as c', 'cg.customer_id', 'c.id')
      .leftJoin('orders as o', 'cg.order_id', 'o.id')
      .select(
        'cg.*',
        'c.name as customer_name',
        'c.email as customer_email',
        'o.code as order_code'
      )
      .orderBy('cg.given_at', 'desc')
    
    // Filtros
    if (gift_name) {
      query = query.where('cg.gift_name', 'ilike', `%${gift_name}%`)
    }
    
    if (gift_type) {
      query = query.where('cg.gift_type', gift_type)
    }
    
    // Contar total
    const totalQuery = query.clone()
    const [{ count: total }] = await totalQuery.count('* as count')
    
    // Aplicar paginação
    const gifts = await query
      .limit(parseInt(limit))
      .offset(parseInt(offset))
    
    res.json({
      data: gifts.map(gift => ({
        ...gift,
        gift_value: parseFloat(gift.gift_value || 0)
      })),
      pagination: {
        total: parseInt(total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(parseInt(total) / parseInt(limit))
      }
    })
    
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── ESTATÍSTICAS DE BRINDES ──────────────────────────────────────────────────
async function getGiftStats(req, res) {
  try {
    const { start_date, end_date } = req.query
    
    let query = db('customer_gifts')
    
    if (start_date) {
      query = query.where('given_at', '>=', start_date)
    }
    
    if (end_date) {
      query = query.where('given_at', '<=', end_date)
    }
    
    // Estatísticas gerais
    const generalStats = await query.clone()
      .select(
        db.raw('COUNT(*) as total_gifts'),
        db.raw('SUM(gift_value) as total_value'),
        db.raw('COUNT(DISTINCT customer_id) as customers_with_gifts'),
        db.raw('COUNT(DISTINCT gift_name) as unique_gift_types')
      )
      .first()
    
    // Brindes mais dados
    const topGifts = await query.clone()
      .select('gift_name')
      .count('* as count')
      .sum('gift_value as total_value')
      .groupBy('gift_name')
      .orderBy('count', 'desc')
      .limit(10)
    
    // Por tipo
    const byType = await query.clone()
      .select('gift_type')
      .count('* as count')
      .sum('gift_value as total_value')
      .groupBy('gift_type')
      .orderBy('count', 'desc')
    
    // Clientes que mais receberam
    const topCustomers = await query.clone()
      .join('customers as c', 'customer_gifts.customer_id', 'c.id')
      .select('c.id', 'c.name', 'c.email')
      .count('* as gifts_received')
      .sum('customer_gifts.gift_value as total_value')
      .groupBy('c.id', 'c.name', 'c.email')
      .orderBy('gifts_received', 'desc')
      .limit(10)
    
    res.json({
      period: {
        start_date: start_date || 'all time',
        end_date: end_date || 'now'
      },
      general: {
        total_gifts: parseInt(generalStats.total_gifts || 0),
        total_value: parseFloat(generalStats.total_value || 0),
        customers_with_gifts: parseInt(generalStats.customers_with_gifts || 0),
        unique_gift_types: parseInt(generalStats.unique_gift_types || 0),
        average_value_per_gift: parseInt(generalStats.total_gifts || 0) > 0 
          ? parseFloat(generalStats.total_value || 0) / parseInt(generalStats.total_gifts || 0)
          : 0
      },
      top_gifts: topGifts.map(gift => ({
        ...gift,
        count: parseInt(gift.count),
        total_value: parseFloat(gift.total_value || 0),
        average_value: parseInt(gift.count) > 0 
          ? parseFloat(gift.total_value || 0) / parseInt(gift.count)
          : 0
      })),
      by_type: byType.map(type => ({
        ...type,
        count: parseInt(type.count),
        total_value: parseFloat(type.total_value || 0)
      })),
      top_customers: topCustomers.map(customer => ({
        ...customer,
        gifts_received: parseInt(customer.gifts_received),
        total_value: parseFloat(customer.total_value || 0)
      }))
    })
    
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports = {
  checkDuplicateGift,
  recordGift,
  getCustomerGifts,
  listAllGifts,
  getGiftStats
}