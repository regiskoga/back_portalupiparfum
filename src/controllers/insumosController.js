const { db } = require('../models/db')

function classifyPurchase (row) {
  if (row.ideal_unit_price == null || Number(row.ideal_unit_price) === 0) return 'SEM_REFERENCIA'
  return Number(row.unit_cost) <= Number(row.ideal_unit_price) ? 'BOA' : 'NAO_BOA'
}

// ─── LIST ─────────────────────────────────────────────────────────────────────
async function list (req, res) {
  try {
    const { type, supplier_id, busca, ordem = 'created_at', dir = 'DESC', page = 1, limit = 20 } = req.query

    const offset = (Math.max(1, Number(page)) - 1) * Number(limit)

    // Build query
    let query = db('supplies as s')
      .join('suppliers as sp', 'sp.id', 's.supplier_id')
      .select('s.*', 'sp.name as supplier_name')

    // Apply filters
    if (type) query = query.where('s.type', type)
    if (supplier_id) query = query.where('s.supplier_id', Number(supplier_id))
    if (busca) query = query.where('s.name', 'like', `%${busca}%`)
    if (req.query.receipt_status) query = query.where('s.receipt_status', req.query.receipt_status)
    if (req.query.is_open !== undefined) query = query.where('s.is_open', req.query.is_open === 'true')
    if (req.query.is_formula_ingredient !== undefined) query = query.where('s.is_formula_ingredient', req.query.is_formula_ingredient === 'true')

    // Count total
    const countQuery = query.clone().clearSelect().clearOrder().count('* as total')
    const [{ total }] = await countQuery

    // Apply ordering and pagination
    const orderMap = {
      created_at: 's.created_at',
      name: 's.name',
      type: 's.type',
      unit_cost: 's.unit_cost',
      purchase_date: 's.purchase_date',
    }
    const orderCol = orderMap[ordem] || 's.created_at'
    const orderDir = dir === 'ASC' ? 'asc' : 'desc'

    const rows = await query
      .orderBy(orderCol, orderDir)
      .limit(Number(limit))
      .offset(offset)

    const data = rows.map(r => ({ ...r, purchase_classification: classifyPurchase(r) }))

    res.json({
      data,
      total: Number(total),
      page: Number(page),
      limit: Number(limit)
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── GET ONE ──────────────────────────────────────────────────────────────────
async function getOne (req, res) {
  try {
    const supply = await db('supplies')
      .where('id', parseInt(req.params.id))
      .first()

    if (!supply) {
      return res.status(404).json({ error: 'Supply not found' })
    }

    res.json({ ...supply, purchase_classification: classifyPurchase(supply) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
async function create (req, res) {
  console.log('🔍 CREATE - Iniciando...')
  try {
    const { name, type, supplier_id, unit, quantity_purchased, total_amount_paid, batch = '', notes = '', ideal_unit_price, purchase_date } = req.body
    console.log('🔍 CREATE - Dados recebidos:', { name, type, supplier_id })

    // Verify supplier exists
    console.log('🔍 CREATE - Verificando fornecedor...')
    const supplier = await db('suppliers').where({ id: parseInt(supplier_id) }).first()
    if (!supplier) {
      console.log('❌ CREATE - Fornecedor não encontrado')
      return res.status(400).json({ error: 'Supplier not found' })
    }
    console.log('✅ CREATE - Fornecedor encontrado:', supplier.name)

    // Insert and return simple response
    console.log('🔍 CREATE - Inserindo no banco...')
    const insertData = {
      name,
      type,
      supplier_id: parseInt(supplier_id),
      unit,
      quantity_purchased: Number(quantity_purchased),
      total_amount_paid: Number(total_amount_paid),
      batch,
      notes,
      ideal_unit_price: ideal_unit_price != null && ideal_unit_price !== '' ? Number(ideal_unit_price) : null,
      purchase_date: purchase_date || new Date().toISOString().slice(0, 10),
      receipt_status: req.body.receipt_status || 'Recebido',
      bottle_type: req.body.bottle_type || '',
      quantity_available: Number(quantity_purchased),
      is_formula_ingredient: ['Essence', 'Base', 'Chemical'].includes(type) || req.body.is_formula_ingredient === true || req.body.is_formula_ingredient === 'true',
    }

    const result = await db('supplies').insert(insertData).returning('*')
    const created = Array.isArray(result) ? result[0] : result
    console.log('✅ CREATE - Inserido com sucesso:', created.id)

    console.log('🔍 CREATE - Enviando resposta...')
    res.status(201).json(created)
    console.log('✅ CREATE - Resposta enviada')
  } catch (e) {
    console.error('❌ CREATE - Erro:', e.message)
    res.status(400).json({ error: e.message })
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
async function update (req, res) {
  try {
    const supply = await db('supplies').where({ id: parseInt(req.params.id) }).first()
    if (!supply) {
      return res.status(404).json({ error: 'Supply not found' })
    }

    const { name, type, supplier_id, unit, quantity_purchased, total_amount_paid, batch, notes, ideal_unit_price, purchase_date } = req.body

    // Verify supplier exists if changing
    if (supplier_id) {
      const supplier = await db('suppliers').where({ id: supplier_id }).first()
      if (!supplier) {
        return res.status(400).json({ error: 'Supplier not found' })
      }
    }

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (type !== undefined) updateData.type = type
    if (supplier_id !== undefined) updateData.supplier_id = Number(supplier_id)
    if (unit !== undefined) updateData.unit = unit
    if (quantity_purchased !== undefined) {
      const delta = Number(quantity_purchased) - Number(supply.quantity_purchased)
      updateData.quantity_purchased = Number(quantity_purchased)
      updateData.quantity_available = Math.max(0, Number(supply.quantity_available) + delta)
    }
    if (total_amount_paid !== undefined) updateData.total_amount_paid = Number(total_amount_paid)
    if (batch !== undefined) updateData.batch = batch
    if (notes !== undefined) updateData.notes = notes
    if (ideal_unit_price !== undefined) updateData.ideal_unit_price = ideal_unit_price !== null && ideal_unit_price !== '' ? Number(ideal_unit_price) : null
    if (purchase_date !== undefined) updateData.purchase_date = purchase_date || null
    if (req.body.receipt_status !== undefined) updateData.receipt_status = req.body.receipt_status
    if (req.body.bottle_type    !== undefined) updateData.bottle_type    = req.body.bottle_type
    const updatedType = req.body.type || (await db('supplies').where({ id: parseInt(req.params.id) }).first())?.type
    updateData.is_formula_ingredient = ['Essence', 'Base', 'Chemical'].includes(updatedType) || req.body.is_formula_ingredient === true || req.body.is_formula_ingredient === 'true'
    updateData.updated_at = db.fn.now()

    await db('supplies').where({ id: parseInt(req.params.id) }).update(updateData)

    const updated = await db('supplies as s')
      .join('suppliers as sp', 'sp.id', 's.supplier_id')
      .select('s.*', 'sp.name as supplier_name')
      .where('s.id', parseInt(req.params.id))
      .first()

    res.json({ ...updated, purchase_classification: classifyPurchase(updated) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
async function remove (req, res) {
  try {
    const id = parseInt(req.params.id)
    const supply = await db('supplies').where({ id }).first()
    if (!supply) {
      return res.status(404).json({ error: 'Supply not found' })
    }

    const usedInFormulas = await db('formula_items').where({ supply_id: id }).count('* as total').first()
    if (parseInt(usedInFormulas.total) > 0) {
      return res.status(409).json({
        error: `Insumo não pode ser excluído pois está sendo usado em ${usedInFormulas.total} fórmula(s). Remova-o das fórmulas antes de excluí-lo.`
      })
    }

    const purchaseOrderCount = await db('purchase_orders').where({ supply_id: id }).count('* as total').first()
    if (parseInt(purchaseOrderCount.total) > 0) {
      return res.status(409).json({
        error: `Insumo não pode ser excluído pois está vinculado a ${purchaseOrderCount.total} ordem(ns) de compra.`
      })
    }

    const batchEssenceCount = await db('batch_essences').where({ supply_id: id }).count('* as total').first()
    if (parseInt(batchEssenceCount.total) > 0) {
      return res.status(409).json({
        error: `Insumo não pode ser excluído pois está vinculado a ${batchEssenceCount.total} lote(s) de produção. Exclua os lotes antes de excluí-lo.`
      })
    }

    await db('supplies').where({ id }).del()
    res.json({ message: 'Supply removed successfully' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── STATS ────────────────────────────────────────────────────────────────────
async function stats (req, res) {
  try {
    const totals = await db('supplies')
      .count('* as total_records')
      .countDistinct('name as total_supplies')
      .sum('total_amount_paid as total_investment')
      .avg('unit_cost as average_cost')
      .first()

    const byType = await db('supplies')
      .select('type')
      .count('* as qty')
      .sum('total_amount_paid as value')
      .groupBy('type')
      .orderBy('value', 'desc')

    res.json({ totals, byType })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── TOGGLE OPEN/CLOSED ───────────────────────────────────────────────────────
async function toggleOpen (req, res) {
  try {
    const supply = await db('supplies').where({ id: parseInt(req.params.id) }).first()
    if (!supply) return res.status(404).json({ error: 'Insumo não encontrado' })

    const [updated] = await db('supplies')
      .where({ id: parseInt(req.params.id) })
      .update({ is_open: !supply.is_open, updated_at: db.fn.now() })
      .returning('*')

    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

module.exports = { list, getOne, create, update, remove, stats, toggleOpen }
