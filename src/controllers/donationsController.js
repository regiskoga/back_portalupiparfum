/**
 * Donations Controller
 * Gerencia doações e presentes (sem gerar receita)
 */

const { db } = require('../models/db')
const activityLogger = require('../services/activityLogger')

/**
 * Lista todas as doações com paginação e filtros
 */
exports.list = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const offset = (page - 1) * limit

    const { donation_type, customer_id, start_date, end_date } = req.query

    let query = db('donations')
      .leftJoin('customers', 'donations.customer_id', 'customers.id')
      .leftJoin('products', 'donations.product_id', 'products.id')
      .select(
        'donations.*',
        'customers.name as customer_name',
        'products.name as product_full_name'
      )

    if (donation_type) {
      query = query.where('donations.donation_type', donation_type)
    }

    if (customer_id) {
      query = query.where('donations.customer_id', customer_id)
    }

    if (start_date) {
      query = query.where('donations.donated_at', '>=', start_date)
    }

    if (end_date) {
      query = query.where('donations.donated_at', '<=', end_date)
    }

    const donations = await query
      .orderBy('donations.donated_at', 'desc')
      .limit(limit)
      .offset(offset)

    const [{ total }] = await db('donations').count('* as total')

    res.json({
      data: donations,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error listing donations:', error)
    res.status(500).json({ error: 'Failed to list donations' })
  }
}

/**
 * Busca uma doação por ID
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params

    const donation = await db('donations')
      .leftJoin('customers', 'donations.customer_id', 'customers.id')
      .leftJoin('products', 'donations.product_id', 'products.id')
      .where('donations.id', id)
      .select(
        'donations.*',
        'customers.name as customer_name',
        'customers.email as customer_email',
        'products.name as product_full_name'
      )
      .first()

    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' })
    }

    res.json(donation)
  } catch (error) {
    console.error('Error getting donation:', error)
    res.status(500).json({ error: 'Failed to get donation' })
  }
}

/**
 * Registra uma nova doação
 */
exports.create = async (req, res) => {
  const trx = await db.transaction()

  try {
    const {
      customer_id = null,
      recipient_name = '',
      product_id,
      bottling_id,
      quantity,
      donation_type = 'Gift',
      reason = '',
      operator = '',
      donated_at = new Date()
    } = req.body

    // Validações básicas
    if (!product_id || !bottling_id || !quantity) {
      await trx.rollback()
      return res.status(400).json({ 
        error: 'product_id, bottling_id and quantity are required' 
      })
    }

    // Buscar envase (bottlings NÃO tem product_id — o nome já vive em
    // bottlings.product_name; o join antigo em products.product_id dava 500)
    const bottling = await trx('bottlings').where('id', bottling_id).first()

    if (!bottling) {
      await trx.rollback()
      return res.status(404).json({ error: 'Bottling not found' })
    }

    // Verificar se tem quantidade disponível
    if (bottling.quantity_available < quantity) {
      await trx.rollback()
      return res.status(400).json({ 
        error: `Insufficient quantity. Available: ${bottling.quantity_available} units` 
      })
    }

    // Calcular custos (a coluna correta é unit_cost — cost_per_unit não existe)
    const unitCost = parseFloat(bottling.unit_cost || 0)
    const totalCost = unitCost * quantity

    // Baixar estoque de frascos
    await trx('bottlings')
      .where({ id: bottling_id })
      .decrement('quantity_available', quantity)

    // Registrar doação
    const [donation] = await trx('donations')
      .insert({
        customer_id,
        recipient_name: recipient_name || (customer_id ? '' : 'Não identificado'),
        product_id,
        product_name: `${bottling.product_name} ${bottling.volume_ml}ml`,
        bottling_id,
        volume_ml: bottling.volume_ml,
        quantity,
        unit_cost: unitCost,
        total_cost: totalCost,
        donation_type,
        reason,
        operator,
        donated_at
      })
      .returning('*')

    // Log da atividade (activity_type válido via helper — antes usava assinatura
    // errada log(trx,{...}) e o registro falhava silenciosamente)
    await activityLogger.logDonation(
      'bottling',
      bottling_id,
      `${bottling.product_name} ${bottling.volume_ml}ml`,
      quantity,
      recipient_name || (customer_id ? `cliente #${customer_id}` : 'Não identificado'),
      operator || 'system'
    )

    await trx.commit()

    res.status(201).json(donation)
  } catch (error) {
    await trx.rollback()
    console.error('Error creating donation:', error)
    res.status(500).json({ error: 'Failed to create donation' })
  }
}

/**
 * Atualiza uma doação (apenas campos editáveis)
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params
    const { reason, operator, recipient_name } = req.body

    const [donation] = await db('donations')
      .where({ id })
      .update({ reason, operator, recipient_name })
      .returning('*')

    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' })
    }

    res.json(donation)
  } catch (error) {
    console.error('Error updating donation:', error)
    res.status(500).json({ error: 'Failed to update donation' })
  }
}

/**
 * Deleta uma doação (apenas se for erro de registro)
 */
exports.delete = async (req, res) => {
  const trx = await db.transaction()

  try {
    const { id } = req.params

    const donation = await trx('donations')
      .where({ id })
      .first()

    if (!donation) {
      await trx.rollback()
      return res.status(404).json({ error: 'Donation not found' })
    }

    // Reverter baixa de estoque
    await trx('bottlings')
      .where({ id: donation.bottling_id })
      .increment('quantity_available', donation.quantity)

    // Deletar doação
    await trx('donations')
      .where({ id })
      .delete()

    // Log da atividade (não existe activity_type 'donation_deleted' no CHECK →
    // usa 'donation_recorded' com descrição de reversão)
    await activityLogger.log('donation_recorded', 'bottling', donation.bottling_id, {
      entityName: donation.product_name,
      description: `Doação revertida (deletada): ${donation.quantity} unidade(s) de ${donation.product_name}`,
      changes: { reverted_donation_id: parseInt(id), quantity: donation.quantity },
      operator: donation.operator || 'system'
    })

    await trx.commit()

    res.json({ message: 'Donation deleted and stock restored' })
  } catch (error) {
    await trx.rollback()
    console.error('Error deleting donation:', error)
    res.status(500).json({ error: 'Failed to delete donation' })
  }
}

/**
 * Estatísticas de doações
 */
exports.stats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query

    let query = db('donations')

    if (start_date) {
      query = query.where('donated_at', '>=', start_date)
    }

    if (end_date) {
      query = query.where('donated_at', '<=', end_date)
    }

    // Estatísticas gerais
    const generalStats = await query.clone()
      .select(
        db.raw('COUNT(*) as total_donations'),
        db.raw('SUM(quantity) as total_units'),
        db.raw('SUM(total_cost) as total_cost'),
        db.raw('AVG(total_cost) as avg_cost')
      )
      .first()

    // Por tipo de doação
    const byDonationType = await query.clone()
      .select('donation_type')
      .sum('total_cost as total_cost')
      .sum('quantity as total_units')
      .count('* as count')
      .groupBy('donation_type')
      .orderBy('total_cost', 'desc')

    // Por produto
    const byProduct = await query.clone()
      .select('product_name')
      .sum('total_cost as total_cost')
      .sum('quantity as total_units')
      .count('* as count')
      .groupBy('product_name')
      .orderBy('total_cost', 'desc')
      .limit(10)

    // Top destinatários (clientes)
    const topRecipients = await query.clone()
      .leftJoin('customers', 'donations.customer_id', 'customers.id')
      .whereNotNull('donations.customer_id')
      .select('customers.name as customer_name')
      .sum('donations.total_cost as total_cost')
      .sum('donations.quantity as total_units')
      .count('* as count')
      .groupBy('customers.name')
      .orderBy('total_cost', 'desc')
      .limit(10)

    res.json({
      general: generalStats,
      by_donation_type: byDonationType,
      by_product: byProduct,
      top_recipients: topRecipients
    })
  } catch (error) {
    console.error('Error getting donation stats:', error)
    res.status(500).json({ error: 'Failed to get donation stats' })
  }
}

/**
 * Busca doações de um cliente específico
 */
exports.getByCustomer = async (req, res) => {
  try {
    const { customer_id } = req.params

    const donations = await db('donations')
      .leftJoin('products', 'donations.product_id', 'products.id')
      .where('donations.customer_id', customer_id)
      .select(
        'donations.*',
        'products.name as product_full_name'
      )
      .orderBy('donations.donated_at', 'desc')

    res.json({ data: donations })
  } catch (error) {
    console.error('Error getting customer donations:', error)
    res.status(500).json({ error: 'Failed to get customer donations' })
  }
}

module.exports = exports
