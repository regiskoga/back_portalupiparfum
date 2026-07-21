const { db } = require('../models/db')
const ActivityLogger = require('../services/activityLogger')

async function list (req, res) {
  try {
    const { active, search } = req.query

    let query = db('freight_types').orderBy('name', 'asc')

    if (active !== undefined) {
      query = query.where('active', active === 'true')
    }
    if (search) {
      query = query.where('name', 'ilike', `%${search}%`)
    }

    const rows = await query
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function getOne (req, res) {
  try {
    const row = await db('freight_types').where('id', parseInt(req.params.id)).first()
    if (!row) return res.status(404).json({ error: 'Tipo de frete não encontrado' })
    res.json(row)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function create (req, res) {
  try {
    const { name, active = true } = req.body
    const [row] = await db('freight_types')
      .insert({ name: name.trim(), active })
      .returning('*')
    await ActivityLogger.logCreate('freight_type', row.id, row.name, row)
    res.status(201).json(row)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

async function update (req, res) {
  try {
    const id = parseInt(req.params.id)
    const existing = await db('freight_types').where('id', id).first()
    if (!existing) return res.status(404).json({ error: 'Tipo de frete não encontrado' })

    const fields = {}
    if (req.body.name   !== undefined) fields.name   = req.body.name.trim()
    if (req.body.active !== undefined) fields.active = req.body.active
    fields.updated_at = db.fn.now()

    const [row] = await db('freight_types').where('id', id).update(fields).returning('*')
    res.json(row)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

async function remove (req, res) {
  try {
    const id = parseInt(req.params.id)
    const row = await db('freight_types').where('id', id).first()
    if (!row) return res.status(404).json({ error: 'Tipo de frete não encontrado' })
    await db('freight_types').where('id', id).del()
    res.json({ message: 'Removido com sucesso' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

module.exports = { list, getOne, create, update, remove }
