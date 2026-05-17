/**
 * Orders Controller
 * Gerencia pedidos com motor de decisão automática
 */

const { db } = require('../models/db')
const orderDecisionEngine = require('../services/orderDecisionEngine')
const activityLogger = require('../services/activityLogger')

// ─── VERIFICAÇÃO DE BRINDE DUPLICADO (PROMPT #3) ──────────────────────────────
async function checkGiftDuplication(customer_id, gift_name) {
  try {
    const existingGifts = await db('customer_gifts')
      .where('customer_id', customer_id)
      .where('gift_name', 'ilike', `%${gift_name}%`)
      .orderBy('given_at', 'desc')
      .limit(1)
    
    if (existingGifts.length > 0) {
      const lastGift = existingGifts[0]
      const daysSince = Math.floor((new Date() - new Date(lastGift.given_at)) / (1000 * 60 * 60 * 24))
      
      return {
        isDuplicate: true,
        warning: `⚠️ ATENÇÃO: Cliente já recebeu "${gift_name}" há ${daysSince} dias`,
        lastGiven: lastGift.given_at,
        daysSince
      }
    }
    
    return { isDuplicate: false }
  } catch (error) {
    console.error('❌ Erro ao verificar brinde duplicado:', error)
    return { isDuplicate: false, error: error.message }
  }
}

/**
 * Lista todos os pedidos com paginação
 */
exports.list = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const offset = (page - 1) * limit

    const { status, customer_id } = req.query

    let query = db('orders')
      .leftJoin('customers', 'orders.customer_id', 'customers.id')
      .select(
        'orders.*',
        'customers.name as customer_name',
        'customers.email as customer_email'
      )

    if (status) {
      query = query.where('orders.status', status)
    }

    if (customer_id) {
      query = query.where('orders.customer_id', customer_id)
    }

    const orders = await query
      .orderBy('orders.created_at', 'desc')
      .limit(limit)
      .offset(offset)

    const [{ total }] = await db('orders').count('* as total')

    res.json({
      data: orders,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error listing orders:', error)
    res.status(500).json({ error: 'Failed to list orders' })
  }
}

/**
 * Busca um pedido por ID com itens
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params

    const order = await db('orders')
      .leftJoin('customers', 'orders.customer_id', 'customers.id')
      .leftJoin('coupons', 'orders.coupon_id', 'coupons.id')
      .where('orders.id', id)
      .select(
        'orders.*',
        'customers.name as customer_name',
        'customers.email as customer_email',
        'customers.phone as customer_phone',
        'coupons.code as coupon_code',
        'coupons.description as coupon_description'
      )
      .first()

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Buscar itens do pedido
    const items = await db('order_items')
      .leftJoin('products', 'order_items.product_id', 'products.id')
      .where('order_items.order_id', id)
      .select(
        'order_items.*',
        'products.project_name',
        'products.commercial_name as product_commercial_name',
        'products.inspiration_brand',
        'products.inspiration_name'
      )

    order.items = items

    res.json(order)
  } catch (error) {
    console.error('Error getting order:', error)
    res.status(500).json({ error: 'Failed to get order' })
  }
}

/**
 * Cria um novo pedido com motor de decisão automática
 */
exports.create = async (req, res) => {
  const trx = await db.transaction()

  try {
    const {
      customer_id,
      items,
      discount = 0,
      shipping = 0,
      notes = '',
      channel = '',
      coupon_code = null
    } = req.body

    // Validações básicas
    if (!customer_id || !items || items.length === 0) {
      await trx.rollback()
      return res.status(400).json({ 
        error: 'customer_id and items are required' 
      })
    }

    // Verificar cupom se fornecido
    let coupon = null
    let couponDiscount = 0

    if (coupon_code) {
      coupon = await trx('coupons')
        .where({ code: coupon_code, active: true })
        .where('valid_from', '<=', trx.fn.now())
        .where(function() {
          this.whereNull('valid_until').orWhere('valid_until', '>=', trx.fn.now())
        })
        .first()

      if (!coupon) {
        await trx.rollback()
        return res.status(400).json({ error: 'Invalid or expired coupon' })
      }

      // Verificar limite de usos
      if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
        await trx.rollback()
        return res.status(400).json({ error: 'Coupon usage limit reached' })
      }
    }

    // Criar pedido
    const [order] = await trx('orders')
      .insert({
        customer_id,
        code: `ORD-${Date.now()}`,
        status: 'Pending',
        channel,
        discount,
        shipping,
        notes,
        coupon_id: coupon?.id || null
      })
      .returning('*')

    // Processar cada item com o motor de decisão
    const processedItems = []

    for (const item of items) {
      const { product_id, volume_ml, quantity, unit_price } = item

      // Executar motor de decisão
      const decision = await orderDecisionEngine.executeDecision({
        product_id,
        volume_ml,
        quantity
      })

      // Criar item do pedido
      const [orderItem] = await trx('order_items')
        .insert({
          order_id: order.id,
          product_id,
          product_name: item.product_name || '',
          product_ref: item.product_ref || '',
          volume_ml,
          quantity,
          unit_price,
          decision_status: decision.status,
          estimated_days: decision.estimatedDays,
          decision_notes: decision.notes
        })
        .returning('*')

      // Criar ordens automáticas
      const automaticOrders = await orderDecisionEngine.createAutomaticOrders(
        order.id,
        orderItem.id,
        decision.actions
      )

      processedItems.push({
        ...orderItem,
        decision,
        automaticOrders
      })
    }

    // Calcular prazo do pedido (maior prazo entre os itens)
    const deadline = orderDecisionEngine.calculateOrderDeadline(processedItems)

    // Calcular desconto do cupom
    if (coupon) {
      const subtotal = processedItems.reduce(
        (sum, item) => sum + (item.unit_price * item.quantity),
        0
      )

      switch (coupon.type) {
        case 'Percentage':
          couponDiscount = (subtotal * coupon.discount_value) / 100
          break
        case 'Fixed Amount':
          couponDiscount = coupon.discount_value
          break
        case 'Progressive':
          // Implementar lógica progressiva se necessário
          couponDiscount = (subtotal * coupon.discount_value) / 100
          break
        case 'Buy X Get Y':
          // Implementar lógica de "leve X pague Y"
          const totalItems = processedItems.reduce((sum, item) => sum + item.quantity, 0)
          if (totalItems >= coupon.min_items) {
            const freeItems = Math.floor(totalItems / coupon.min_items) * coupon.free_items
            const avgPrice = subtotal / totalItems
            couponDiscount = freeItems * avgPrice
          }
          break
      }

      // Atualizar uso do cupom
      await trx('coupons')
        .where({ id: coupon.id })
        .increment('current_uses', 1)
    }

    // Atualizar pedido com prazo e desconto do cupom
    await trx('orders')
      .where({ id: order.id })
      .update({
        estimated_days: deadline.estimatedDays,
        estimated_delivery: deadline.estimatedDelivery,
        coupon_discount: couponDiscount
      })

    // Log da atividade
    await activityLogger.log(trx, {
      type: 'order_created',
      entity_type: 'order',
      entity_id: order.id,
      description: `Pedido ${order.code} criado com ${processedItems.length} item(ns)`,
      metadata: {
        customer_id,
        total_items: processedItems.length,
        estimated_days: deadline.estimatedDays
      }
    })

    await trx.commit()

    res.status(201).json({
      order: {
        ...order,
        estimated_days: deadline.estimatedDays,
        estimated_delivery: deadline.estimatedDelivery,
        coupon_discount: couponDiscount
      },
      items: processedItems
    })
  } catch (error) {
    await trx.rollback()
    console.error('Error creating order:', error)
    res.status(500).json({ error: 'Failed to create order' })
  }
}

/**
 * Verifica brindes duplicados antes de criar pedido (PROMPT #3)
 */
exports.checkGifts = async (req, res) => {
  try {
    const { customer_id, gifts } = req.body
    
    if (!customer_id || !gifts || !Array.isArray(gifts)) {
      return res.status(400).json({ 
        error: 'customer_id e gifts (array) são obrigatórios' 
      })
    }
    
    const giftChecks = []
    
    for (const giftName of gifts) {
      const check = await checkGiftDuplication(customer_id, giftName)
      giftChecks.push({
        gift_name: giftName,
        ...check
      })
    }
    
    const duplicates = giftChecks.filter(check => check.isDuplicate)
    
    res.json({
      customer_id,
      total_gifts_checked: gifts.length,
      duplicates_found: duplicates.length,
      has_duplicates: duplicates.length > 0,
      checks: giftChecks,
      warnings: duplicates.map(dup => dup.warning)
    })
    
  } catch (error) {
    console.error('❌ Erro ao verificar brindes:', error)
    res.status(500).json({ error: error.message })
  }
}

/**
 * Atualiza status do pedido
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['Pending', 'Confirmed', 'In Production', 'Ready', 'Shipped', 'Delivered', 'Cancelled']
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const [order] = await db('orders')
      .where({ id })
      .update({ status, updated_at: db.fn.now() })
      .returning('*')

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Log da atividade
    await activityLogger.log(db, {
      type: 'order_status_updated',
      entity_type: 'order',
      entity_id: id,
      description: `Status do pedido alterado para: ${status}`,
      metadata: { new_status: status }
    })

    res.json(order)
  } catch (error) {
    console.error('Error updating order status:', error)
    res.status(500).json({ error: 'Failed to update order status' })
  }
}

/**
 * Busca ordens automáticas de um pedido
 */
exports.getAutomaticOrders = async (req, res) => {
  try {
    const { id } = req.params

    const productionOrders = await db('production_orders')
      .leftJoin('formulas', 'production_orders.formula_id', 'formulas.id')
      .leftJoin('products', 'formulas.product_id', 'products.id')
      .where('production_orders.order_id', id)
      .select(
        'production_orders.*',
        'products.name as product_name'
      )

    const bottlingOrders = await db('bottling_orders')
      .leftJoin('products', 'bottling_orders.product_id', 'products.id')
      .leftJoin('batches', 'bottling_orders.batch_id', 'batches.id')
      .where('bottling_orders.order_id', id)
      .select(
        'bottling_orders.*',
        'products.name as product_name',
        'batches.code as batch_code'
      )

    const purchaseOrders = await db('purchase_orders')
      .leftJoin('supplies', 'purchase_orders.supply_id', 'supplies.id')
      .leftJoin('suppliers', 'purchase_orders.supplier_id', 'suppliers.id')
      .where('purchase_orders.order_id', id)
      .select(
        'purchase_orders.*',
        'supplies.name as supply_name',
        'suppliers.name as supplier_name'
      )

    res.json({
      production_orders: productionOrders,
      bottling_orders: bottlingOrders,
      purchase_orders: purchaseOrders
    })
  } catch (error) {
    console.error('Error getting automatic orders:', error)
    res.status(500).json({ error: 'Failed to get automatic orders' })
  }
}

/**
 * Aplica kit a um pedido
 */
exports.applyKit = async (req, res) => {
  try {
    const { order_id, kit_id } = req.body

    const kit = await db('kits')
      .where({ id: kit_id, active: true })
      .first()

    if (!kit) {
      return res.status(404).json({ error: 'Kit not found or inactive' })
    }

    // Atualizar pedido
    const [order] = await db('orders')
      .where({ id: order_id })
      .update({
        is_kit: true,
        kit_id: kit.id,
        discount: kit.discount_percentage,
        updated_at: db.fn.now()
      })
      .returning('*')

    res.json({ order, kit })
  } catch (error) {
    console.error('Error applying kit:', error)
    res.status(500).json({ error: 'Failed to apply kit' })
  }
}

module.exports = exports
