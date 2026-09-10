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
    if (req.query.is_open !== undefined) {
      const isOpen = req.query.is_open === 'true'
      query = query.where('s.is_open', isOpen)
      if (isOpen) query = query.where('s.quantity_available', '>', 0)
    }
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
    if (req.body.quantity_available !== undefined) {
      const newQty = Math.max(0, Number(req.body.quantity_available))
      updateData.quantity_available = newQty
      if (newQty <= 0) updateData.is_open = false
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

// ─── CONSUMPTION HISTORY ──────────────────────────────────────────────────────
async function getConsumption (req, res) {
  try {
    const id = parseInt(req.params.id)

    const supply = await db('supplies')
      .where({ id })
      .select('id', 'name', 'unit', 'quantity_purchased', 'quantity_available')
      .first()
    if (!supply) return res.status(404).json({ error: 'Supply not found' })

    const history = await db('batch_essences as be')
      .join('batches as b', 'b.id', 'be.batch_id')
      .leftJoin('formulas as f', 'f.id', 'b.formula_id')
      .leftJoin('products as p', 'p.id', 'f.product_id')
      .where('be.supply_id', id)
      .select(
        'be.id',
        'be.quantity',
        'be.unit',
        'be.essence_code',
        'be.supplier_lot_ref',
        'be.created_at',
        'b.id as batch_id',
        'b.batch_code',
        'b.production_date',
        'b.status as batch_status',
        'f.name as formula_name',
        'p.commercial_name as product_name'
      )
      .orderBy('be.created_at', 'desc')

    const total_consumed = history.reduce((s, r) => s + parseFloat(r.quantity || 0), 0)

    res.json({ supply, total_consumed, history })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── RESUMO DE ESSÊNCIAS ──────────────────────────────────────────────────────
// Tela-resumo "tenho ou não tenho": uma linha por marca + essência +
// laboratório, com comprado / utilizado / disponível em ml.
//
// Cada registro de `supplies` é uma COMPRA (mesma essência comprada 2x = 2
// linhas), por isso o agrupamento. Marca e essência vivem dentro do nome, no
// padrão "Marca Insp.: X - Inspiração: Y" — existem as duas grafias no banco
// ("Inspiração" e "Inpiração"), o parse cobre as duas.
//
// utilizado = comprado − disponível: inclui o que foi para lote, perdas e
// ajustes manuais, então a conta sempre fecha com o saldo.
const { parseEssenceName } = require('../services/essenceName')

async function essencesSummary (req, res) {
  try {
    const rows = await db('supplies as s')
      .leftJoin('suppliers as sp', 'sp.id', 's.supplier_id')
      .where('s.type', 'Essence')
      .select(
        's.id', 's.name', 's.unit', 's.supplier_id',
        's.quantity_purchased', 's.quantity_available',
        's.unit_cost', 's.purchase_date', 's.is_open',
        'sp.name as lab'
      )

    const map = new Map()
    for (const r of rows) {
      const { brand, essence } = parseEssenceName(r.name)
      const key = `${brand.toLowerCase()}||${essence.toLowerCase()}||${r.supplier_id || 0}`

      let g = map.get(key)
      if (!g) {
        g = {
          brand:         brand || '—',
          essence,
          supplier_id:   r.supplier_id || null,
          lab:           r.lab || '—',
          unit:          r.unit || 'ml',
          purchased_ml:  0,
          available_ml:  0,
          used_ml:       0,
          total_paid:    0,
          purchases:     0,
          last_purchase: null,
          supply_ids:    [],
        }
        map.set(key, g)
      }

      const purchased = parseFloat(r.quantity_purchased || 0)
      const available = parseFloat(r.quantity_available || 0)
      g.purchased_ml += purchased
      g.available_ml += available
      g.total_paid   += parseFloat(r.unit_cost || 0) * purchased
      g.purchases    += 1
      g.supply_ids.push(r.id)
      if (r.purchase_date && (!g.last_purchase || new Date(r.purchase_date) > new Date(g.last_purchase))) {
        g.last_purchase = r.purchase_date
      }
    }

    const data = [...map.values()].map(g => ({
      ...g,
      used_ml:       Math.max(0, g.purchased_ml - g.available_ml),
      avg_unit_cost: g.purchased_ml > 0 ? g.total_paid / g.purchased_ml : null,
    })).sort((a, b) =>
      a.brand.localeCompare(b.brand, 'pt-BR', { sensitivity: 'base' }) ||
      a.essence.localeCompare(b.essence, 'pt-BR', { sensitivity: 'base' })
    )

    res.json({
      data,
      totals: {
        linhas:       data.length,
        compras:      rows.length,
        purchased_ml: data.reduce((s, g) => s + g.purchased_ml, 0),
        available_ml: data.reduce((s, g) => s + g.available_ml, 0),
        used_ml:      data.reduce((s, g) => s + g.used_ml, 0),
        sem_saldo:    data.filter(g => g.available_ml <= 0).length,
      },
    })
  } catch (e) {
    console.error('Error building essences summary:', e)
    res.status(500).json({ error: e.message })
  }
}

module.exports = { list, getOne, create, update, remove, stats, toggleOpen, getConsumption, essencesSummary }
