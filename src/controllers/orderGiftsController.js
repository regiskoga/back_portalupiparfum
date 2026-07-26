const { db } = require('../models/db')
const events = require('../services/events')

// ─── LIST GIFTS OF AN ORDER ───────────────────────────────────────────────────
async function list (req, res) {
  try {
    const orderId = parseInt(req.params.order_id)
    const gifts = await db('order_gifts as og')
      .join('bottlings as b', 'b.id', 'og.bottling_id')
      .where('og.order_id', orderId)
      .select(
        'og.id',
        'og.order_id',
        'og.bottling_id',
        'og.quantity',
        'og.notes',
        'og.created_at',
        'b.bottling_code',
        'b.product_name',
        'b.product_ref',
        'b.volume_ml',
        'b.unit_cost'
      )
      .orderBy('og.created_at', 'asc')
    res.json(gifts)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── ADD GIFT TO AN ORDER ─────────────────────────────────────────────────────
// Decrementa bottlings.quantity_available em transação.
async function create (req, res) {
  try {
    const orderId = parseInt(req.params.order_id)
    const { bottling_id, quantity = 1, notes = '' } = req.body || {}
    const qty = parseInt(quantity)

    if (!bottling_id || !Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({ error: 'bottling_id e quantity (>=1) são obrigatórios' })
    }

    const result = await db.transaction(async (trx) => {
      const order = await trx('orders').where('id', orderId).first()
      if (!order) throw new Error('Pedido não encontrado')

      const bottling = await trx('bottlings').where('id', parseInt(bottling_id)).first()
      if (!bottling) throw new Error('Envase não encontrado')
      if (bottling.type !== 'brinde') throw new Error('Envase selecionado não é do tipo brinde')
      if (!bottling.active) throw new Error('Envase inativo')

      const available = parseInt(bottling.quantity_available || 0)
      if (available < qty) {
        throw new Error(`Saldo insuficiente: ${available} brinde(s) disponível(is) de ${bottling.bottling_code}`)
      }

      await trx('bottlings')
        .where('id', bottling.id)
        .decrement('quantity_available', qty)

      const [gift] = await trx('order_gifts')
        .insert({
          order_id: orderId,
          bottling_id: bottling.id,
          quantity: qty,
          notes
        })
        .returning('*')

      return gift
    })

    events.broadcast('orders-changed', { id: orderId, action: 'gift-added' })
    res.status(201).json(result)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── REMOVE GIFT FROM AN ORDER ────────────────────────────────────────────────
async function remove (req, res) {
  try {
    const orderId = parseInt(req.params.order_id)
    const giftId  = parseInt(req.params.gift_id)

    await db.transaction(async (trx) => {
      const gift = await trx('order_gifts')
        .where({ id: giftId, order_id: orderId })
        .first()
      if (!gift) throw new Error('Brinde não encontrado neste pedido')

      const order = await trx('orders').where('id', orderId).first()

      // Restaura saldo do envase — MAS não se o pedido já está Cancelado: nesse
      // caso o updateStatus já devolveu o estoque dos brindes ao cancelar;
      // creditar de novo aqui causaria dupla restauração.
      if (!order || order.status !== 'Cancelled') {
        await trx('bottlings')
          .where('id', gift.bottling_id)
          .increment('quantity_available', gift.quantity)
      }

      await trx('order_gifts').where('id', giftId).del()
    })

    events.broadcast('orders-changed', { id: orderId, action: 'gift-removed' })
    res.json({ message: 'Brinde removido' })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

module.exports = { list, create, remove }
