const { db } = require('../models/db')

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

    // Count total
    const countQuery = query.clone().clearSelect().clearOrder().count('* as total')
    const [{ total }] = await countQuery

    // Apply ordering and pagination
    const orderMap = { 
      created_at: 's.created_at', 
      name: 's.name', 
      type: 's.type', 
      unit_cost: 's.unit_cost' 
    }
    const orderCol = orderMap[ordem] || 's.created_at'
    const orderDir = dir === 'ASC' ? 'asc' : 'desc'

    const rows = await query
      .orderBy(orderCol, orderDir)
      .limit(Number(limit))
      .offset(offset)

    res.json({ 
      data: rows, 
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

    res.json(supply)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
async function create (req, res) {
  console.log('🔍 CREATE - Iniciando...')
  try {
    const { name, type, supplier_id, unit, quantity_purchased, total_amount_paid, batch = '', notes = '' } = req.body
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
      notes
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

    const { name, type, supplier_id, unit, quantity_purchased, total_amount_paid, batch, notes } = req.body

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
    if (quantity_purchased !== undefined) updateData.quantity_purchased = Number(quantity_purchased)
    if (total_amount_paid !== undefined) updateData.total_amount_paid = Number(total_amount_paid)
    if (batch !== undefined) updateData.batch = batch
    if (notes !== undefined) updateData.notes = notes
    updateData.updated_at = db.fn.now()

    await db('supplies').where({ id: parseInt(req.params.id) }).update(updateData)

    const updated = await db('supplies as s')
      .join('suppliers as sp', 'sp.id', 's.supplier_id')
      .select('s.*', 'sp.name as supplier_name')
      .where('s.id', parseInt(req.params.id))
      .first()

    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
async function remove (req, res) {
  try {
    const supply = await db('supplies').where({ id: parseInt(req.params.id) }).first()
    if (!supply) {
      return res.status(404).json({ error: 'Supply not found' })
    }

    await db('supplies').where({ id: parseInt(req.params.id) }).del()
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

module.exports = { list, getOne, create, update, remove, stats }
