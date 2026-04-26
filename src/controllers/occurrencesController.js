const { db } = require('../models/db')
const ActivityLogger = require('../services/activityLogger')

// ─── LIST OCCURRENCES ─────────────────────────────────────────────────────────
async function list(req, res) {
  try {
    const { status, type, order_id, limit = 50, offset = 0 } = req.query
    
    let query = db('occurrences as o')
      .join('orders as ord', 'ord.id', 'o.order_id')
      .leftJoin('customers as c', 'c.id', 'ord.customer_id')
      .select(
        'o.*',
        'ord.code as order_code',
        'ord.status as order_status',
        'c.id as customer_id',
        'c.name as customer_name',
        'c.email as customer_email',
        'c.phone as customer_phone'
      )
      .orderBy('o.created_at', 'desc')
    
    // Filtros
    if (status) {
      query = query.where('o.status', status)
    }
    
    if (type) {
      query = query.where('o.type', type)
    }
    
    if (order_id) {
      query = query.where('o.order_id', parseInt(order_id))
    }
    
    // Contar total
    const totalQuery = query.clone()
    const [{ count: total }] = await totalQuery.count('* as count')
    
    // Aplicar paginação
    const occurrences = await query
      .limit(parseInt(limit))
      .offset(parseInt(offset))
    
    res.json({
      data: occurrences,
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

// ─── GET ONE OCCURRENCE ───────────────────────────────────────────────────────
async function getOne(req, res) {
  try {
    const occurrence = await db('occurrences as o')
      .join('orders as ord', 'ord.id', 'o.order_id')
      .leftJoin('customers as c', 'c.id', 'ord.customer_id')
      .leftJoin('products as p', 'p.id', 'o.product_id')
      .leftJoin('bottlings as b', 'b.id', 'o.bottling_id')
      .select(
        'o.*',
        'ord.code as order_code',
        'ord.status as order_status',
        'ord.created_at as order_date',
        'c.id as customer_id',
        'c.name as customer_name',
        'c.email as customer_email',
        'c.phone as customer_phone',
        'p.project_name',
        'b.bottling_code'
      )
      .where('o.id', parseInt(req.params.id))
      .first()
    
    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' })
    }
    
    // Buscar itens do pedido para contexto
    const orderItems = await db('order_items')
      .where('order_id', occurrence.order_id)
      .select('*')
    
    occurrence.order_items = orderItems
    
    res.json(occurrence)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── CREATE OCCURRENCE ────────────────────────────────────────────────────────
async function create(req, res) {
  try {
    const {
      order_id,
      type,
      product_id = null,
      product_name = '',
      bottling_id = null,
      quantity = null,
      action = 'None',
      credit_amount = null,
      credit_expiry = null,
      description = '',
      notes = '',
      operator = 'system'
    } = req.body
    
    // Validações
    if (!order_id || !type) {
      return res.status(400).json({ 
        error: 'order_id e type são obrigatórios' 
      })
    }
    
    const result = await db.transaction(async (trx) => {
      // 1. Verificar se pedido existe
      const order = await trx('orders').where('id', parseInt(order_id)).first()
      if (!order) {
        throw new Error(`Pedido ${order_id} não encontrado`)
      }
      
      // 2. Criar ocorrência
      const [occurrence] = await trx('occurrences').insert({
        order_id: parseInt(order_id),
        type,
        product_id: product_id ? parseInt(product_id) : null,
        product_name,
        bottling_id: bottling_id ? parseInt(bottling_id) : null,
        quantity: quantity ? parseInt(quantity) : null,
        action,
        credit_amount: credit_amount ? parseFloat(credit_amount) : null,
        credit_expiry,
        description,
        notes,
        operator,
        status: 'Open'
      }).returning('*')
      
      // 3. Se ação for reenvio, baixar estoque
      if (action === 'Resend' && bottling_id) {
        const bottling = await trx('bottlings')
          .where('id', parseInt(bottling_id))
          .first()
        
        if (bottling && bottling.quantity_available >= quantity) {
          await trx('bottlings')
            .where('id', parseInt(bottling_id))
            .decrement('quantity_available', parseInt(quantity))
          
          console.log(
            `📦 REENVIO: ${quantity} unidade(s) de ${product_name} baixadas do estoque\n` +
            `   Envase: ${bottling.bottling_code}\n` +
            `   Disponível antes: ${bottling.quantity_available}\n` +
            `   Disponível agora: ${bottling.quantity_available - quantity}`
          )
        } else {
          console.warn(
            `⚠️  ATENÇÃO: Estoque insuficiente para reenvio!\n` +
            `   Solicitado: ${quantity}\n` +
            `   Disponível: ${bottling ? bottling.quantity_available : 0}`
          )
        }
      }
      
      // 4. Se ação for crédito, registrar
      if (action === 'Credit' && credit_amount) {
        console.log(
          `💰 CRÉDITO CONCEDIDO: R$ ${credit_amount}\n` +
          `   Cliente: ${order.customer_id}\n` +
          `   Validade: ${credit_expiry || 'Sem validade'}\n` +
          `   Ocorrência: ${occurrence.id}`
        )
      }
      
      // 5. Registrar no log de atividades
      await trx('activity_logs').insert({
        activity_type: 'occurrence_created',
        entity_type: 'order',
        entity_id: parseInt(order_id),
        entity_name: order.code,
        changes: JSON.stringify({
          occurrence_id: occurrence.id,
          type,
          action,
          product_name
        }),
        description: `Ocorrência registrada: ${type} - ${action}`,
        operator
      })
      
      // 6. Buscar dados completos para retorno
      const completeOccurrence = await trx('occurrences as o')
        .join('orders as ord', 'ord.id', 'o.order_id')
        .leftJoin('customers as c', 'c.id', 'ord.customer_id')
        .select(
          'o.*',
          'ord.code as order_code',
          'c.name as customer_name'
        )
        .where('o.id', occurrence.id)
        .first()
      
      return completeOccurrence
    })
    
    res.status(201).json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// ─── UPDATE OCCURRENCE ────────────────────────────────────────────────────────
async function update(req, res) {
  try {
    const occurrence = await db('occurrences')
      .where('id', parseInt(req.params.id))
      .first()
    
    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' })
    }
    
    const updateData = { ...req.body }
    updateData.updated_at = db.fn.now()
    
    // Se status mudou para Resolved, registrar data
    if (updateData.status === 'Resolved' && occurrence.status !== 'Resolved') {
      updateData.resolved_at = db.fn.now()
    }
    
    const [updated] = await db('occurrences')
      .where('id', parseInt(req.params.id))
      .update(updateData)
      .returning('*')
    
    res.json(updated)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────
async function updateStatus(req, res) {
  try {
    const { status, notes } = req.body
    
    if (!status) {
      return res.status(400).json({ error: 'status é obrigatório' })
    }
    
    const occurrence = await db('occurrences')
      .where('id', parseInt(req.params.id))
      .first()
    
    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' })
    }
    
    const updateData = {
      status,
      updated_at: db.fn.now()
    }
    
    // Adicionar notas se fornecidas
    if (notes) {
      const existingNotes = occurrence.notes || ''
      const timestamp = new Date().toISOString()
      updateData.notes = existingNotes 
        ? `${existingNotes}\n\n[${timestamp}] ${notes}`
        : `[${timestamp}] ${notes}`
    }
    
    // Se status mudou para Resolved, registrar data
    if (status === 'Resolved' && occurrence.status !== 'Resolved') {
      updateData.resolved_at = db.fn.now()
    }
    
    const [updated] = await db('occurrences')
      .where('id', parseInt(req.params.id))
      .update(updateData)
      .returning('*')
    
    res.json(updated)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// ─── USE CREDIT ───────────────────────────────────────────────────────────────
async function useCredit(req, res) {
  try {
    const occurrence = await db('occurrences')
      .where('id', parseInt(req.params.id))
      .first()
    
    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' })
    }
    
    if (occurrence.action !== 'Credit') {
      return res.status(400).json({ 
        error: 'Esta ocorrência não tem crédito associado' 
      })
    }
    
    if (occurrence.credit_used) {
      return res.status(400).json({ 
        error: 'Crédito já foi utilizado' 
      })
    }
    
    // Verificar validade
    if (occurrence.credit_expiry) {
      const expiry = new Date(occurrence.credit_expiry)
      const today = new Date()
      
      if (today > expiry) {
        return res.status(400).json({ 
          error: 'Crédito expirado',
          expiry_date: occurrence.credit_expiry
        })
      }
    }
    
    // Marcar como usado
    const [updated] = await db('occurrences')
      .where('id', parseInt(req.params.id))
      .update({
        credit_used: true,
        updated_at: db.fn.now()
      })
      .returning('*')
    
    res.json({
      message: 'Crédito utilizado com sucesso',
      occurrence: updated
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// ─── GET BY ORDER ─────────────────────────────────────────────────────────────
async function getByOrder(req, res) {
  try {
    const { order_id } = req.params
    
    const occurrences = await db('occurrences')
      .where('order_id', parseInt(order_id))
      .orderBy('created_at', 'desc')
    
    // Estatísticas
    const stats = {
      total: occurrences.length,
      open: occurrences.filter(o => o.status === 'Open').length,
      in_progress: occurrences.filter(o => o.status === 'In Progress').length,
      resolved: occurrences.filter(o => o.status === 'Resolved').length,
      total_credits: occurrences
        .filter(o => o.action === 'Credit')
        .reduce((sum, o) => sum + parseFloat(o.credit_amount || 0), 0)
    }
    
    res.json({
      order_id: parseInt(order_id),
      stats,
      occurrences
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── STATS ────────────────────────────────────────────────────────────────────
async function stats(req, res) {
  try {
    const { start_date, end_date } = req.query
    
    let query = db('occurrences')
    
    if (start_date) {
      query = query.where('created_at', '>=', start_date)
    }
    
    if (end_date) {
      query = query.where('created_at', '<=', end_date)
    }
    
    const [totals] = await query.clone()
      .count('* as total_occurrences')
      .sum('credit_amount as total_credits')
      .first()
    
    const byType = await query.clone()
      .select('type')
      .count('* as count')
      .groupBy('type')
      .orderBy('count', 'desc')
    
    const byStatus = await query.clone()
      .select('status')
      .count('* as count')
      .groupBy('status')
    
    const byAction = await query.clone()
      .select('action')
      .count('* as count')
      .sum('credit_amount as total_credits')
      .groupBy('action')
      .orderBy('count', 'desc')
    
    const recentOccurrences = await db('occurrences as o')
      .join('orders as ord', 'ord.id', 'o.order_id')
      .leftJoin('customers as c', 'c.id', 'ord.customer_id')
      .select(
        'o.id',
        'o.type',
        'o.action',
        'o.status',
        'o.created_at',
        'ord.code as order_code',
        'c.name as customer_name'
      )
      .orderBy('o.created_at', 'desc')
      .limit(10)
    
    res.json({
      period: {
        start_date: start_date || 'all time',
        end_date: end_date || 'now'
      },
      totals: {
        total_occurrences: parseInt(totals.total_occurrences || 0),
        total_credits: parseFloat(totals.total_credits || 0)
      },
      by_type: byType,
      by_status: byStatus,
      by_action: byAction,
      recent_occurrences: recentOccurrences
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  updateStatus,
  useCredit,
  getByOrder,
  stats
}
