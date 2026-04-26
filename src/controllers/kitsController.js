/**
 * Kits Controller
 * Gerencia kits de produtos (ex: Kit 3x15ml, Kit 2x30ml)
 */

const db = require('../models/db')

/**
 * Lista todos os kits
 */
exports.list = async (req, res) => {
  try {
    const { active } = req.query

    let query = db('kits').select('*')

    if (active !== undefined) {
      query = query.where('active', active === 'true')
    }

    const kits = await query.orderBy('name', 'asc')

    res.json({ data: kits })
  } catch (error) {
    console.error('Error listing kits:', error)
    res.status(500).json({ error: 'Failed to list kits' })
  }
}

/**
 * Busca um kit por ID
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params

    const kit = await db('kits')
      .where({ id })
      .first()

    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' })
    }

    res.json(kit)
  } catch (error) {
    console.error('Error getting kit:', error)
    res.status(500).json({ error: 'Failed to get kit' })
  }
}

/**
 * Cria um novo kit
 */
exports.create = async (req, res) => {
  try {
    const {
      name,
      description = '',
      quantity,
      volume_ml,
      discount_percentage = 0,
      active = true
    } = req.body

    const [kit] = await db('kits')
      .insert({
        name,
        description,
        quantity,
        volume_ml,
        discount_percentage,
        active
      })
      .returning('*')

    res.status(201).json(kit)
  } catch (error) {
    console.error('Error creating kit:', error)
    res.status(500).json({ error: 'Failed to create kit' })
  }
}

/**
 * Atualiza um kit
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      description,
      quantity,
      volume_ml,
      discount_percentage,
      active
    } = req.body

    const [kit] = await db('kits')
      .where({ id })
      .update({
        name,
        description,
        quantity,
        volume_ml,
        discount_percentage,
        active,
        updated_at: db.fn.now()
      })
      .returning('*')

    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' })
    }

    res.json(kit)
  } catch (error) {
    console.error('Error updating kit:', error)
    res.status(500).json({ error: 'Failed to update kit' })
  }
}

/**
 * Deleta um kit
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params

    const deleted = await db('kits')
      .where({ id })
      .delete()

    if (!deleted) {
      return res.status(404).json({ error: 'Kit not found' })
    }

    res.json({ message: 'Kit deleted successfully' })
  } catch (error) {
    console.error('Error deleting kit:', error)
    res.status(500).json({ error: 'Failed to delete kit' })
  }
}

/**
 * Calcula preço do kit
 */
exports.calculatePrice = async (req, res) => {
  try {
    const { kit_id, product_id, base_price } = req.body

    const kit = await db('kits')
      .where({ id: kit_id, active: true })
      .first()

    if (!kit) {
      return res.status(404).json({ error: 'Kit not found or inactive' })
    }

    const totalPrice = base_price * kit.quantity
    const discount = (totalPrice * kit.discount_percentage) / 100
    const finalPrice = totalPrice - discount

    res.json({
      kit,
      base_price,
      total_price: totalPrice,
      discount,
      final_price: finalPrice,
      savings: discount
    })
  } catch (error) {
    console.error('Error calculating kit price:', error)
    res.status(500).json({ error: 'Failed to calculate kit price' })
  }
}

module.exports = exports
