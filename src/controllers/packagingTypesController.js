const { db } = require('../models/db')
const ActivityLogger = require('../services/activityLogger')

async function list (req, res) {
  try {
    const { active, search } = req.query

    let query = db('packaging_types').orderBy('volume_ml', 'asc').orderBy('name', 'asc')

    if (active !== undefined) {
      query = query.where('active', active === 'true')
    }
    if (search) {
      query = query.where(function () {
        this.where('name', 'ilike', `%${search}%`)
          .orWhere('format', 'ilike', `%${search}%`)
      })
    }

    const rows = await query
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function getOne (req, res) {
  try {
    const row = await db('packaging_types').where('id', parseInt(req.params.id)).first()
    if (!row) return res.status(404).json({ error: 'Tipo de embalagem não encontrado' })
    res.json(row)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function create (req, res) {
  try {
    const { name, volume_ml, format, suggested_price, active = true } = req.body
    const [row] = await db('packaging_types')
      .insert({ name: name.trim(), volume_ml: parseFloat(volume_ml), format: format?.trim() || null, suggested_price: suggested_price != null ? parseFloat(suggested_price) : null, active })
      .returning('*')
    await ActivityLogger.logCreate('packaging_type', row.id, row.name, row)
    res.status(201).json(row)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

async function update (req, res) {
  try {
    const id = parseInt(req.params.id)
    const existing = await db('packaging_types').where('id', id).first()
    if (!existing) return res.status(404).json({ error: 'Tipo de embalagem não encontrado' })

    const fields = {}
    if (req.body.name       !== undefined) fields.name            = req.body.name.trim()
    if (req.body.volume_ml  !== undefined) fields.volume_ml       = parseFloat(req.body.volume_ml)
    if (req.body.format     !== undefined) fields.format          = req.body.format?.trim() || null
    if (req.body.suggested_price !== undefined) fields.suggested_price = req.body.suggested_price != null ? parseFloat(req.body.suggested_price) : null
    if (req.body.active     !== undefined) fields.active          = req.body.active
    fields.updated_at = db.fn.now()

    const [row] = await db('packaging_types').where('id', id).update(fields).returning('*')
    res.json(row)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

async function remove (req, res) {
  try {
    const id = parseInt(req.params.id)
    const row = await db('packaging_types').where('id', id).first()
    if (!row) return res.status(404).json({ error: 'Tipo de embalagem não encontrado' })
    await db('packaging_types').where('id', id).del()
    res.json({ message: 'Removido com sucesso' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

module.exports = { list, getOne, create, update, remove }
