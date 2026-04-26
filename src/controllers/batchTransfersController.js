const { db } = require('../models/db')
const ActivityLogger = require('../services/activityLogger')

// ─── LIST TRANSFERS ───────────────────────────────────────────────────────────
async function list(req, res) {
  try {
    const { batch_id, start_date, end_date, limit = 50, offset = 0 } = req.query
    
    let query = db('batch_transfers as bt')
      .join('batches as bs', 'bs.id', 'bt.source_batch_id')
      .join('batches as bd', 'bd.id', 'bt.destination_batch_id')
      .select(
        'bt.*',
        'bs.batch_code as source_batch_code',
        'bs.remaining_ml as source_remaining_ml',
        'bd.batch_code as destination_batch_code',
        'bd.remaining_ml as destination_remaining_ml'
      )
      .orderBy('bt.transferred_at', 'desc')
    
    // Filtros
    if (batch_id) {
      query = query.where(function() {
        this.where('bt.source_batch_id', parseInt(batch_id))
          .orWhere('bt.destination_batch_id', parseInt(batch_id))
      })
    }
    
    if (start_date) {
      query = query.where('bt.transferred_at', '>=', start_date)
    }
    
    if (end_date) {
      query = query.where('bt.transferred_at', '<=', end_date)
    }
    
    // Contar total
    const totalQuery = query.clone()
    const [{ count: total }] = await totalQuery.count('* as count')
    
    // Aplicar paginação
    const transfers = await query
      .limit(parseInt(limit))
      .offset(parseInt(offset))
    
    res.json({
      data: transfers,
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

// ─── GET ONE TRANSFER ─────────────────────────────────────────────────────────
async function getOne(req, res) {
  try {
    const transfer = await db('batch_transfers as bt')
      .join('batches as bs', 'bs.id', 'bt.source_batch_id')
      .join('batches as bd', 'bd.id', 'bt.destination_batch_id')
      .leftJoin('formulas as fs', 'fs.id', 'bs.formula_id')
      .leftJoin('formulas as fd', 'fd.id', 'bd.formula_id')
      .leftJoin('products as ps', 'ps.id', 'fs.product_id')
      .leftJoin('products as pd', 'pd.id', 'fd.product_id')
      .select(
        'bt.*',
        'bs.batch_code as source_batch_code',
        'bs.remaining_ml as source_remaining_ml',
        'bs.status as source_status',
        'fs.name as source_formula_name',
        'ps.project_name as source_product_name',
        'bd.batch_code as destination_batch_code',
        'bd.remaining_ml as destination_remaining_ml',
        'bd.status as destination_status',
        'fd.name as destination_formula_name',
        'pd.project_name as destination_product_name'
      )
      .where('bt.id', parseInt(req.params.id))
      .first()
    
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' })
    }
    
    res.json(transfer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── CREATE TRANSFER ──────────────────────────────────────────────────────────
async function create(req, res) {
  try {
    const {
      source_batch_id,
      destination_batch_id,
      quantity_ml,
      reason = '',
      notes = '',
      operator = 'system'
    } = req.body
    
    // Validações básicas
    if (!source_batch_id || !destination_batch_id || !quantity_ml) {
      return res.status(400).json({ 
        error: 'source_batch_id, destination_batch_id e quantity_ml são obrigatórios' 
      })
    }
    
    if (parseFloat(quantity_ml) <= 0) {
      return res.status(400).json({ 
        error: 'Quantidade deve ser maior que zero' 
      })
    }
    
    const result = await db.transaction(async (trx) => {
      // 1. Buscar lote de origem
      const sourceBatch = await trx('batches')
        .where('id', parseInt(source_batch_id))
        .first()
      
      if (!sourceBatch) {
        throw new Error(`Lote de origem ${source_batch_id} não encontrado`)
      }
      
      // 2. Validar se tem ML suficiente
      if (parseFloat(sourceBatch.remaining_ml) < parseFloat(quantity_ml)) {
        throw new Error(
          `ML insuficiente no lote de origem.\n` +
          `Disponível: ${sourceBatch.remaining_ml}ml\n` +
          `Solicitado: ${quantity_ml}ml`
        )
      }
      
      // 3. Buscar lote de destino
      const destBatch = await trx('batches')
        .where('id', parseInt(destination_batch_id))
        .first()
      
      if (!destBatch) {
        throw new Error(`Lote de destino ${destination_batch_id} não encontrado`)
      }
      
      // 4. Validar se os lotes são da mesma fórmula (opcional - pode permitir entre fórmulas diferentes)
      if (sourceBatch.formula_id !== destBatch.formula_id) {
        console.warn(
          `⚠️  ATENÇÃO: Transferência entre fórmulas diferentes!\n` +
          `   Origem: Fórmula ${sourceBatch.formula_id}\n` +
          `   Destino: Fórmula ${destBatch.formula_id}`
        )
      }
      
      // 5. Criar registro de transferência
      const [transfer] = await trx('batch_transfers').insert({
        source_batch_id: parseInt(source_batch_id),
        destination_batch_id: parseInt(destination_batch_id),
        quantity_ml: parseFloat(quantity_ml),
        reason,
        notes,
        operator
      }).returning('*')
      
      // 6. Atualizar lote de origem (diminuir ML)
      const newSourceMl = parseFloat(sourceBatch.remaining_ml) - parseFloat(quantity_ml)
      await trx('batches')
        .where('id', parseInt(source_batch_id))
        .update({
          remaining_ml: newSourceMl,
          status: newSourceMl <= 0 ? 'Finalizado' : sourceBatch.status,
          updated_at: trx.fn.now()
        })
      
      // 7. Atualizar lote de destino (aumentar ML)
      const newDestMl = parseFloat(destBatch.remaining_ml) + parseFloat(quantity_ml)
      await trx('batches')
        .where('id', parseInt(destination_batch_id))
        .update({
          remaining_ml: newDestMl,
          updated_at: trx.fn.now()
        })
      
      // 8. Registrar movimentações nos lotes
      // Movimentação de saída (origem)
      await trx('batch_movements').insert({
        batch_id: parseInt(source_batch_id),
        movement_type: 'transfer_out',
        quantity_ml: -parseFloat(quantity_ml), // Negativo = saída
        previous_ml: parseFloat(sourceBatch.remaining_ml),
        current_ml: newSourceMl,
        reference_id: transfer.id,
        reference_type: 'batch_transfer',
        notes: `Transferência para lote ${destBatch.batch_code} - ${quantity_ml}ml`,
        operator
      })
      
      // Movimentação de entrada (destino)
      await trx('batch_movements').insert({
        batch_id: parseInt(destination_batch_id),
        movement_type: 'transfer_in',
        quantity_ml: parseFloat(quantity_ml), // Positivo = entrada
        previous_ml: parseFloat(destBatch.remaining_ml),
        current_ml: newDestMl,
        reference_id: transfer.id,
        reference_type: 'batch_transfer',
        notes: `Transferência do lote ${sourceBatch.batch_code} - ${quantity_ml}ml`,
        operator
      })
      
      // 9. Registrar no log de atividades
      await ActivityLogger.logTransfer(
        parseInt(source_batch_id),
        sourceBatch.batch_code,
        parseInt(destination_batch_id),
        destBatch.batch_code,
        parseFloat(quantity_ml),
        operator
      )
      
      // 10. Buscar dados completos para retorno
      const completeTransfer = await trx('batch_transfers as bt')
        .join('batches as bs', 'bs.id', 'bt.source_batch_id')
        .join('batches as bd', 'bd.id', 'bt.destination_batch_id')
        .select(
          'bt.*',
          'bs.batch_code as source_batch_code',
          'bs.remaining_ml as source_remaining_ml',
          'bd.batch_code as destination_batch_code',
          'bd.remaining_ml as destination_remaining_ml'
        )
        .where('bt.id', transfer.id)
        .first()
      
      return completeTransfer
    })
    
    res.status(201).json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// ─── GET TRANSFERS BY BATCH ───────────────────────────────────────────────────
async function getByBatch(req, res) {
  try {
    const { batch_id } = req.params
    const { limit = 50 } = req.query
    
    const transfers = await db('batch_transfers as bt')
      .join('batches as bs', 'bs.id', 'bt.source_batch_id')
      .join('batches as bd', 'bd.id', 'bt.destination_batch_id')
      .select(
        'bt.*',
        'bs.batch_code as source_batch_code',
        'bd.batch_code as destination_batch_code'
      )
      .where(function() {
        this.where('bt.source_batch_id', parseInt(batch_id))
          .orWhere('bt.destination_batch_id', parseInt(batch_id))
      })
      .orderBy('bt.transferred_at', 'desc')
      .limit(parseInt(limit))
    
    // Separar em transferências de saída e entrada
    const outgoing = transfers.filter(t => t.source_batch_id === parseInt(batch_id))
    const incoming = transfers.filter(t => t.destination_batch_id === parseInt(batch_id))
    
    // Calcular totais
    const totalOut = outgoing.reduce((sum, t) => sum + parseFloat(t.quantity_ml), 0)
    const totalIn = incoming.reduce((sum, t) => sum + parseFloat(t.quantity_ml), 0)
    
    res.json({
      batch_id: parseInt(batch_id),
      summary: {
        total_transfers: transfers.length,
        outgoing_transfers: outgoing.length,
        incoming_transfers: incoming.length,
        total_ml_out: totalOut,
        total_ml_in: totalIn,
        net_transfer: totalIn - totalOut
      },
      transfers: {
        all: transfers,
        outgoing,
        incoming
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── TRANSFER STATS ───────────────────────────────────────────────────────────
async function stats(req, res) {
  try {
    const { start_date, end_date } = req.query
    
    let query = db('batch_transfers')
    
    if (start_date) {
      query = query.where('transferred_at', '>=', start_date)
    }
    
    if (end_date) {
      query = query.where('transferred_at', '<=', end_date)
    }
    
    const [totals] = await query.clone()
      .count('* as total_transfers')
      .sum('quantity_ml as total_ml_transferred')
      .first()
    
    const byOperator = await query.clone()
      .select('operator')
      .count('* as count')
      .sum('quantity_ml as total_ml')
      .groupBy('operator')
      .orderBy('count', 'desc')
    
    const recentTransfers = await db('batch_transfers as bt')
      .join('batches as bs', 'bs.id', 'bt.source_batch_id')
      .join('batches as bd', 'bd.id', 'bt.destination_batch_id')
      .select(
        'bt.id',
        'bt.quantity_ml',
        'bt.transferred_at',
        'bs.batch_code as source_batch_code',
        'bd.batch_code as destination_batch_code'
      )
      .orderBy('bt.transferred_at', 'desc')
      .limit(10)
    
    res.json({
      period: {
        start_date: start_date || 'all time',
        end_date: end_date || 'now'
      },
      totals: {
        total_transfers: parseInt(totals.total_transfers || 0),
        total_ml_transferred: parseFloat(totals.total_ml_transferred || 0),
        average_ml_per_transfer: totals.total_transfers > 0 
          ? parseFloat(totals.total_ml_transferred) / parseInt(totals.total_transfers)
          : 0
      },
      by_operator: byOperator,
      recent_transfers: recentTransfers
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports = {
  list,
  getOne,
  create,
  getByBatch,
  stats
}
