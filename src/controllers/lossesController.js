/**
 * Losses Controller
 * Gerencia perdas de insumos, lotes e envases
 */

const { db } = require('../models/db')
const activityLogger = require('../services/activityLogger')

/**
 * Lista todas as perdas com paginação e filtros
 */
exports.list = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const offset = (page - 1) * limit

    const { loss_type, item_type, start_date, end_date } = req.query

    let query = db('losses').select('*')

    if (loss_type) {
      query = query.where('loss_type', loss_type)
    }

    if (item_type) {
      query = query.where('item_type', item_type)
    }

    if (start_date) {
      query = query.where('occurred_at', '>=', start_date)
    }

    if (end_date) {
      query = query.where('occurred_at', '<=', end_date)
    }

    const losses = await query
      .orderBy('occurred_at', 'desc')
      .limit(limit)
      .offset(offset)

    const [{ total }] = await db('losses').count('* as total')

    res.json({
      data: losses,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error listing losses:', error)
    res.status(500).json({ error: 'Failed to list losses' })
  }
}

/**
 * Busca uma perda por ID
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params

    const loss = await db('losses')
      .where({ id })
      .first()

    if (!loss) {
      return res.status(404).json({ error: 'Loss not found' })
    }

    res.json(loss)
  } catch (error) {
    console.error('Error getting loss:', error)
    res.status(500).json({ error: 'Failed to get loss' })
  }
}

/**
 * Registra uma nova perda
 */
exports.create = async (req, res) => {
  const trx = await db.transaction()

  try {
    const {
      loss_type,
      item_type,
      item_id,
      quantity_lost,
      reason,
      operator = '',
      occurred_at = new Date()
    } = req.body

    // Validações básicas
    if (!loss_type || !item_type || !item_id || !quantity_lost || !reason) {
      await trx.rollback()
      return res.status(400).json({ 
        error: 'loss_type, item_type, item_id, quantity_lost and reason are required' 
      })
    }

    let item, cost, unit, itemName

    // Buscar item e calcular custo baseado no tipo
    switch (item_type) {
      case 'Supply':
        item = await trx('supplies')
          .where({ id: item_id })
          .first()

        if (!item) {
          await trx.rollback()
          return res.status(404).json({ error: 'Supply not found' })
        }

        // Verificar se tem quantidade disponível
        if (item.quantity_available < quantity_lost) {
          await trx.rollback()
          return res.status(400).json({ 
            error: `Insufficient quantity. Available: ${item.quantity_available} ${item.unit}` 
          })
        }

        cost = item.unit_cost * quantity_lost
        unit = item.unit
        itemName = item.name

        // Baixar estoque
        await trx('supplies')
          .where({ id: item_id })
          .decrement('quantity_available', quantity_lost)
        await trx.raw('UPDATE supplies SET is_open = false WHERE id = ? AND quantity_available <= 0', [item_id])

        break

      case 'Batch':
        item = await trx('batches')
          .where({ id: item_id })
          .first()

        if (!item) {
          await trx.rollback()
          return res.status(404).json({ error: 'Batch not found' })
        }

        if (parseFloat(item.remaining_ml) < quantity_lost) {
          await trx.rollback()
          return res.status(400).json({
            error: `Quantidade insuficiente. Disponível: ${item.remaining_ml} ml`
          })
        }

        cost = item.cost_per_ml * quantity_lost
        unit = 'ml'
        itemName = `Lote ${item.batch_code}`

        const newRemainingMl = Math.max(0, parseFloat(item.remaining_ml) - quantity_lost)
        await trx('batches')
          .where({ id: item_id })
          .update({
            remaining_ml: newRemainingMl,
            status: newRemainingMl <= 0 ? 'Finalizado' : item.status,
            updated_at: trx.fn.now()
          })

        await trx('batch_movements').insert({
          batch_id:      item_id,
          movement_type: 'loss',
          quantity_ml:   -quantity_lost,
          previous_ml:   item.remaining_ml,
          current_ml:    newRemainingMl,
          notes:         reason,
          operator:      operator || 'system'
        })

        break

      case 'Bottling':
        item = await trx('bottlings')
          .leftJoin('products', 'bottlings.product_id', 'products.id')
          .where('bottlings.id', item_id)
          .select('bottlings.*', 'products.name as product_name')
          .first()

        if (!item) {
          await trx.rollback()
          return res.status(404).json({ error: 'Bottling not found' })
        }

        // Verificar se tem quantidade disponível
        if (item.quantity_available < quantity_lost) {
          await trx.rollback()
          return res.status(400).json({ 
            error: `Insufficient quantity. Available: ${item.quantity_available} units` 
          })
        }

        cost = item.cost_per_unit * quantity_lost
        unit = 'unidade'
        itemName = `${item.product_name} ${item.volume_ml}ml`

        // Baixar estoque de frascos
        await trx('bottlings')
          .where({ id: item_id })
          .decrement('quantity_available', quantity_lost)

        break

      default:
        await trx.rollback()
        return res.status(400).json({ error: 'Invalid item_type' })
    }

    // Registrar perda
    const [loss] = await trx('losses')
      .insert({
        loss_type,
        item_type,
        item_id,
        item_name: itemName,
        quantity_lost,
        unit,
        cost,
        reason,
        operator,
        occurred_at
      })
      .returning('*')

    await activityLogger.logLoss(item_type.toLowerCase(), item_id, itemName, quantity_lost, reason)

    await trx.commit()

    res.status(201).json(loss)
  } catch (error) {
    await trx.rollback()
    console.error('Error creating loss:', error)
    res.status(500).json({ error: 'Failed to create loss' })
  }
}

/**
 * Atualiza uma perda (apenas campos editáveis)
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params
    const { reason, operator } = req.body

    const [loss] = await db('losses')
      .where({ id })
      .update({ reason, operator })
      .returning('*')

    if (!loss) {
      return res.status(404).json({ error: 'Loss not found' })
    }

    res.json(loss)
  } catch (error) {
    console.error('Error updating loss:', error)
    res.status(500).json({ error: 'Failed to update loss' })
  }
}

/**
 * Deleta uma perda (apenas se for erro de registro)
 */
exports.delete = async (req, res) => {
  const trx = await db.transaction()

  try {
    const { id } = req.params

    const loss = await trx('losses')
      .where({ id })
      .first()

    if (!loss) {
      await trx.rollback()
      return res.status(404).json({ error: 'Loss not found' })
    }

    // Reverter baixa de estoque
    switch (loss.item_type) {
      case 'Supply':
        await trx('supplies')
          .where({ id: loss.item_id })
          .increment('quantity_available', loss.quantity_lost)
        break

      case 'Batch':
        await trx('batches')
          .where({ id: loss.item_id })
          .increment('remaining_ml', loss.quantity_lost)
        break

      case 'Bottling':
        await trx('bottlings')
          .where({ id: loss.item_id })
          .increment('quantity_available', loss.quantity_lost)
        break
    }

    // Deletar perda
    await trx('losses')
      .where({ id })
      .delete()

    await activityLogger.log('loss_deleted', loss.item_type.toLowerCase(), loss.item_id, {
      entityName: loss.item_name,
      description: `Perda revertida: ${loss.item_name} - ${loss.quantity_lost} ${loss.unit}`
    })

    await trx.commit()

    res.json({ message: 'Loss deleted and stock restored' })
  } catch (error) {
    await trx.rollback()
    console.error('Error deleting loss:', error)
    res.status(500).json({ error: 'Failed to delete loss' })
  }
}

/**
 * Estatísticas de perdas
 */
exports.stats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query

    let query = db('losses')

    if (start_date) {
      query = query.where('occurred_at', '>=', start_date)
    }

    if (end_date) {
      query = query.where('occurred_at', '<=', end_date)
    }

    // Estatísticas gerais
    const generalStats = await query.clone()
      .select(
        db.raw('COUNT(*) as total_losses'),
        db.raw('SUM(cost) as total_cost'),
        db.raw('AVG(cost) as avg_cost')
      )
      .first()

    // Por tipo de perda
    const byLossType = await query.clone()
      .select('loss_type')
      .sum('cost as total_cost')
      .count('* as count')
      .groupBy('loss_type')
      .orderBy('total_cost', 'desc')

    // Por tipo de item
    const byItemType = await query.clone()
      .select('item_type')
      .sum('cost as total_cost')
      .count('* as count')
      .groupBy('item_type')
      .orderBy('total_cost', 'desc')

    // Maiores perdas
    const topLosses = await query.clone()
      .select('*')
      .orderBy('cost', 'desc')
      .limit(10)

    res.json({
      general: generalStats,
      by_loss_type: byLossType,
      by_item_type: byItemType,
      top_losses: topLosses
    })
  } catch (error) {
    console.error('Error getting loss stats:', error)
    res.status(500).json({ error: 'Failed to get loss stats' })
  }
}

module.exports = exports
