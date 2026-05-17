const { db } = require('../models/db')

async function list(req, res) {
  try {
    const { packaging_type_id, active } = req.query

    let query = db('volume_discounts as vd')
      .leftJoin('packaging_types as pt', 'pt.id', 'vd.packaging_type_id')
      .select(
        'vd.*',
        'pt.name as packaging_type_name',
        'pt.volume_ml as packaging_volume_ml'
      )
      .orderBy('vd.packaging_type_id', 'asc')
      .orderBy('vd.min_quantity', 'asc')

    if (packaging_type_id) query = query.where('vd.packaging_type_id', parseInt(packaging_type_id))
    if (active !== undefined) query = query.where('vd.active', active === 'true')

    const rows = await query
    res.json(rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

async function create(req, res) {
  try {
    const { packaging_type_id, min_quantity, discount_percentage, active = true } = req.body

    if (!min_quantity || !discount_percentage) {
      return res.status(400).json({ error: 'min_quantity e discount_percentage são obrigatórios' })
    }

    if (discount_percentage <= 0 || discount_percentage > 100) {
      return res.status(400).json({ error: 'discount_percentage deve ser entre 0 e 100' })
    }

    const [row] = await db('volume_discounts').insert({
      packaging_type_id: packaging_type_id || null,
      min_quantity:       parseInt(min_quantity),
      discount_percentage: parseFloat(discount_percentage),
      active,
    }).returning('*')

    res.status(201).json(row)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

async function update(req, res) {
  try {
    const { id } = req.params
    const existing = await db('volume_discounts').where('id', id).first()
    if (!existing) return res.status(404).json({ error: 'Regra não encontrada' })

    const updateData = { ...req.body, updated_at: db.fn.now() }
    const [row] = await db('volume_discounts').where('id', id).update(updateData).returning('*')
    res.json(row)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params
    const existing = await db('volume_discounts').where('id', id).first()
    if (!existing) return res.status(404).json({ error: 'Regra não encontrada' })

    await db('volume_discounts').where('id', id).del()
    res.json({ message: 'Regra removida' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Resolve o desconto aplicável para um tipo de embalagem + quantidade
async function resolve(req, res) {
  try {
    const { packaging_type_id, quantity } = req.query

    if (!quantity) return res.status(400).json({ error: 'quantity é obrigatório' })

    const qty = parseInt(quantity)

    let best = null

    // Regra específica para o tipo de embalagem (prioridade)
    if (packaging_type_id) {
      best = await db('volume_discounts')
        .where('active', true)
        .where('packaging_type_id', parseInt(packaging_type_id))
        .where('min_quantity', '<=', qty)
        .orderBy('min_quantity', 'desc')
        .first()
    }

    // Se não encontrou regra específica, tenta regra global (packaging_type_id NULL)
    if (!best) {
      best = await db('volume_discounts')
        .where('active', true)
        .whereNull('packaging_type_id')
        .where('min_quantity', '<=', qty)
        .orderBy('min_quantity', 'desc')
        .first()
    }

    res.json(best || null)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports = { list, create, update, remove, resolve }
