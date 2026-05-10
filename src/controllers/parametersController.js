const { db } = require('../models/db')

async function getAll (req, res) {
  try {
    const rows = await db('parameters').select('*').orderBy('key')
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function update (req, res) {
  try {
    const updates = req.body // { key: value, ... }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Body deve ser { key: value }' })
    }

    await db.transaction(async trx => {
      for (const [key, value] of Object.entries(updates)) {
        await trx('parameters')
          .where('key', key)
          .update({ value: String(value), updated_at: trx.fn.now() })
      }
    })

    const rows = await db('parameters').select('*').orderBy('key')
    res.json(rows)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

module.exports = { getAll, update }
