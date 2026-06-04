const { db } = require('../models/db')
const ActivityLogger = require('../services/activityLogger')

async function getParam (key, defaultValue) {
  const row = await db('parameters').where('key', key).first()
  return row ? row.value : String(defaultValue)
}

// ─── GENERATE BATCH CODE ──────────────────────────────────────────────────────
// Formato: L_PPPPP_FFFFF_YYYYMMDD_N
// PPPPP = product_id 5 dígitos | FFFFF = formula_id 5 dígitos | N = lotes do projeto
async function generateBatchCode (product_id, formula_id, production_date) {
  const paddedProject = String(product_id || 0).padStart(5, '0')
  const paddedFormula = String(formula_id || 0).padStart(5, '0')
  const datePart = (production_date || new Date().toISOString().slice(0, 10)).replace(/-/g, '')

  const { max } = await db('batches')
    .where('product_id', product_id)
    .max('reduced_lot_number as max')
    .first()

  const N = parseInt(max || 0) + 1
  return `L_${paddedProject}_${paddedFormula}_${datePart}_${N}`
}

// ─── REDUCED LOT NUMBER ───────────────────────────────────────────────────────
async function getNextReducedLotNumber (product_id) {
  if (!product_id) return 1
  const { max } = await db('batches').where('product_id', product_id).max('reduced_lot_number as max').first()
  return parseInt(max || 0) + 1
}

// ─── LIST BATCHES ─────────────────────────────────────────────────────────────
async function list(req, res) {
  try {
    const { formula_id, product_id, status, search } = req.query

    let query = db('batches as b')
      .join('formulas as f', 'f.id', 'b.formula_id')
      .leftJoin('products as p', 'p.id', 'b.product_id')
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

    if (product_id) {
      query = query.where('b.product_id', parseInt(product_id))
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
        const startDate = new Date(batch.maceration_start)
        const endDate = new Date(batch.maceration_end)
        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
        const totalMs = endDate - startDate
        const elapsedMs = today - startDate

        batch.maceration_info = {
          days_remaining: Math.max(0, daysRemaining),
          is_ready: daysRemaining <= 0,
          progress_percentage: Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
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
      .leftJoin('products as p', 'p.id', 'b.product_id')
      .select(
        'b.*',
        'f.name as formula_name',
        'f.description as formula_description',
        'f.essence_percentage',
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
      const startDate = new Date(batch.maceration_start)
      const endDate = new Date(batch.maceration_end)
      const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
      const totalMs = endDate - startDate
      const elapsedMs = today - startDate

      batch.maceration_info = {
        days_remaining: Math.max(0, daysRemaining),
        is_ready: daysRemaining <= 0,
        progress_percentage: Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
      }
    }
    
    // Buscar essências usadas no lote
    const batchEssences = await db('batch_essences as be')
      .join('supplies as s', 's.id', 'be.supply_id')
      .join('suppliers as sp', 'sp.id', 's.supplier_id')
      .select(
        'be.*',
        's.name as supply_name',
        's.unit_cost',
        's.batch as supply_batch',
        'sp.name as supplier_name'
      )
      .where('be.batch_id', batch.id)
      .orderBy('be.id', 'asc')

    batch.movements = movements
    batch.formula_items = formulaItems
    batch.batch_essences = batchEssences

    res.json(batch)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── CREATE BATCH ─────────────────────────────────────────────────────────────
async function create(req, res) {
  try {
    const {
      product_id,
      formula_id,
      batch_code: providedCode,
      production_date,
      quantity_ml: providedQty,
      chorinho_ml: providedChorinho = 0,
      essences = [],   // [{ supply_id, quantity, unit }]
      notes = '',
      start_maceration = true
    } = req.body

    const chorinho_ml = parseFloat(providedChorinho) || 0

    // Verificar projeto
    if (product_id) {
      const product = await db('products').where('id', parseInt(product_id)).first()
      if (!product) return res.status(400).json({ error: 'Product not found' })
    }

    // Verificar fórmula
    const formula = await db('formulas').where('id', parseInt(formula_id)).first()
    if (!formula) return res.status(400).json({ error: 'Formula not found' })
    if (!formula.validated) return res.status(400).json({ error: 'Formula must be validated before creating batch' })

    // Calcular volume total do lote a partir das essências (se informadas)
    let quantity_ml = parseFloat(providedQty) || 0
    if (!quantity_ml && essences.length > 0 && parseFloat(formula.essence_percentage) > 0) {
      const totalEssenceMl = essences.reduce((sum, e) => sum + parseFloat(e.quantity || 0), 0)
      quantity_ml = totalEssenceMl / (parseFloat(formula.essence_percentage) / 100)
    }

    if (quantity_ml <= 0) return res.status(400).json({ error: 'Quantity must be greater than 0' })

    // Gap #7: limite de chorinho baseado no parâmetro de tolerância
    const chorinhoPct = parseFloat(await getParam('chorinho_tolerance_pct', 5)) / 100
    const maxChorinho = quantity_ml * chorinhoPct
    if (chorinho_ml > maxChorinho) {
      return res.status(400).json({
        error: `Chorinho de ${chorinho_ml}ml excede o limite permitido de ${maxChorinho.toFixed(2)}ml (${(chorinhoPct * 100).toFixed(0)}% de ${quantity_ml}ml)`
      })
    }

    // Volume real = calculado + chorinho (sobra real da produção)
    const actual_ml = quantity_ml + chorinho_ml

    // Buscar itens da fórmula para calcular custo
    const formulaItems = await db('formula_items as fi')
      .join('supplies as s', 's.id', 'fi.supply_id')
      .select('fi.supply_id', 'fi.percentage', 's.unit_cost')
      .where('fi.formula_id', parseInt(formula_id))

    // Validar e calcular custo das essências (batch lookup)
    let essenceCost = 0
    if (essences.length > 0) {
      const essenceIds = [...new Set(essences.map(e => parseInt(e.supply_id)))]
      const suppliesMap = await db('supplies')
        .whereIn('id', essenceIds)
        .select('id', 'name', 'unit', 'unit_cost', 'quantity_available', 'is_open')
        .then(rows => Object.fromEntries(rows.map(r => [r.id, r])))

      // Agrupa total por supply_id — mesma essência duas vezes soma antes de validar
      const neededBySupply = {}
      for (const e of essences) {
        const id = parseInt(e.supply_id)
        neededBySupply[id] = (neededBySupply[id] || 0) + parseFloat(e.quantity || 0)
      }

      for (const [supplyIdStr, qtdTotal] of Object.entries(neededBySupply)) {
        const supply = suppliesMap[parseInt(supplyIdStr)]
        if (!supply) return res.status(400).json({ error: `Essência ID ${supplyIdStr} não encontrada` })
        if (!supply.is_open) return res.status(400).json({ error: `Essência "${supply.name}" está fechada e não pode ser usada em novos lotes` })

        const qtdDisponivel = parseFloat(supply.quantity_available || 0)
        if (qtdTotal > qtdDisponivel) {
          return res.status(400).json({
            error: `Estoque insuficiente para "${supply.name}": disponível ${qtdDisponivel}${supply.unit}, solicitado ${qtdTotal}${supply.unit}`
          })
        }
        essenceCost += parseFloat(supply.unit_cost || 0) * qtdTotal
      }
    }

    // Custo dos demais insumos
    const insumosCost = formulaItems.reduce((sum, item) => {
      const itemQty = (quantity_ml * parseFloat(item.percentage)) / 100
      return sum + (parseFloat(item.unit_cost) * itemQty)
    }, 0)

    const totalCost = essenceCost + insumosCost
    const costPerMl = actual_ml > 0 ? totalCost / actual_ml : 0

    // Lote reduzido e código
    const reduced_lot_number = await getNextReducedLotNumber(product_id ? parseInt(product_id) : null)
    const batch_code = providedCode?.trim() || await generateBatchCode(
      product_id ? parseInt(product_id) : 0,
      parseInt(formula_id),
      production_date
    )

    // Datas de maceração
    const macerationDays = parseInt(await getParam('maceration_days', 10))
    const macerationStart = start_maceration ? new Date(production_date) : null
    const macerationEnd = start_maceration
      ? new Date(new Date(production_date).getTime() + macerationDays * 24 * 60 * 60 * 1000)
      : null

    const result = await db.transaction(async (trx) => {
      const [batch] = await trx('batches').insert({
        product_id: product_id ? parseInt(product_id) : null,
        formula_id: parseInt(formula_id),
        batch_code,
        production_date,
        quantity_ml:   actual_ml,
        remaining_ml:  actual_ml,
        chorinho_ml,
        total_cost:    totalCost,
        cost_per_ml:   costPerMl,
        reduced_lot_number,
        status: start_maceration ? 'Em maceração' : 'Pronto para envase',
        maceration_start: macerationStart,
        maceration_end:   macerationEnd,
        notes,
        active: true
      }).returning('*')

      // Registrar movimentação de produção
      await trx('batch_movements').insert({
        batch_id: batch.id,
        movement_type: 'production',
        quantity_ml:  actual_ml,
        previous_ml:  0,
        current_ml:   actual_ml,
        notes: chorinho_ml > 0
          ? `Produção inicial do lote ${batch_code} (inclui ${chorinho_ml}ml de chorinho)`
          : `Produção inicial do lote ${batch_code}`,
        operator: 'system'
      })

      // Registrar essências usadas e decrementar estoque
      if (essences.length > 0) {
        const essenceRows = essences.map(e => ({
          batch_id:         batch.id,
          supply_id:        parseInt(e.supply_id),
          quantity:         parseFloat(e.quantity),
          unit:             e.unit || 'ml',
          essence_code:     e.essence_code     || null,
          supplier_lot_ref: e.supplier_lot_ref || null,
        }))
        await trx('batch_essences').insert(essenceRows)

        // Decrementar e auto-fechar em um único UPDATE atômico
        for (const e of essences) {
          await trx.raw(
            `UPDATE supplies
             SET quantity_available = GREATEST(0, quantity_available - ?),
                 is_open = CASE WHEN GREATEST(0, quantity_available - ?) <= 0 THEN false ELSE is_open END
             WHERE id = ?`,
            [parseFloat(e.quantity), parseFloat(e.quantity), parseInt(e.supply_id)]
          )
        }
      }

      return batch
    })

    await ActivityLogger.logCreate('batch', result.id, batch_code, result)
    res.status(201).json(result)
  } catch (error) {
    if (error.code === '23505') {
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

    // Se chorinho_ml mudou, ajusta remaining_ml pelo delta
    if (updateData.chorinho_ml !== undefined) {
      const oldChorinho = parseFloat(batch.chorinho_ml || 0)
      const newChorinho = parseFloat(updateData.chorinho_ml || 0)
      const delta = newChorinho - oldChorinho
      if (delta !== 0) {
        updateData.quantity_ml  = parseFloat(batch.quantity_ml)  + delta
        updateData.remaining_ml = Math.max(0, parseFloat(batch.remaining_ml) + delta)
      }
    }

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
    const id = parseInt(req.params.id)
    const batch = await db('batches').where('id', id).first()
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }

    const bottlingBatches = await db('bottling_batches').where({ batch_id: id }).count('* as total').first()
    if (parseInt(bottlingBatches.total) > 0) {
      return res.status(409).json({ error: 'Lote não pode ser excluído pois foi utilizado em envase(s).' })
    }

    const transfers = await db('batch_transfers')
      .where('source_batch_id', id).orWhere('destination_batch_id', id)
      .count('* as total').first()
    if (parseInt(transfers.total) > 0) {
      return res.status(409).json({ error: 'Lote não pode ser excluído pois possui transferências registradas.' })
    }

    const bottlingOrders = await db('bottling_orders').where({ batch_id: id }).count('* as total').first()
    if (parseInt(bottlingOrders.total) > 0) {
      return res.status(409).json({ error: 'Lote não pode ser excluído pois está vinculado a ordens de envase.' })
    }

    // Restaurar estoque das essências usadas neste lote
    const batchEssences = await db('batch_essences').where({ batch_id: id }).select('supply_id', 'quantity')

    await db.transaction(async trx => {
      for (const be of batchEssences) {
        await trx.raw(
          'UPDATE supplies SET quantity_available = quantity_available + ?, is_open = true WHERE id = ?',
          [parseFloat(be.quantity), parseInt(be.supply_id)]
        )
      }
      await trx('batches').where('id', id).del()
    })

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
    
    const macerationDays = parseInt(await getParam('maceration_days', 10))
    const macerationStart = new Date()
    const macerationEnd = new Date(macerationStart.getTime() + (macerationDays * 24 * 60 * 60 * 1000))
    
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
      notes: `Início da maceração (${macerationDays} dias)`,
      operator: 'system'
    })
    
    // Log da maceração
    await ActivityLogger.logMacerationStart(batch.id, batch.batch_code, macerationEnd)
    
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── FORMULA INFO (essence % + itens para pre-fill no lote) ──────────────────
async function formulaInfo (req, res) {
  try {
    const formula_id = parseInt(req.params.formula_id)
    const formula = await db('formulas as f')
      .leftJoin('products as p', 'p.id', 'f.product_id')
      .select('f.id', 'f.name', 'f.essence_percentage', 'p.project_name', 'p.commercial_name')
      .where('f.id', formula_id)
      .first()

    if (!formula) return res.status(404).json({ error: 'Formula not found' })

    const items = await db('formula_items as fi')
      .join('supplies as s', 's.id', 'fi.supply_id')
      .join('suppliers as sp', 'sp.id', 's.supplier_id')
      .select(
        'fi.supply_id',
        'fi.percentage',
        's.name as supply_name',
        's.type as supply_type',
        's.unit',
        's.unit_cost',
        'sp.id as supplier_id',
        'sp.name as supplier_name'
      )
      .where('fi.formula_id', formula_id)
      .orderBy('fi.order_index', 'asc')

    res.json({ ...formula, items })
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

async function nextCode (req, res) {
  try {
    const { product_id, formula_id, production_date } = req.query
    const code = await generateBatchCode(
      product_id ? parseInt(product_id) : 0,
      formula_id ? parseInt(formula_id) : 0,
      production_date || null
    )
    const reduced_lot_number = await getNextReducedLotNumber(product_id ? parseInt(product_id) : null)
    res.json({ batch_code: code, reduced_lot_number })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── STOCK SUMMARY (saldo real por produto) ───────────────────────────────────
async function stockSummary (req, res) {
  try {
    // ml disponível em lotes ativos por produto, separando "pronto" de "macerando"
    const batchStock = await db('batches as b')
      .leftJoin('products as p', 'p.id', 'b.product_id')
      .select(
        'b.product_id',
        'p.project_name',
        'p.commercial_name',
        db.raw(`COALESCE(SUM(CASE WHEN b.status = 'Em maceração' THEN b.remaining_ml ELSE 0 END), 0) as macerating_ml`),
        db.raw(`COALESCE(SUM(CASE WHEN b.status <> 'Em maceração' THEN b.remaining_ml ELSE 0 END), 0) as ready_ml`),
        db.raw('COALESCE(SUM(b.remaining_ml), 0) as total_ml')
      )
      .whereNot('b.status', 'Finalizado')
      .whereNotNull('b.product_id')
      .groupBy('b.product_id', 'p.project_name', 'p.commercial_name')

    // ml comprometido = quantidade ainda não coberta por envase vinculado × volume
    // Uma vez que o item tem todos os envases vinculados, sai do comprometido.
    const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'In Production', 'Ready']
    const committed = await db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .leftJoin(
        db('order_item_bottlings')
          .select('order_item_id')
          .sum('quantity as total_linked')
          .groupBy('order_item_id')
          .as('oib_sum'),
        'oib_sum.order_item_id', 'oi.id'
      )
      .select(
        'oi.product_id',
        db.raw('COALESCE(SUM(GREATEST(0, oi.quantity - COALESCE(oib_sum.total_linked, 0)) * oi.volume_ml), 0) as committed_ml')
      )
      .whereIn('o.status', ACTIVE_STATUSES)
      .whereNotNull('oi.product_id')
      .groupBy('oi.product_id')

    const committedMap = {}
    committed.forEach(r => { committedMap[r.product_id] = parseFloat(r.committed_ml || 0) })

    const summary = batchStock.map(row => {
      const total_ml      = parseFloat(row.total_ml      || 0)
      const ready_ml      = parseFloat(row.ready_ml      || 0)
      const macerating_ml = parseFloat(row.macerating_ml || 0)
      const committed_ml  = committedMap[row.product_id] || 0
      return {
        product_id:      row.product_id,
        project_name:    row.project_name,
        commercial_name: row.commercial_name,
        total_ml,
        ready_ml,
        macerating_ml,
        committed_ml,
        // Disponível só conta o que está pronto para envase
        available_ml: Math.max(0, ready_ml - committed_ml),
      }
    })

    res.json(summary)
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
  mergeBatches,
  nextCode,
  stockSummary,
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
          progress_percentage: Math.min(100, Math.max(0, ((new Date() - new Date(batch.maceration_start)) / (new Date(batch.maceration_end) - new Date(batch.maceration_start))) * 100)),
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
