const { db } = require('../models/db')

function classify (row) {
  const today = new Date().toISOString().slice(0, 10)
  if (row.valid_from > today) return 'FUTURO'
  if (row.valid_to && row.valid_to < today) return 'EXPIRADO'
  return 'VIGENTE'
}

// ─── LIST ─────────────────────────────────────────────────────────────────────
async function list (req, res) {
  try {
    const { product_id, status, busca } = req.query

    let query = db('price_lists as pl')
      .join('products as p', 'p.id', 'pl.product_id')
      .leftJoin('packaging_types as pt', 'pt.id', 'pl.packaging_type_id')
      .select('pl.*', 'p.project_name', 'p.commercial_name', 'pt.name as packaging_type_name')
      .orderBy('p.project_name', 'asc')
      .orderBy('pl.volume_ml', 'asc')
      .orderBy('pl.valid_from', 'desc')

    if (product_id) query = query.where('pl.product_id', parseInt(product_id))

    if (busca) {
      query = query.where(function () {
        this.where('p.project_name', 'ilike', `%${busca}%`)
          .orWhere('p.commercial_name', 'ilike', `%${busca}%`)
      })
    }

    const rows = await query
    const today = new Date().toISOString().slice(0, 10)

    let data = rows.map(r => ({ ...r, status: classify(r) }))

    if (status) data = data.filter(r => r.status === status)

    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
async function create (req, res) {
  try {
    const { product_id, packaging_type_id = null, volume_ml, price, valid_from, valid_to = null, notes = '' } = req.body

    const product = await db('products').where('id', parseInt(product_id)).first()
    if (!product) return res.status(400).json({ error: 'Projeto não encontrado' })

    let resolvedVolume = parseFloat(volume_ml)
    const resolvedPtId = packaging_type_id ? parseInt(packaging_type_id) : null

    if (resolvedPtId && !volume_ml) {
      const pt = await db('packaging_types').where('id', resolvedPtId).first()
      if (pt) resolvedVolume = parseFloat(pt.volume_ml)
    }

    const [row] = await db('price_lists').insert({
      product_id: parseInt(product_id),
      packaging_type_id: resolvedPtId,
      volume_ml: resolvedVolume,
      price: parseFloat(price),
      valid_from,
      valid_to: valid_to || null,
      notes
    }).returning('*')

    const full = await db('price_lists as pl')
      .join('products as p', 'p.id', 'pl.product_id')
      .leftJoin('packaging_types as pt', 'pt.id', 'pl.packaging_type_id')
      .select('pl.*', 'p.project_name', 'p.commercial_name', 'pt.name as packaging_type_name')
      .where('pl.id', row.id)
      .first()

    res.status(201).json({ ...full, status: classify(full) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
async function update (req, res) {
  try {
    const existing = await db('price_lists').where('id', parseInt(req.params.id)).first()
    if (!existing) return res.status(404).json({ error: 'Preço não encontrado' })

    const { volume_ml, packaging_type_id, price, valid_from, valid_to, notes } = req.body
    const updateData = { updated_at: db.fn.now() }
    if (volume_ml         !== undefined) updateData.volume_ml         = parseFloat(volume_ml)
    if (packaging_type_id !== undefined) updateData.packaging_type_id = packaging_type_id ? parseInt(packaging_type_id) : null
    if (price             !== undefined) updateData.price             = parseFloat(price)
    if (valid_from        !== undefined) updateData.valid_from        = valid_from
    if (valid_to          !== undefined) updateData.valid_to          = valid_to || null
    if (notes             !== undefined) updateData.notes             = notes

    await db('price_lists').where('id', parseInt(req.params.id)).update(updateData)

    const full = await db('price_lists as pl')
      .join('products as p', 'p.id', 'pl.product_id')
      .leftJoin('packaging_types as pt', 'pt.id', 'pl.packaging_type_id')
      .select('pl.*', 'p.project_name', 'p.commercial_name', 'pt.name as packaging_type_name')
      .where('pl.id', parseInt(req.params.id))
      .first()

    res.json({ ...full, status: classify(full) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
async function remove (req, res) {
  try {
    const existing = await db('price_lists').where('id', parseInt(req.params.id)).first()
    if (!existing) return res.status(404).json({ error: 'Preço não encontrado' })
    await db('price_lists').where('id', parseInt(req.params.id)).del()
    res.json({ message: 'Preço removido' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

module.exports = { list, create, update, remove }
