const { db } = require('../models/db')
const ActivityLogger = require('../services/activityLogger')

async function getParam (key, defaultValue) {
  const row = await db('parameters').where('key', key).first()
  return row ? row.value : String(defaultValue)
}

// ─── GENERATE BOTTLING CODE ───────────────────────────────────────────────────
async function generateBottlingCode () {
  const today = new Date()
  const yy = String(today.getFullYear()).slice(2)
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const prefix = `ENV${yy}${mm}${dd}`
  const { cnt } = await db('bottlings').where('bottling_code', 'like', `${prefix}%`).count('* as cnt').first()
  return `${prefix}-${String(parseInt(cnt) + 1).padStart(3, '0')}`
}

// ─── LIST BOTTLINGS ───────────────────────────────────────────────────────────
async function list(req, res) {
  try {
    const { search, start_date, end_date, product_id, volume_ml, type } = req.query

    let query = db('bottlings as bt')
      .select(
        'bt.*',
        'bs.name as bottle_name',
        'ls.name as label_name'
      )
      .leftJoin('supplies as bs', 'bs.id', 'bt.bottle_supply_id')
      .leftJoin('supplies as ls', 'ls.id', 'bt.label_supply_id')
      .orderBy('bt.bottling_date', 'desc')

    if (type === 'brinde' || type === 'normal') {
      query = query.where('bt.type', type)
    }

    // Filtros
    if (search) {
      query = query.where(function() {
        this.where('bt.bottling_code', 'ilike', `%${search}%`)
          .orWhere('bt.product_name', 'ilike', `%${search}%`)
          .orWhere('bt.product_ref', 'ilike', `%${search}%`)
      })
    }

    if (product_id) {
      query = query.whereIn('bt.id', function () {
        this.select('bb.bottling_id')
          .from('bottling_batches as bb')
          .join('batches as b', 'b.id', 'bb.batch_id')
          .where('b.product_id', parseInt(product_id))
      })
    }

    if (volume_ml) {
      query = query.where('bt.volume_ml', parseFloat(volume_ml))
    }

    if (start_date) {
      query = query.where('bt.bottling_date', '>=', start_date)
    }

    if (end_date) {
      query = query.where('bt.bottling_date', '<=', end_date)
    }
    
    const bottlings = await query

    if (bottlings.length > 0) {
      const bottlingIds = bottlings.map(b => b.id)
      const allBatches = await db('bottling_batches as bb')
        .join('batches as b', 'b.id', 'bb.batch_id')
        .join('formulas as f', 'f.id', 'b.formula_id')
        .leftJoin('products as p', 'p.id', 'b.product_id')
        .select('bb.*', 'b.batch_code', 'b.reduced_lot_number', 'b.cost_per_ml', 'f.name as formula_name', 'p.project_name')
        .whereIn('bb.bottling_id', bottlingIds)

      const batchesByBottling = {}
      for (const batch of allBatches) {
        if (!batchesByBottling[batch.bottling_id]) batchesByBottling[batch.bottling_id] = []
        batchesByBottling[batch.bottling_id].push(batch)
      }
      for (const bottling of bottlings) {
        const batches = batchesByBottling[bottling.id] || []
        bottling.batches = batches
        bottling.total_ml_used = batches.reduce((sum, b) => sum + parseFloat(b.ml_used), 0)
      }
    }

    res.json(bottlings)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── GET ONE BOTTLING ─────────────────────────────────────────────────────────
async function getOne(req, res) {
  try {
    const bottling = await db('bottlings as bt')
      .select(
        'bt.*',
        'bs.name as bottle_name',
        'bs.unit_cost as bottle_unit_cost',
        'ls.name as label_name',
        'ls.unit_cost as label_unit_cost'
      )
      .leftJoin('supplies as bs', 'bs.id', 'bt.bottle_supply_id')
      .leftJoin('supplies as ls', 'ls.id', 'bt.label_supply_id')
      .where('bt.id', parseInt(req.params.id))
      .first()
    
    if (!bottling) {
      return res.status(404).json({ error: 'Bottling not found' })
    }
    
    // Buscar lotes utilizados
    const batches = await db('bottling_batches as bb')
      .join('batches as b', 'b.id', 'bb.batch_id')
      .join('formulas as f', 'f.id', 'b.formula_id')
      .leftJoin('products as p', 'p.id', 'b.product_id')
      .select(
        'bb.*',
        'b.batch_code',
        'b.cost_per_ml',
        'b.remaining_ml',
        'f.name as formula_name',
        'p.project_name'
      )
      .where('bb.bottling_id', bottling.id)
    
    bottling.batches = batches
    bottling.total_ml_used = batches.reduce((sum, b) => sum + parseFloat(b.ml_used), 0)
    
    res.json(bottling)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── CREATE BOTTLING ──────────────────────────────────────────────────────────
async function create(req, res) {
  try {
    const {
      bottling_code: providedCode,
      bottling_date,
      product_name,
      product_ref = '',
      volume_ml,
      quantity,
      bottle_supply_id = null,
      label_supply_id = null,
      batches = [],
      notes = '',
      type = 'normal'
    } = req.body
    const bottlingType = type === 'brinde' ? 'brinde' : 'normal'

    const bottling_code = providedCode && providedCode.trim() ? providedCode.trim() : await generateBottlingCode()
    const chorinhoPct = parseFloat(await getParam('chorinho_tolerance_pct', 5)) / 100

    // Validar se há lotes suficientes
    const totalMlNeeded = parseFloat(volume_ml) * parseInt(quantity)
    const totalMlProvided = batches.reduce((sum, b) => sum + parseFloat(b.ml_used), 0)
    const tolerance = totalMlNeeded * chorinhoPct
    if (totalMlProvided < totalMlNeeded || totalMlProvided > (totalMlNeeded + tolerance)) {
      return res.status(400).json({
        error: `ML total não confere. Necessário: ${totalMlNeeded}ml, Fornecido: ${totalMlProvided}ml (tolerância: +${tolerance.toFixed(2)}ml)`
      })
    }

    const result = await db.transaction(async (trx) => {
      // Verificar disponibilidade dos lotes
      for (const batchData of batches) {
        const batch = await trx('batches').where('id', parseInt(batchData.batch_id)).first()
        if (!batch) {
          throw new Error(`Lote ${batchData.batch_id} não encontrado`)
        }

        const mlRequested = parseFloat(batchData.ml_used)
        const mlAvailable = parseFloat(batch.remaining_ml)
        const tolerance = mlAvailable * chorinhoPct
        const maxAllowed = mlAvailable + tolerance
        
        // Verificar se excede o máximo permitido (com tolerância)
        if (mlRequested > maxAllowed) {
          throw new Error(
            `❌ ML insuficiente no lote ${batch.batch_code}.\n\n` +
            `📊 Disponível: ${mlAvailable.toFixed(2)}ml\n` +
            `📊 Solicitado: ${mlRequested.toFixed(2)}ml\n` +
            `📊 Máximo permitido (com chorinho): ${maxAllowed.toFixed(2)}ml\n` +
            `📊 Excesso: ${(mlRequested - maxAllowed).toFixed(2)}ml\n\n` +
            `💡 O sistema permite até 5% de tolerância para variações naturais de volume.`
          )
        }
        
        // Verificar se está usando o "chorinho"
        if (mlRequested > mlAvailable) {
          const chorinhoUsed = mlRequested - mlAvailable
          console.log(
            `🍷 CHORINHO DETECTADO no lote ${batch.batch_code}:\n` +
            `   Disponível: ${mlAvailable.toFixed(2)}ml\n` +
            `   Solicitado: ${mlRequested.toFixed(2)}ml\n` +
            `   Chorinho usado: ${chorinhoUsed.toFixed(2)}ml (${((chorinhoUsed/mlAvailable)*100).toFixed(1)}%)`
          )
        }
      }
      
      // Buscar custos dos insumos
      let bottleCost = 0
      let labelCost = 0
      
      if (bottle_supply_id) {
        const bottle = await trx('supplies').where('id', parseInt(bottle_supply_id)).first()
        if (bottle) {
          bottleCost = parseFloat(bottle.unit_cost) * parseInt(quantity)
        }
      }
      
      if (label_supply_id) {
        const label = await trx('supplies').where('id', parseInt(label_supply_id)).first()
        if (label) {
          labelCost = parseFloat(label.unit_cost) * parseInt(quantity)
        }
      }
      
      // Calcular custo do líquido
      let liquidCost = 0
      const batchCosts = []
      
      for (const batchData of batches) {
        const batch = await trx('batches').where('id', parseInt(batchData.batch_id)).first()
        const batchCost = parseFloat(batch.cost_per_ml) * parseFloat(batchData.ml_used)
        liquidCost += batchCost
        
        batchCosts.push({
          batch_id: parseInt(batchData.batch_id),
          ml_used: parseFloat(batchData.ml_used),
          proportional_cost: batchCost
        })
      }
      
      const totalCost = liquidCost + bottleCost + labelCost
      const unitCost = totalCost / parseInt(quantity)
      
      // Criar envase
      const [bottling] = await trx('bottlings').insert({
        bottling_code,
        bottling_date,
        product_name,
        product_ref,
        volume_ml: parseFloat(volume_ml),
        quantity: parseInt(quantity),
        bottle_supply_id: bottle_supply_id ? parseInt(bottle_supply_id) : null,
        label_supply_id: label_supply_id ? parseInt(label_supply_id) : null,
        liquid_cost: liquidCost,
        bottle_cost: bottleCost,
        label_cost: labelCost,
        total_cost: totalCost,
        unit_cost: unitCost,
        quantity_available: parseInt(quantity),
        notes,
        type: bottlingType,
        active: true
      }).returning('*')
      
      // Criar relacionamentos com lotes
      for (const batchCost of batchCosts) {
        await trx('bottling_batches').insert({
          bottling_id: bottling.id,
          ...batchCost
        })
      }
      
      // ═══════════════════════════════════════════════════════════════
      // 📦 BAIXAR ML DOS LOTES E REGISTRAR MOVIMENTAÇÕES
      // ═══════════════════════════════════════════════════════════════
      for (const batchData of batches) {
        const batch = await trx('batches').where('id', parseInt(batchData.batch_id)).first()
        const mlUsed = parseFloat(batchData.ml_used)
        const mlAvailable = parseFloat(batch.remaining_ml)
        
        // Calcular novo saldo (nunca negativo)
        const newRemainingMl = Math.max(0, mlAvailable - mlUsed)
        
        // Detectar uso de chorinho
        const chorinhoUsed = mlUsed > mlAvailable ? mlUsed - mlAvailable : 0
        const mlFromStock = Math.min(mlUsed, mlAvailable)
        
        // Atualizar lote
        await trx('batches')
          .where('id', parseInt(batchData.batch_id))
          .update({
            remaining_ml: newRemainingMl,
            status: newRemainingMl <= 0 && batch.status !== 'Em maceração' ? 'Finalizado' : batch.status,
            updated_at: trx.fn.now()
          })
        
        // Registrar movimentação padrão
        await trx('batch_movements').insert({
          batch_id: parseInt(batchData.batch_id),
          movement_type: 'bottling',
          quantity_ml: -mlFromStock, // Negativo = saída
          previous_ml: mlAvailable,
          current_ml: newRemainingMl,
          reference_id: bottling.id,
          reference_type: 'bottling',
          notes: `Envase ${bottling_code} - ${mlFromStock.toFixed(2)}ml utilizados do estoque`,
          operator: 'system'
        })
        
        // Se usou chorinho, registrar log adicional
        if (chorinhoUsed > 0) {
          await trx('batch_movements').insert({
            batch_id: parseInt(batchData.batch_id),
            movement_type: 'chorinho',
            quantity_ml: -chorinhoUsed, // Negativo = saída (virtual)
            previous_ml: 0,
            current_ml: 0,
            reference_id: bottling.id,
            reference_type: 'bottling',
            notes: `🍷 CHORINHO: ${chorinhoUsed.toFixed(2)}ml extras utilizados (${((chorinhoUsed/mlAvailable)*100).toFixed(1)}% de tolerância). Variação natural de volume.`,
            operator: 'system'
          })
          
          console.log(
            `✅ Chorinho registrado no lote ${batch.batch_code}:\n` +
            `   ML do estoque: ${mlFromStock.toFixed(2)}ml\n` +
            `   ML do chorinho: ${chorinhoUsed.toFixed(2)}ml\n` +
            `   Total usado: ${mlUsed.toFixed(2)}ml`
          )
        }
      }
      
      // Baixar insumos do estoque (frascos e rótulos)
      if (bottle_supply_id) {
        const bottleSupply = await trx('supplies').where('id', parseInt(bottle_supply_id)).first()
        if (!bottleSupply) throw new Error('Frasco não encontrado')
        if (parseFloat(bottleSupply.quantity_available) < parseInt(quantity)) {
          throw new Error(`Estoque insuficiente de frascos "${bottleSupply.name}". Disponível: ${bottleSupply.quantity_available} ${bottleSupply.unit}, solicitado: ${quantity}. Corrija o estoque na tela de Insumos se necessário.`)
        }
        await trx('supplies')
          .where('id', parseInt(bottle_supply_id))
          .decrement('quantity_available', parseInt(quantity))
        await trx.raw('UPDATE supplies SET is_open = false WHERE id = ? AND quantity_available <= 0', [parseInt(bottle_supply_id)])
      }

      if (label_supply_id) {
        const labelSupply = await trx('supplies').where('id', parseInt(label_supply_id)).first()
        if (!labelSupply) throw new Error('Rótulo não encontrado')
        if (parseFloat(labelSupply.quantity_available) < parseInt(quantity)) {
          throw new Error(`Estoque insuficiente de rótulos "${labelSupply.name}". Disponível: ${labelSupply.quantity_available} ${labelSupply.unit}, solicitado: ${quantity}. Corrija o estoque na tela de Insumos se necessário.`)
        }
        await trx('supplies')
          .where('id', parseInt(label_supply_id))
          .decrement('quantity_available', parseInt(quantity))
        await trx.raw('UPDATE supplies SET is_open = false WHERE id = ? AND quantity_available <= 0', [parseInt(label_supply_id)])
      }
      
      return bottling
    })
    
    res.status(201).json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// ─── UPDATE BOTTLING ──────────────────────────────────────────────────────────
async function update(req, res) {
  try {
    const bottling = await db('bottlings').where('id', parseInt(req.params.id)).first()
    if (!bottling) {
      return res.status(404).json({ error: 'Bottling not found' })
    }
    
    const updateData = { ...req.body }
    updateData.updated_at = db.fn.now()
    
    // Remover campos que não devem ser atualizados diretamente
    delete updateData.liquid_cost
    delete updateData.bottle_cost
    delete updateData.label_cost
    delete updateData.total_cost
    delete updateData.unit_cost
    
    const [updated] = await db('bottlings')
      .where('id', parseInt(req.params.id))
      .update(updateData)
      .returning('*')
    
    res.json(updated)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// ─── DELETE BOTTLING ──────────────────────────────────────────────────────────
async function remove(req, res) {
  try {
    const bottling = await db('bottlings').where('id', parseInt(req.params.id)).first()
    if (!bottling) {
      return res.status(404).json({ error: 'Bottling not found' })
    }

    // Bloquear se houver pedidos ATIVOS vinculados a este envase
    const activeLinked = await db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .where('oi.bottling_id', parseInt(req.params.id))
      .whereNotIn('o.status', ['Cancelled', 'Delivered'])
      .select('o.code', 'o.status')

    if (activeLinked.length > 0) {
      const list = activeLinked.map(o => `${o.code} (${o.status})`).join(', ')
      return res.status(409).json({
        error: `Envase não pode ser excluído pois está vinculado ao(s) pedido(s) ativo(s): ${list}. Desvincule os itens antes de excluir.`
      })
    }

    // Idem para brindes vinculados via order_gifts
    const giftLinked = await db('order_gifts as og')
      .join('orders as o', 'o.id', 'og.order_id')
      .where('og.bottling_id', parseInt(req.params.id))
      .select('o.code', 'o.status')

    if (giftLinked.length > 0) {
      const list = giftLinked.map(o => `${o.code} (${o.status})`).join(', ')
      return res.status(409).json({
        error: `Envase de brinde não pode ser excluído pois está vinculado ao(s) pedido(s): ${list}. Remova os brindes desses pedidos antes.`
      })
    }

    await db.transaction(async (trx) => {
      // Desvincula itens de pedidos já finalizados/cancelados para não deixar referências órfãs
      await trx('order_items').where('bottling_id', parseInt(req.params.id)).update({ bottling_id: null })
      // Buscar lotes utilizados para reverter
      const batchesUsed = await trx('bottling_batches').where('bottling_id', parseInt(req.params.id))
      
      // Reverter ML nos lotes
      for (const batchUsed of batchesUsed) {
        const batch = await trx('batches').where('id', batchUsed.batch_id).first()
        const newRemainingMl = parseFloat(batch.remaining_ml) + parseFloat(batchUsed.ml_used)
        
        await trx('batches')
          .where('id', batchUsed.batch_id)
          .update({
            remaining_ml: newRemainingMl,
            status: 'Pronto para envase', // Voltar para pronto para envase
            updated_at: trx.fn.now()
          })
        
        // Registrar movimentação de reversão
        await trx('batch_movements').insert({
          batch_id: batchUsed.batch_id,
          movement_type: 'bottling_reversal',
          quantity_ml: parseFloat(batchUsed.ml_used), // Positivo = entrada
          previous_ml: parseFloat(batch.remaining_ml),
          current_ml: newRemainingMl,
          reference_id: parseInt(req.params.id),
          reference_type: 'bottling',
          notes: `Reversão do envase ${bottling.bottling_code}`,
          operator: 'system'
        })
      }
      
      // Remover envase (CASCADE remove bottling_batches)
      await trx('bottlings').where('id', parseInt(req.params.id)).del()
    })
    
    res.json({ message: 'Bottling deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── BOTTLING STATS ───────────────────────────────────────────────────────────
async function stats(req, res) {
  try {
    const [totals] = await db('bottlings')
      .count('* as total_bottlings')
      .sum('quantity as total_units_produced')
      .sum('total_cost as total_bottling_cost')
      .first()
    
    const volumeStats = await db('bottlings')
      .select('volume_ml')
      .count('* as count')
      .sum('quantity as units')
      .groupBy('volume_ml')
      .orderBy('volume_ml', 'asc')
    
    const recentBottlings = await db('bottlings')
      .select('bottling_code', 'product_name', 'quantity', 'bottling_date')
      .orderBy('bottling_date', 'desc')
      .limit(5)
    
    res.json({
      total_bottlings: parseInt(totals.total_bottlings || 0),
      total_units_produced: parseInt(totals.total_units_produced || 0),
      total_bottling_cost: parseFloat(totals.total_bottling_cost || 0),
      average_cost_per_unit: totals.total_units_produced > 0 ? 
        parseFloat(totals.total_bottling_cost) / parseInt(totals.total_units_produced) : 0,
      by_volume: volumeStats,
      recent_bottlings: recentBottlings
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── GET AVAILABLE BATCHES ───────────────────────────────────────────────────
async function getAvailableBatches(req, res) {
  try {
    // Auto-atualizar lotes que completaram a maceração mas o status ainda não foi atualizado
    await db('batches')
      .where('status', 'Em maceração')
      .where('maceration_end', '<=', db.fn.now())
      .where('active', true)
      .update({ status: 'Pronto para envase', updated_at: db.fn.now() })

    // Retorna todos os lotes com ML disponível (exceto Finalizados)
    const batches = await db('batches as b')
      .join('formulas as f', 'f.id', 'b.formula_id')
      .leftJoin('products as p', 'p.id', 'b.product_id')
      .select(
        'b.id',
        'b.batch_code',
        'b.reduced_lot_number',
        'b.remaining_ml',
        'b.cost_per_ml',
        'b.production_date',
        'b.status',
        'b.maceration_end',
        'b.product_id',
        'f.name as formula_name',
        'p.project_name'
      )
      .whereNot('b.status', 'Finalizado')
      .where('b.remaining_ml', '>', 0)
      .where('b.active', true)
      .orderByRaw("CASE WHEN b.status = 'Pronto para envase' THEN 0 WHEN b.status = 'Em maceração' THEN 1 ELSE 2 END")
      .orderBy('b.production_date', 'asc')

    res.json(batches)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── GET BATCHES IN MACERATION ───────────────────────────────────────────────
// Lista lotes em maceração com progresso visual
async function getBatchesInMaceration(req, res) {
  try {
    const batches = await db('batches as b')
      .join('formulas as f', 'f.id', 'b.formula_id')
      .leftJoin('products as p', 'p.id', 'b.product_id')
      .select(
        'b.id',
        'b.batch_code',
        'b.production_date',
        'b.maceration_start',
        'b.maceration_end',
        'b.remaining_ml',
        'b.cost_per_ml',
        'b.status',
        'f.name as formula_name',
        'p.project_name',
        'p.commercial_name'
      )
      .where('b.status', 'Em maceração')
      .where('b.active', true)
      .orderBy('b.maceration_end', 'asc') // Ordenar por data de liberação
    
    // Calcular progresso para cada lote
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const batchesWithProgress = batches.map(batch => {
      const startDate = new Date(batch.maceration_start)
      startDate.setHours(0, 0, 0, 0)
      
      const endDate = new Date(batch.maceration_end)
      endDate.setHours(0, 0, 0, 0)
      
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
      const daysElapsed = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24))
      const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
      
      // Garantir que não fique negativo
      const safeDaysElapsed = Math.max(0, Math.min(daysElapsed, totalDays))
      const safeDaysRemaining = Math.max(0, daysRemaining)
      
      const progressPercentage = totalDays > 0 ? Math.round((safeDaysElapsed / totalDays) * 100) : 0
      const isReady = today >= endDate
      
      return {
        ...batch,
        maceration_progress: {
          total_days: totalDays,
          days_elapsed: safeDaysElapsed,
          days_remaining: safeDaysRemaining,
          progress_percentage: progressPercentage,
          is_ready: isReady,
          status_label: isReady ? '✅ Pronto para envase' : `⏳ ${safeDaysRemaining} dia(s) restante(s)`
        }
      }
    })
    
    // Separar em prontos e em andamento
    const ready = batchesWithProgress.filter(b => b.maceration_progress.is_ready)
    const inProgress = batchesWithProgress.filter(b => !b.maceration_progress.is_ready)
    
    res.json({
      total: batchesWithProgress.length,
      ready: ready.length,
      in_progress: inProgress.length,
      batches: batchesWithProgress,
      ready_batches: ready,
      in_progress_batches: inProgress
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── GET AVAILABLE GIFT BOTTLINGS ─────────────────────────────────────────────
// Lista envases do tipo brinde com saldo disponível para vincular em pedidos.
async function getAvailableGifts (req, res) {
  try {
    const rows = await db('bottlings')
      .where('type', 'brinde')
      .where('active', true)
      .where('quantity_available', '>', 0)
      .select(
        'id',
        'bottling_code',
        'product_name',
        'product_ref',
        'volume_ml',
        'quantity',
        'quantity_available',
        'unit_cost',
        'bottling_date'
      )
      .orderBy('product_name')
      .orderBy('volume_ml')
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── PRODUTO ACABADO POR VOLUME ───────────────────────────────────────────────
// Envases PRONTOS (produto acabado) de um produto, agrupados por volume — para o
// popup "ver por volume" no lançamento do pedido. Usa a MESMA junção do selo
// (products.sku = bottlings.product_ref, type='normal', ativo, quantity_available>0),
// então o total aqui bate com o "Produto acabado: N envases".
async function readyByVolume (req, res) {
  try {
    const productId = parseInt(req.query.product_id)
    if (!productId) return res.status(400).json({ error: 'product_id é obrigatório' })

    const rows = await db('products as p')
      .join('bottlings as b', 'b.product_ref', 'p.sku')
      .where('p.id', productId)
      .where('b.type', 'normal')
      .where('b.active', true)
      .where('b.quantity_available', '>', 0)
      .whereNotNull('p.sku').where('p.sku', '<>', '')
      .groupBy('b.volume_ml')
      .select('b.volume_ml')
      .sum('b.quantity_available as quantity')
      .count('b.id as lots')
      .orderBy('b.volume_ml', 'asc')

    const by_volume = rows.map(r => ({
      volume_ml: parseFloat(r.volume_ml),
      quantity:  parseInt(r.quantity) || 0,
      lots:      parseInt(r.lots) || 0,
    }))
    const total = by_volume.reduce((s, r) => s + r.quantity, 0)
    res.json({ product_id: productId, total, by_volume })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── GET ORDERS THAT CONSUMED A BOTTLING (Reverse Logistics) ──────────────────
// Retorna a lista de pedidos/clientes que consumiram um envase específico.
// Inclui vínculos legados via order_items.bottling_id e os novos via order_item_bottlings.
async function getOrdersConsumingBottling (req, res) {
  try {
    const bottlingId = parseInt(req.params.id)

    const bottling = await db('bottlings').where('id', bottlingId).first()
    if (!bottling) {
      return res.status(404).json({ error: 'Bottling not found' })
    }

    // Vínculos via junction table (item normal — atual)
    const fromJunction = await db('order_item_bottlings as oib')
      .join('order_items as oi', 'oi.id', 'oib.order_item_id')
      .join('orders as o', 'o.id', 'oi.order_id')
      .join('customers as c', 'c.id', 'o.customer_id')
      .where('oib.bottling_id', bottlingId)
      .select(
        'o.id as order_id',
        'o.code as order_code',
        'o.status as order_status',
        'o.created_at as order_date',
        'c.id as customer_id',
        'c.name as customer_name',
        'c.phone as customer_phone',
        'oi.id as order_item_id',
        'oi.product_name',
        'oi.product_ref',
        'oib.quantity as bottling_quantity',
        'oi.quantity as item_quantity',
        'oi.unit_price'
      )
      .orderBy('o.created_at', 'desc')

    // Vínculos legados (coluna order_items.bottling_id ainda existir)
    let fromLegacy = []
    const hasLegacyCol = await db.schema.hasColumn('order_items', 'bottling_id')
    if (hasLegacyCol) {
      fromLegacy = await db('order_items as oi')
        .join('orders as o', 'o.id', 'oi.order_id')
        .join('customers as c', 'c.id', 'o.customer_id')
        .where('oi.bottling_id', bottlingId)
        .whereNotExists(
          db('order_item_bottlings as oib')
            .whereRaw('oib.order_item_id = oi.id')
            .select(1)
        )
        .select(
          'o.id as order_id',
          'o.code as order_code',
          'o.status as order_status',
          'o.created_at as order_date',
          'c.id as customer_id',
          'c.name as customer_name',
          'c.phone as customer_phone',
          'oi.id as order_item_id',
          'oi.product_name',
          'oi.product_ref',
          'oi.quantity as bottling_quantity',
          'oi.quantity as item_quantity',
          'oi.unit_price'
        )
        .orderBy('o.created_at', 'desc')
    }

    // Vínculos como brinde (envase tipo brinde dado em pedido via order_gifts)
    let fromGifts = []
    const hasGiftsTable = await db.schema.hasTable('order_gifts')
    if (hasGiftsTable) {
      fromGifts = await db('order_gifts as og')
        .join('orders as o', 'o.id', 'og.order_id')
        .join('customers as c', 'c.id', 'o.customer_id')
        .where('og.bottling_id', bottlingId)
        .select(
          'o.id as order_id',
          'o.code as order_code',
          'o.status as order_status',
          'o.created_at as order_date',
          'c.id as customer_id',
          'c.name as customer_name',
          'c.phone as customer_phone',
          'og.id as order_gift_id',
          'og.quantity as bottling_quantity',
          'og.notes as gift_notes'
        )
        .orderBy('o.created_at', 'desc')
    }

    const tagged = [
      ...fromJunction.map(r => ({ ...r, link_type: 'item' })),
      ...fromLegacy.map(r  => ({ ...r, link_type: 'item' })),
      ...fromGifts.map(r   => ({ ...r, link_type: 'gift' })),
    ]
    const orders = tagged.sort((a, b) => new Date(b.order_date) - new Date(a.order_date))

    const totalConsumed = orders.reduce((sum, o) => sum + parseInt(o.bottling_quantity || 0), 0)

    res.json({
      bottling_id: bottlingId,
      bottling_code: bottling.bottling_code,
      total_produced: parseInt(bottling.quantity || 0),
      total_consumed: totalConsumed,
      total_available: parseInt(bottling.quantity_available || 0),
      orders
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── STOCK SUMMARY ────────────────────────────────────────────────────────────
async function stockSummary (req, res) {
  try {
    const rows = await db('bottlings')
      .where('active', true)
      .where('type', 'normal')
      .where('quantity_available', '>', 0)
      .select('product_name', 'volume_ml')
      .sum('quantity_available as total_available')
      .sum('quantity as total_produced')
      .sum(db.raw('unit_cost * quantity_available'))
      .avg('unit_cost as avg_unit_cost')
      .max('bottling_date as last_bottling')
      .groupBy('product_name', 'volume_ml')
      .orderBy('product_name')

    const mapped = rows.map(r => ({
      product_name:    r.product_name,
      volume_ml:       r.volume_ml,
      total_available: parseInt(r.total_available) || 0,
      total_produced:  parseInt(r.total_produced)  || 0,
      avg_unit_cost:   parseFloat(r.avg_unit_cost) || 0,
      total_value:     parseFloat(r['sum']) || 0,
      last_bottling:   r.last_bottling,
    }))

    res.json(mapped)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── VÍNCULO LOTE↔ENVASE (reconciliação histórica, SEM abate) ─────────────────
// Fase 2 do backfill: envases carregados em massa (03/07) só guardam product_ref
// (SKU do produto), não o lote. Para produtos com >1 lote é impossível adivinhar
// qual foi — o usuário escolhe na tela entre os lotes candidatos do MESMO produto.
// IMPORTANTE: NÃO abate remaining_ml. O estoque carregado já reflete o envase
// histórico; re-abater seria dupla contagem. Só o fluxo create() abate.

// GET /api/bottlings/:id/candidate-batches
// Lista os lotes do produto do envase (via products.sku = bottling.product_ref).
async function getCandidateBatches (req, res) {
  try {
    const bottling = await db('bottlings').where('id', parseInt(req.params.id)).first()
    if (!bottling) return res.status(404).json({ error: 'Envase não encontrado' })

    if (!bottling.product_ref) {
      return res.json({ product: null, reason: 'Envase sem SKU (product_ref) — defina o produto antes de vincular um lote.', suggested_ml: 0, candidates: [] })
    }

    const product = await db('products').where('sku', bottling.product_ref).first()
    if (!product) {
      return res.json({ product: null, reason: `Nenhum produto com SKU "${bottling.product_ref}".`, suggested_ml: 0, candidates: [] })
    }

    const linked = await db('bottling_batches').where('bottling_id', bottling.id).pluck('batch_id')

    const batches = await db('batches as b')
      .leftJoin('formulas as f', 'f.id', 'b.formula_id')
      .where('b.product_id', product.id)
      .select('b.id', 'b.batch_code', 'b.reduced_lot_number', 'b.production_date',
              'b.remaining_ml', 'b.quantity_ml', 'b.cost_per_ml', 'b.status', 'f.name as formula_name')
      .orderBy('b.production_date', 'asc')

    res.json({
      product: { id: product.id, sku: product.sku, commercial_name: product.commercial_name, project_name: product.project_name },
      suggested_ml: parseFloat(bottling.volume_ml) * parseInt(bottling.quantity),
      candidates: batches.map(b => ({ ...b, already_linked: linked.includes(b.id) }))
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// POST /api/bottlings/:id/candidate-batches  { batch_id, ml_used? }
// Vincula um lote ao envase. Comportamento depende da NATUREZA do envase:
//  • Envase REAL (criado via create(), que já moveu estoque — tem movimentação
//    'bottling') → o novo vínculo DEBITA os ml do lote (corrige o estoque quando o
//    usuário troca o lote de origem). Espelha exatamente a baixa do create().
//  • Envase HISTÓRICO (importado em massa, nunca moveu estoque — sem movimentação
//    'bottling') → vínculo NEUTRO (reconciliação): só registra o vínculo, não abate.
async function linkBatch (req, res) {
  try {
    const bottlingId = parseInt(req.params.id)
    const batchId = parseInt(req.body.batch_id)
    if (!batchId) return res.status(400).json({ error: 'batch_id é obrigatório' })

    const out = await db.transaction(async (trx) => {
      const bottling = await trx('bottlings').where('id', bottlingId).first()
      if (!bottling) { const e = new Error('Envase não encontrado'); e.status = 404; throw e }
      const batch = await trx('batches').where('id', batchId).first()
      if (!batch) { const e = new Error('Lote não encontrado'); e.status = 404; throw e }

      // Segurança: o lote precisa ser do mesmo produto do envase (candidato válido).
      const product = bottling.product_ref ? await trx('products').where('sku', bottling.product_ref).first() : null
      if (!product || batch.product_id !== product.id) {
        const e = new Error('Lote não pertence ao produto deste envase — vínculo recusado.'); e.status = 409; throw e
      }

      const existing = await trx('bottling_batches').where({ bottling_id: bottlingId, batch_id: batchId }).first()
      if (existing) { const e = new Error('Este lote já está vinculado a este envase.'); e.status = 409; throw e }

      const ml = req.body.ml_used != null ? parseFloat(req.body.ml_used) : parseFloat(bottling.volume_ml) * parseInt(bottling.quantity)
      const proportional_cost = parseFloat(batch.cost_per_ml || 0) * ml

      // Envase real = já existe uma baixa de estoque ('bottling') registrada para ele.
      const realMv = await trx('batch_movements')
        .where({ reference_type: 'bottling', reference_id: bottlingId, movement_type: 'bottling' })
        .first()
      const isReal = !!realMv

      let stock_moved = false
      if (isReal && ml > 0) {
        const chorinhoPct = parseFloat(await getParam('chorinho_tolerance_pct', 5)) / 100
        const mlAvailable = parseFloat(batch.remaining_ml)
        const maxAllowed = mlAvailable + mlAvailable * chorinhoPct
        if (ml > maxAllowed) {
          const e = new Error(
            `❌ ML insuficiente no lote ${batch.batch_code}. ` +
            `Disponível: ${mlAvailable.toFixed(2)}ml · Solicitado: ${ml.toFixed(2)}ml · ` +
            `Máx com chorinho (5%): ${maxAllowed.toFixed(2)}ml.`
          )
          e.status = 400; throw e
        }
        const mlFromStock = Math.min(ml, mlAvailable)
        const chorinhoUsed = ml > mlAvailable ? ml - mlAvailable : 0
        const newRemaining = Math.max(0, mlAvailable - ml)

        await trx('batches').where('id', batchId).update({
          remaining_ml: newRemaining,
          status: newRemaining <= 0 && batch.status !== 'Em maceração' ? 'Finalizado' : batch.status,
          updated_at: trx.fn.now()
        })
        await trx('batch_movements').insert({
          batch_id: batchId, movement_type: 'bottling', quantity_ml: -mlFromStock,
          previous_ml: mlAvailable, current_ml: newRemaining,
          reference_id: bottlingId, reference_type: 'bottling',
          notes: `Envase ${bottling.bottling_code} — vínculo de lote (${mlFromStock.toFixed(2)}ml debitados do estoque)`,
          operator: 'system'
        })
        if (chorinhoUsed > 0) {
          await trx('batch_movements').insert({
            batch_id: batchId, movement_type: 'chorinho', quantity_ml: -chorinhoUsed,
            previous_ml: 0, current_ml: 0, reference_id: bottlingId, reference_type: 'bottling',
            notes: `🍷 CHORINHO: ${chorinhoUsed.toFixed(2)}ml extras no vínculo do lote.`, operator: 'system'
          })
        }
        stock_moved = true
      }

      const [row] = await trx('bottling_batches')
        .insert({ bottling_id: bottlingId, batch_id: batchId, ml_used: ml, proportional_cost })
        .returning('*')

      return { row, batch, product, stock_moved }
    })

    // Devolve já com dados para a tela renderizar sem recarregar tudo.
    res.status(201).json({
      ...out.row, batch_code: out.batch.batch_code, cost_per_ml: out.batch.cost_per_ml,
      project_name: out.product.project_name, stock_moved: out.stock_moved
    })
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message })
  }
}

// DELETE /api/bottlings/:id/candidate-batches/:batchId
// Desfaz o vínculo. Se este par (envase↔lote) tirou estoque de verdade (soma das
// movimentações 'bottling'/'bottling_reversal' negativa), DEVOLVE exatamente esse
// saldo ao lote e registra a reversão. Vínculo histórico neutro → soma 0 → no-op.
async function unlinkBatch (req, res) {
  try {
    const bottlingId = parseInt(req.params.id)
    const batchId = parseInt(req.params.batchId)

    const out = await db.transaction(async (trx) => {
      const link = await trx('bottling_batches').where({ bottling_id: bottlingId, batch_id: batchId }).first()
      if (!link) { const e = new Error('Vínculo não encontrado'); e.status = 404; throw e }

      // Impacto líquido de estoque deste par (chorinho é virtual → excluído).
      const agg = await trx('batch_movements')
        .where({ reference_type: 'bottling', reference_id: bottlingId, batch_id: batchId })
        .whereIn('movement_type', ['bottling', 'bottling_reversal'])
        .sum({ net: 'quantity_ml' })
      const net = parseFloat((agg[0] && agg[0].net) || 0) // negativo se debitou
      const restore = net < 0 ? -net : 0

      await trx('bottling_batches').where({ bottling_id: bottlingId, batch_id: batchId }).del()

      let restored = 0
      if (restore > 0) {
        const batch = await trx('batches').where('id', batchId).first()
        const prev = parseFloat(batch.remaining_ml)
        // respeita a constraint remaining_ml <= quantity_ml
        const capped = Math.min(prev + restore, parseFloat(batch.quantity_ml))
        const applied = capped - prev
        if (applied !== 0) {
          await trx('batches').where('id', batchId).update({
            remaining_ml: capped,
            status: batch.status === 'Finalizado' && capped > 0 ? 'Pronto para envase' : batch.status,
            updated_at: trx.fn.now()
          })
          await trx('batch_movements').insert({
            batch_id: batchId, movement_type: 'bottling_reversal', quantity_ml: applied,
            previous_ml: prev, current_ml: capped, reference_id: bottlingId, reference_type: 'bottling',
            notes: `Reversão do vínculo do envase #${bottlingId} — ${applied.toFixed(2)}ml devolvidos ao lote`,
            operator: 'system'
          })
          restored = applied
        }
      }
      return { restored }
    })

    res.json({ ok: true, restored_ml: out.restored })
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message })
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  stats,
  getAvailableBatches,
  getBatchesInMaceration,
  stockSummary,
  getOrdersConsumingBottling,
  getAvailableGifts,
  readyByVolume,
  getCandidateBatches,
  linkBatch,
  unlinkBatch
}