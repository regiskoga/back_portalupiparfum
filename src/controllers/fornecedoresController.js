const { db } = require('../models/db')

// ─── LIST ─────────────────────────────────────────────────────────────────────
async function list (req, res) {
  try {
    const { busca } = req.query

    let query = db('suppliers as s')
      .leftJoin('supplies as sp', 'sp.supplier_id', 's.id')
      .select('s.*')
      .count('sp.id as total_supplies')
      .groupBy('s.id')
      .orderBy('s.name', 'asc')

    if (busca) {
      query = query.where(function() {
        this.where('s.name', 'like', `%${busca}%`)
          .orWhere('s.tax_id', 'like', `%${busca}%`)
          .orWhere('s.contact', 'like', `%${busca}%`)
      })
    }

    const suppliers = await query
    res.json(suppliers)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── GET ONE ──────────────────────────────────────────────────────────────────
async function getOne (req, res) {
  try {
    const supplier = await db('suppliers as s')
      .leftJoin('supplies as sp', 'sp.supplier_id', 's.id')
      .select('s.*')
      .count('sp.id as total_supplies')
      .where('s.id', parseInt(req.params.id))
      .groupBy('s.id')
      .first()

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' })
    }

    res.json(supplier)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
async function create (req, res) {
  try {
    const { name, tax_id = '', contact = '', email = '', phone = '', address = '', notes = '', type = '' } = req.body

    const [id] = await db('suppliers').insert({
      name,
      tax_id,
      contact,
      email,
      phone,
      address,
      notes,
      type
    }).returning('*')

    const supplier = await db('suppliers').where({ id }).first()
    res.status(201).json(supplier)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
async function update (req, res) {
  try {
    const supplier = await db('suppliers').where({ id: parseInt(req.params.id) }).first()
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' })
    }

    const { name, tax_id, contact, email, phone, address, notes, type } = req.body

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (tax_id !== undefined) updateData.tax_id = tax_id
    if (contact !== undefined) updateData.contact = contact
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (notes !== undefined) updateData.notes = notes
    if (type !== undefined) updateData.type = type
    updateData.updated_at = db.fn.now()

    await db('suppliers').where({ id: parseInt(req.params.id) }).update(updateData)

    const updated = await db('suppliers').where({ id: parseInt(req.params.id) }).first()
    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
async function remove (req, res) {
  try {
    const supplier = await db('suppliers').where({ id: parseInt(req.params.id) }).first()
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' })
    }

    await db('suppliers').where({ id: parseInt(req.params.id) }).del()
    res.json({ message: 'Supplier removed' })
  } catch (e) {
    if (e.code === '23503') { // Foreign key violation
      res.status(400).json({ error: 'Supplier has linked supplies and cannot be removed' })
    } else {
      res.status(400).json({ error: e.message })
    }
  }
}

module.exports = { list, getOne, create, update, remove }
