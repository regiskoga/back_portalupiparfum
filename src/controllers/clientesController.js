const { db } = require('../models/db')

// ─── helpers ──────────────────────────────────────────────────────────────────
async function customerWithStats (id) {
  const customer = await db('customers as c')
    .leftJoin('orders as o', 'o.customer_id', 'c.id')
    .select('c.*')
    .count('o.id as total_orders')
    .max('o.created_at as last_order')
    .where('c.id', id)
    .groupBy('c.id')
    .first()

  if (!customer) return null

  // Calculate total_spent with subquery
  const { total_spent } = await db('orders as o')
    .leftJoin('order_items as oi', 'oi.order_id', 'o.id')
    .where('o.customer_id', id)
    .whereNot('o.status', 'Cancelled')
    .select(
      db.raw('COALESCE(SUM(oi.quantity * oi.unit_price), 0) - COALESCE(SUM(o.discount), 0) + COALESCE(SUM(o.shipping), 0) as total_spent')
    )
    .first()

  customer.total_spent = total_spent || 0

  return customer
}

// ─── LIST ─────────────────────────────────────────────────────────────────────
async function list (req, res) {
  try {
    const { busca, page = 1, limit = 20, ordem = 'name', dir = 'ASC' } = req.query

    const offset = (Math.max(1, Number(page)) - 1) * Number(limit)

    // Build base query
    let query = db('customers as c')
      .leftJoin('orders as o', 'o.customer_id', 'c.id')
      .select('c.*')
      .count('o.id as total_orders')
      .max('o.created_at as last_order')
      .groupBy('c.id')

    // Apply search filter
    if (busca) {
      query = query.where(function() {
        this.where('c.name', 'like', `%${busca}%`)
          .orWhere('c.tax_id', 'like', `%${busca}%`)
          .orWhere('c.email', 'like', `%${busca}%`)
          .orWhere('c.phone', 'like', `%${busca}%`)
      })
    }

    // Count total
    const countQuery = db('customers as c')
    if (busca) {
      countQuery.where(function() {
        this.where('c.name', 'like', `%${busca}%`)
          .orWhere('c.tax_id', 'like', `%${busca}%`)
          .orWhere('c.email', 'like', `%${busca}%`)
          .orWhere('c.phone', 'like', `%${busca}%`)
      })
    }
    const [{ total }] = await countQuery.count('* as total')

    // Apply ordering
    const orderMap = { 
      name: 'c.name', 
      created_at: 'c.created_at'
    }
    const orderCol = orderMap[ordem] || 'c.name'
    const orderDir = dir === 'DESC' ? 'desc' : 'asc'

    const rows = await query
      .orderBy(orderCol, orderDir)
      .limit(Number(limit))
      .offset(offset)

    // Calculate total_spent for each customer (simplified - could be optimized)
    for (const row of rows) {
      const { total_spent } = await db('orders as o')
        .leftJoin('order_items as oi', 'oi.order_id', 'o.id')
        .where('o.customer_id', row.id)
        .whereNot('o.status', 'Cancelled')
        .select(
          db.raw('COALESCE(SUM(oi.quantity * oi.unit_price), 0) - COALESCE(SUM(o.discount), 0) + COALESCE(SUM(o.shipping), 0) as total_spent')
        )
        .first()
      row.total_spent = total_spent || 0
    }

    res.json({ data: rows, total: Number(total), page: Number(page), limit: Number(limit) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── GET ONE ──────────────────────────────────────────────────────────────────
async function getOne (req, res) {
  try {
    const customer = await customerWithStats(req.params.id)
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }
    res.json(customer)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
async function create (req, res) {
  try {
    const { name, tax_id = '', phone = '', email = '', address = '', city = '', state = '', zip_code = '', notes = '' } = req.body

    const [result] = await db('customers').insert({
      name,
      tax_id,
      phone,
      email,
      address,
      city,
      state,
      zip_code,
      notes
    }).returning('*')

    const customer = await customerWithStats(result.id)
    res.status(201).json(customer)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
async function update (req, res) {
  try {
    const customer = await db('customers').where({ id: parseInt(req.params.id) }).first()
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const { name, tax_id, phone, email, address, city, state, zip_code, notes } = req.body

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (tax_id !== undefined) updateData.tax_id = tax_id
    if (phone !== undefined) updateData.phone = phone
    if (email !== undefined) updateData.email = email
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (state !== undefined) updateData.state = state
    if (zip_code !== undefined) updateData.zip_code = zip_code
    if (notes !== undefined) updateData.notes = notes
    updateData.updated_at = db.fn.now()

    await db('customers').where({ id: parseInt(req.params.id) }).update(updateData)

    const updated = await customerWithStats(req.params.id)
    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
async function remove (req, res) {
  try {
    const customer = await db('customers').where({ id: parseInt(req.params.id) }).first()
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // occurrences.order_id tem RESTRICT — precisa deletar antes do cascade de orders
    const orderIds = await db('orders').where({ customer_id: parseInt(req.params.id) }).pluck('id')
    if (orderIds.length > 0) {
      await db('occurrences').whereIn('order_id', orderIds).del()
    }

    await db('customers').where({ id: parseInt(req.params.id) }).del()
    res.json({ message: 'Customer removed' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── STATS ────────────────────────────────────────────────────────────────────
async function stats (req, res) {
  try {
    const totals = await db('customers as c')
      .leftJoin('orders as o', 'o.customer_id', 'c.id')
      .countDistinct('c.id as total_customers')
      .countDistinct('o.id as total_orders')
      .first()

    const { total_revenue } = await db('orders as o')
      .leftJoin('order_items as oi', 'oi.order_id', 'o.id')
      .whereNot('o.status', 'Cancelled')
      .select(
        db.raw('COALESCE(SUM(oi.quantity * oi.unit_price), 0) - COALESCE(SUM(o.discount), 0) + COALESCE(SUM(o.shipping), 0) as total_revenue')
      )
      .first()

    totals.total_revenue = total_revenue || 0

    const byStatus = await db('orders')
      .select('status')
      .count('* as qty')
      .groupBy('status')
      .orderBy('qty', 'desc')

    res.json({ totals, byStatus })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

async function completeOrder (orderId) {
  const order = await db('orders as o')
    .join('customers as c', 'c.id', 'o.customer_id')
    .select('o.*', 'c.name as customer_name')
    .where('o.id', orderId)
    .first()

  if (!order) return null

  // Get subtotal
  const { subtotal } = await db('order_items')
    .where({ order_id: orderId })
    .select(db.raw('COALESCE(SUM(quantity * unit_price), 0) as subtotal'))
    .first()

  order.subtotal = subtotal || 0

  // Get items
  order.items = await db('order_items')
    .where({ order_id: orderId })
    .orderBy('id', 'asc')

  order.total = order.subtotal - order.discount + order.shipping

  return order
}

// ─── LIST orders for a customer ───────────────────────────────────────────────
async function listOrders (req, res) {
  try {
    const customer = await db('customers').where({ id: parseInt(req.params.id) }).first()
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const orders = await db('orders as o')
      .where('o.customer_id', parseInt(req.params.id))
      .select('o.*')
      .orderBy('o.created_at', 'desc')

    // Calculate subtotal and qty_items for each order
    for (const order of orders) {
      const { subtotal, qty_items } = await db('order_items')
        .where({ order_id: order.id })
        .select(
          db.raw('COALESCE(SUM(quantity * unit_price), 0) as subtotal'),
          db.raw('COUNT(*) as qty_items')
        )
        .first()

      order.subtotal = subtotal || 0
      order.qty_items = qty_items || 0
      order.total = order.subtotal - order.discount + order.shipping
    }

    res.json(orders)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── GET ONE order ───────────────────────────────────────────────────────────
async function getOrder (req, res) {
  try {
    const order = await completeOrder(req.params.orderId)
    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }
    res.json(order)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── CREATE order ────────────────────────────────────────────────────────────
async function createOrder (req, res) {
  try {
    const customer = await db('customers').where({ id: parseInt(req.params.id) }).first()
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    const {
      code = '',
      status = 'Pending',
      channel = '',
      discount = 0,
      shipping = 0,
      notes = '',
      items = [],
    } = req.body

    if (!items.length) {
      return res.status(400).json({ error: 'Order must have at least one item' })
    }

    // Use transaction
    const orderId = await db.transaction(async (trx) => {
      const [order] = await trx('orders').insert({
        customer_id: req.params.id,
        code,
        status,
        channel,
        discount: Number(discount),
        shipping: Number(shipping),
        notes
      }).returning('*')

      // Insert items
      const itemsData = items.map(item => ({
        order_id: order.id,
        product_name: item.product_name,
        product_ref: item.product_ref || '',
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price)
      }))

      await trx('order_items').insert(itemsData)

      return order.id
    })

    const order = await completeOrder(orderId)
    res.status(201).json(order)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── UPDATE order ────────────────────────────────────────────────────────────
async function updateOrder (req, res) {
  try {
    const order = await db('orders')
      .where({ id: req.params.orderId, customer_id: req.params.id })
      .first()

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    const { code, status, channel, discount, shipping, notes, items } = req.body

    await db.transaction(async (trx) => {
      // Update order
      const updateData = {}
      if (code !== undefined) updateData.code = code
      if (status !== undefined) updateData.status = status
      if (channel !== undefined) updateData.channel = channel
      if (discount !== undefined) updateData.discount = Number(discount)
      if (shipping !== undefined) updateData.shipping = Number(shipping)
      if (notes !== undefined) updateData.notes = notes
      updateData.updated_at = db.fn.now()

      await trx('orders').where({ id: req.params.orderId }).update(updateData)

      // If items were sent, replace all
      if (items && items.length) {
        await trx('order_items').where({ order_id: req.params.orderId }).del()

        const itemsData = items.map(item => ({
          order_id: req.params.orderId,
          product_name: item.product_name,
          product_ref: item.product_ref || '',
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price)
        }))

        await trx('order_items').insert(itemsData)
      }
    })

    const updated = await completeOrder(req.params.orderId)
    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── DELETE order ────────────────────────────────────────────────────────────
async function deleteOrder (req, res) {
  try {
    const order = await db('orders')
      .where({ id: req.params.orderId, customer_id: req.params.id })
      .first()

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    await db('orders').where({ id: req.params.orderId }).del()
    res.json({ message: 'Order removed' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

module.exports = {
  list, getOne, create, update, remove, stats,
  listOrders, getOrder, createOrder, updateOrder, deleteOrder,
}
