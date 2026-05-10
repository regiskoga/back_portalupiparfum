const { db } = require('../models/db')
const ActivityLogger = require('../services/activityLogger')

// ─── GENERATE BATCH CODE ──────────────────────────────────────────────────────
async function generateBatchCode () {
  const today = new Date()
  const yy = String(today.getFullYear()).slice(2)
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const prefix = `L${yy}${mm}${dd}`

  const { cnt } = await db('batches')
    .where('batch_code', 'like', `${prefix}%`)
    .count('* as cnt')
    .first()

  const seq = String(parseInt(cnt) + 1).padStart(3, '0')
  return `${prefix}-${seq}`
}

// ─── LIST BATCHES ─────────────────────────────────────────────────────────────
async function list(req, res) {
  try {
    const { formula_id, status, search } = req.query
    
    let query = db('batches as b')
      .join('formulas as f', 'f.id', 'b.formula_id')
      .join('products as p', 'p.id', 'f.product_id')
      .select(
        'b.*',
        'f.name as formula_name',
        'p.project_name',
        'p.commercial_name'
      )
      .orderBy('b.production_date', 'desc')
    
    // Filtros
    if (formula_id) {
      query = query.where('b.formula_id', parseInt(formula_id))
    }
    
    if (status) {
      query = query.where('b.status', status)
    }
    
    if (search) {
      query = query.where(function() {
        this.where('b.batch_code', 'ilike', `%${search}%`)
          .orWhere('p.project_name', 'ilike', `%${search}%`)
          .orWhere('p.commercial_name', 'ilike', `%${search}%`)
      })
    }
    
    const batches = await query
    
    // Adicionar informações de maceração
    const batchesWithMaceration = batches.map(batch => {
      if (batch.maceration_start && batch.maceration_end) {
        const today = new Date()
        const endDate = new Date(batch.maceration_end)
        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
        
        batch.maceration_info = {
          days_remaining: Math.max(0, daysRemaining),
          is_ready: daysRemaining <= 0,
          progress_percentage: Math.min(100, Math.max(0, ((10 - daysRemaining) / 10) * 100))
        }
      }
      
      return batch
    })
    
    res.json(batchesWithMaceration)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── GET ONE BATCH ────────────────────────────────────────────────────────────
async function getOne(req, res) {
  try {
    const batch = await db('batches as b')
      .join('formulas as f', 'f.id', 'b.formula_id')
      .join('products as p', 'p.id', 'f.product_id')
      .select(
        'b.*',
        'f.name as formula_name',
        'f.description as formula_description',
        'p.project_name',
        'p.commercial_name'
      )
      .where('b.id', parseInt(req.params.id))
      .first()
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    // Buscar movimentações do lote
    const movements = await db('batch_movements')
      .where('batch_id', batch.id)
      .orderBy('created_at', 'desc')
    
    // Buscar itens da fórmula usada
    const formulaItems = await db('formula_items as fi')
      .join('supplies as s', 's.id', 'fi.supply_id')
      .select(
        'fi.*',
        's.name as supply_name',
        's.type as supply_type',
        's.unit',
        's.unit_cost'
      )
      .where('fi.formula_id', batch.formula_id)
      .orderBy('fi.order_index', 'asc')
    
    // Calcular informações de maceração
    if (batch.maceration_start && batch.maceration_end) {
      const today = new Date()
      const endDate = new Date(batch.maceration_end)
      const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
      
      batch.maceration_info = {
        days_remaining: Math.max(0, daysRemaining),
        is_ready: daysRemaining <= 0,
        progress_percentage: Math.min(100, Math.max(0, ((10 - daysRemaining) / 10) * 100))
      }
    }
    
    batch.movements = movements
    batch.formula_items = formulaItems
    
    res.json(batch)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── CREATE BATCH ─────────────────────────────────────────────────────────────
async function create(req, res) {
  try {
    const {
      formula_id,
      batch_code: providedCode,
      production_date,
      quantity_ml,
      notes = '',
      start_maceration = true
    } = req.body

    // Verificar se fórmula existe e está validada
    const formula = await db('formulas').where('id', parseInt(formula_id)).first()
    if (!formula) {
      return res.status(400).json({ error: 'Formula not found' })
    }

    if (!formula.validated) {
      return res.status(400).json({ error: 'Formula must be validated before creating batch' })
    }

    const batch_code = providedCode && providedCode.trim() ? providedCode.trim() : await generateBatchCode()

    // Buscar itens da fórmula para calcular custo
    const formulaItems = await db('formula_items as fi')
      .join('supplies as s', 's.id', 'fi.supply_id')
      .select('fi.percentage', 's.unit_cost')
      .where('fi.formula_id', parseInt(formula_id))

    // Calcular custo total do lote
    const totalCost = formulaItems.reduce((sum, item) => {
      const itemCostPerMl = (parseFloat(item.unit_cost) * parseFloat(item.percentage)) / 100
      return sum + (itemCostPerMl * parseFloat(quantity_ml))
    }, 0)

    const costPerMl = totalCost / parseFloat(quantity_ml)

    // Datas de maceração
    const macerationStart = start_maceration ? new Date(production_date) : null
    const macerationEnd = start_maceration ? new Date(new Date(production_date).getTime() + (10 * 24 * 60 * 60 * 1000)) : null

    const result = await db.transaction(async (trx) => {
      // Criar lote
      const [batch] = await trx('batches').insert({
        formula_id: parseInt(formula_id),
        batch_code,
        production_date,
        quantity_ml: parseFloat(quantity_ml),
        remaining_ml: parseFloat(quantity_ml),
        total_cost: totalCost,
        cost_per_ml: costPerMl,
        status: start_maceration ? 'Em maceração' : 'Pronto para envase',
        maceration_start: macerationStart,
        maceration_end: macerationEnd,
        notes,
        active: true
      }).returning('*')
      
      // Registrar movimentação de produção
      await trx('batch_movements').insert({
        batch_id: batch.id,
        movement_type: 'production',
        quantity_ml: parseFloat(quantity_ml),
        previous_ml: 0,
        current_ml: parseFloat(quantity_ml),
        notes: `Produção inicial do lote ${batch_code}`,
        operator: 'system'
      })
      
      // Baixar insumos do estoque (proporcional aos percentuais)
      for (const item of formulaItems) {
        const quantityUsed = (parseFloat(quantity_ml) * parseFloat(item.percentage)) / 100
        
        // Aqui deveria baixar do estoque de supplies
        // Por enquanto, apenas registramos o uso
        console.log(`Usado ${quantityUsed}ml do insumo ${item.supply_id}`)
      }
      
      return batch
    })
    
    // Log da criação
    await ActivityLogger.logCreate('batch', result.id, batch_code, result)
    
    res.status(201).json(result)
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Batch code already exists' })
    } else {
      res.status(400).json({ error: error.message })
    }
  }
}

// ─── UPDATE BATCH ─────────────────────────────────────────────────────────────
async function update(req, res) {
  try {
    const batch = await db('batches').where('id', parseInt(req.params.id)).first()
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    const updateData = { ...req.body }
    updateData.updated_at = db.fn.now()
    
    // Se mudando status para "Pronto para envase", verificar maceração
    if (updateData.status === 'Pronto para envase' && batch.maceration_end) {
      const today = new Date()
      const endDate = new Date(batch.maceration_end)
      
      if (today < endDate) {
        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
        return res.status(400).json({ 
          error: `Batch still in maceration. ${daysRemaining} days remaining.` 
        })
      }
    }
    
    const [updated] = await db('batches')
      .where('id', parseInt(req.params.id))
      .update(updateData)
      .returning('*')
    
    res.json(updated)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// ─── DELETE BATCH ─────────────────────────────────────────────────────────────
async function remove(req, res) {
  try {
    const batch = await db('batches').where('id', parseInt(req.params.id)).first()
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    // Verificar se lote foi usado (remaining_ml < quantity_ml)
    if (parseFloat(batch.remaining_ml) < parseFloat(batch.quantity_ml)) {
      return res.status(400).json({ 
        error: 'Cannot delete batch that has been partially used' 
      })
    }
    
    await db('batches').where('id', parseInt(req.params.id)).del()
    res.json({ message: 'Batch deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── BATCH STATS ──────────────────────────────────────────────────────────────
async function stats(req, res) {
  try {
    const [totals] = await db('batches')
      .count('* as total_batches')
      .sum('quantity_ml as total_produced_ml')
      .sum('remaining_ml as total_remaining_ml')
      .sum('total_cost as total_production_cost')
      .first()
    
    const statusStats = await db('batches')
      .select('status')
      .count('* as count')
      .sum('remaining_ml as remaining_ml')
      .where('active', true)
      .groupBy('status')
    
    // Lotes prontos para envase (maceração concluída)
    const readyBatches = await db('batches')
      .where('status', 'Em maceração')
      .where('maceration_end', '<=', db.fn.now())
      .count('* as count')
      .first()
    
    res.json({
      total_batches: parseInt(totals.total_batches || 0),
      total_produced_ml: parseFloat(totals.total_produced_ml || 0),
      total_remaining_ml: parseFloat(totals.total_remaining_ml || 0),
      total_production_cost: parseFloat(totals.total_production_cost || 0),
      average_cost_per_ml: totals.total_produced_ml > 0 ? 
        parseFloat(totals.total_production_cost) / parseFloat(totals.total_produced_ml) : 0,
      by_status: statusStats,
      ready_for_bottling: parseInt(readyBatches.count || 0)
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── START MACERATION ────────────────────────────────────────────────────────
async function startMaceration(req, res) {
  try {
    const batch = await db('batches').where('id', parseInt(req.params.id)).first()
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    if (batch.maceration_start) {
      return res.status(400).json({ error: 'Maceration already started' })
    }
    
    const macerationStart = new Date()
    const macerationEnd = new Date(macerationStart.getTime() + (10 * 24 * 60 * 60 * 1000)) // 10 dias
    
    const [updated] = await db('batches')
      .where('id', parseInt(req.params.id))
      .update({
        status: 'Em maceração',
        maceration_start: macerationStart,
        maceration_end: macerationEnd,
        updated_at: db.fn.now()
      })
      .returning('*')
    
    // Registrar movimentação
    await db('batch_movements').insert({
      batch_id: parseInt(req.params.id),
      movement_type: 'maceration_start',
      quantity_ml: 0,
      previous_ml: parseFloat(batch.remaining_ml),
      current_ml: parseFloat(batch.remaining_ml),
      notes: 'Início da maceração (10 dias)',
      operator: 'system'
    })
    
    // Log da maceração
    await ActivityLogger.logMacerationStart(batch.id, batch.batch_code, macerationEnd)
    
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── FORMULA INFO (project + essence %) ──────────────────────────────────────
async function formulaInfo (req, res) {
  try {
    const formula_id = parseInt(req.params.formula_id)
    const formula = await db('formulas as f')
      .join('products as p', 'p.id', 'f.product_id')
      .select('f.id', 'f.name', 'p.project_name', 'p.commercial_name')
      .where('f.id', formula_id)
      .first()

    if (!formula) return res.status(404).json({ error: 'Formula not found' })

    const items = await db('formula_items as fi')
      .join('supplies as s', 's.id', 'fi.supply_id')
      .select('fi.percentage', 's.type')
      .where('fi.formula_id', formula_id)

    const essence_percentage = items
      .filter(i => i.type === 'Essence')
      .reduce((sum, i) => sum + parseFloat(i.percentage), 0)

    res.json({ ...formula, essence_percentage })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── MERGE BATCHES ────────────────────────────────────────────────────────────
async function mergeBatches (req, res) {
  try {
    const { formula_id, batch_ids, notes = '' } = req.body

    if (!Array.isArray(batch_ids) || batch_ids.length < 2) {
      return res.status(400).json({ error: 'Selecione ao menos 2 lotes para unificar' })
    }

    const batches = await db('batches').whereIn('id', batch_ids)

    if (batches.length !== batch_ids.length) {
      return res.status(400).json({ error: 'Um ou mais lotes não encontrados' })
    }

    for (const b of batches) {
      if (parseInt(b.formula_id) !== parseInt(formula_id)) {
        return res.status(400).json({ error: 'Todos os lotes devem pertencer à mesma fórmula' })
      }
      if (b.status === 'Finalizado') {
        return res.status(400).json({ error: `Lote ${b.batch_code} já está finalizado` })
      }
    }

    const totalMl = batches.reduce((sum, b) => sum + parseFloat(b.remaining_ml), 0)

    const formulaItems = await db('formula_items as fi')
      .join('supplies as s', 's.id', 'fi.supply_id')
      .select('fi.percentage', 's.unit_cost')
      .where('fi.formula_id', parseInt(formula_id))

    const totalCost = formulaItems.reduce((sum, item) => {
      const perMl = (parseFloat(item.unit_cost) * parseFloat(item.percentage)) / 100
      return sum + perMl * totalMl
    }, 0)

    const costPerMl = totalMl > 0 ? totalCost / totalMl : 0
    const batch_code = await generateBatchCode()
    const today = new Date().toISOString().slice(0, 10)

    const result = await db.transaction(async (trx) => {
      const [newBatch] = await trx('batches').insert({
        formula_id: parseInt(formula_id),
        batch_code,
        production_date: today,
        quantity_ml: totalMl,
        remaining_ml: totalMl,
        total_cost: totalCost,
        cost_per_ml: costPerMl,
        status: 'Pronto para envase',
        notes: notes || `Unificação: ${batches.map(b => b.batch_code).join(', ')}`,
        active: true
      }).returning('*')

      await trx('batch_movements').insert({
        batch_id: newBatch.id,
        movement_type: 'production',
        quantity_ml: totalMl,
        previous_ml: 0,
        current_ml: totalMl,
        notes: `Criado por unificação de: ${batches.map(b => b.batch_code).join(', ')}`,
        operator: 'system'
      })

      await trx('batches')
        .whereIn('id', batch_ids)
        .update({ status: 'Finalizado', updated_at: db.fn.now() })

      return newBatch
    })

    res.status(201).json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  stats,
  startMaceration,
  canBeBottled,
  updateMacerationStatus,
  formulaInfo,
  mergeBatches
}


// ─── CHECK IF BATCH CAN BE BOTTLED ───────────────────────────────────────────
async function canBeBottled(req, res) {
  try {
    const batch = await db('batches').where('id', parseInt(req.params.id)).first()
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    const result = {
      batch_id: batch.id,
      batch_code: batch.batch_code,
      can_bottle: false,
      reason: null,
      maceration_info: null
    }
    
    // Verificar se está em maceração
    if (batch.status === 'Em maceração' && batch.maceration_end) {
      const today = new Date()
      const endDate = new Date(batch.maceration_end)
      
      if (today < endDate) {
        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
        const hoursRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60))
        
        result.can_bottle = false
        result.reason = 'maceration_not_complete'
        result.maceration_info = {
          status: 'in_progress',
          start_date: batch.maceration_start,
          end_date: batch.maceration_end,
          days_remaining: daysRemaining,
          hours_remaining: hoursRemaining,
          progress_percentage: Math.min(100, Math.max(0, ((10 - daysRemaining) / 10) * 100)),
          message: `Lote ainda em maceração. Faltam ${daysRemaining} dia(s) para liberação.`
        }
        
        return res.json(result)
      } else {
        // Maceração completa, mas status não atualizado
        result.maceration_info = {
          status: 'complete',
          start_date: batch.maceration_start,
          end_date: batch.maceration_end,
          days_remaining: 0,
          hours_remaining: 0,
          progress_percentage: 100,
          message: 'Maceração completa! Lote pronto para envase.'
        }
      }
    }
    
    // Verificar status
    if (batch.status !== 'Pronto para envase' && batch.status !== 'Em maceração') {
      result.can_bottle = false
      result.reason = 'invalid_status'
      result.message = `Lote com status inválido: ${batch.status}`
      return res.json(result)
    }
    
    // Verificar se tem ML disponível
    if (parseFloat(batch.remaining_ml) <= 0) {
      result.can_bottle = false
      result.reason = 'no_ml_available'
      result.message = 'Lote sem ML disponível'
      return res.json(result)
    }
    
    // Tudo OK!
    result.can_bottle = true
    result.remaining_ml = parseFloat(batch.remaining_ml)
    result.message = 'Lote disponível para envase'
    
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── UPDATE MACERATION STATUS (CRON JOB) ─────────────────────────────────────
async function updateMacerationStatus(req, res) {
  try {
    // Buscar lotes em maceração que já passaram da data de liberação
    const readyBatches = await db('batches')
      .where('status', 'Em maceração')
      .where('maceration_end', '<=', db.fn.now())
    
    let updated = 0
    
    for (const batch of readyBatches) {
      await db('batches')
        .where('id', batch.id)
        .update({
          status: 'Pronto para envase',
          updated_at: db.fn.now()
        })
      
      // Registrar movimentação
      await db('batch_movements').insert({
        batch_id: batch.id,
        movement_type: 'maceration_complete',
        quantity_ml: 0,
        previous_ml: parseFloat(batch.remaining_ml),
        current_ml: parseFloat(batch.remaining_ml),
        notes: 'Maceração concluída automaticamente',
        operator: 'system'
      })
      
      updated++
    }
    
    res.json({
      message: `${updated} lote(s) atualizado(s) para "Pronto para envase"`,
      updated_count: updated,
      updated_batches: readyBatches.map(b => ({
        id: b.id,
        batch_code: b.batch_code,
        maceration_end: b.maceration_end
      }))
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
