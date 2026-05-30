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
      const { product_id, volume_ml, quantity, unit_price, item_discount = 0 } = item

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
          item_discount: parseFloat(item_discount) || 0,
          decision_status: decision.status,
          estimated_days: decision.estimatedDays,
          decision_notes: decision.notes
        })
        .returning('*')

      // Criar ordens automáticas (dentro da mesma trx para o FK order_id funcionar)
      const automaticOrders = await orderDecisionEngine.createAutomaticOrders(
        order.id,
        orderItem.id,
        decision.actions,
        trx
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

      // Gap #4: validar valor mínimo do pedido
      const minOrderValue = parseFloat(coupon.min_order_value || 0)
      if (minOrderValue > 0 && subtotal < minOrderValue) {
        await trx.rollback()
        return res.status(400).json({ error: `Valor mínimo do pedido para este cupom: R$ ${minOrderValue.toFixed(2)}` })
      }

      switch (coupon.type) {
        case 'Percentage':
          couponDiscount = (subtotal * coupon.discount_value) / 100
          break
        case 'Fixed Amount':
          couponDiscount = parseFloat(coupon.discount_value)
          break
        case 'Progressive': {
          // Aplica desconto somente sobre a parte que excede o valor mínimo
          const excessAmount = Math.max(0, subtotal - minOrderValue)
          couponDiscount = (excessAmount * coupon.discount_value) / 100
          break
        }
        case 'Buy X Get Y': {
          // Implementar lógica de "leve X pague Y"
          const totalItems = processedItems.reduce((sum, item) => sum + item.quantity, 0)
          if (totalItems >= coupon.min_items) {
            const freeItems = Math.floor(totalItems / coupon.min_items) * coupon.free_items
            const avgPrice = subtotal / totalItems
            couponDiscount = freeItems * avgPrice
          }
          break
        }
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

    await activityLogger.log('order_created', 'order', order.id, {
      description: `Pedido ${order.code} criado com ${processedItems.length} item(ns)`,
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
 * Atualiza status do pedido.
 * Ao confirmar: decrementa quantity_available dos envases vinculados.
 * Ao cancelar depois de confirmado: restaura o estoque dos envases.
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, discount, notes } = req.body

    const validStatuses = ['Pending', 'Confirmed', 'In Production', 'Ready', 'Shipped', 'Delivered', 'Cancelled']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const order = await db('orders').where({ id }).first()
    if (!order) return res.status(404).json({ error: 'Order not found' })

    // ── Trava: só pode marcar Pronto se todos os itens com produto estão vinculados ──
    if (status === 'Ready') {
      const items = await db('order_items').where({ order_id: id }).whereNotNull('product_id')
      const unlinked = items.filter(i => !i.bottling_id)
      if (unlinked.length > 0) {
        return res.status(400).json({
          error: `Não é possível marcar como Pronto: ${unlinked.length} item(ns) sem envase vinculado.`
        })
      }
    }

    const updateData = { status, updated_at: db.fn.now() }
    if (discount !== undefined) updateData.discount = parseFloat(discount) || 0
    if (notes    !== undefined) updateData.notes    = notes

    const [updated] = await db.transaction(async (trx) => {
      // ── Confirmação: debitar estoque dos envases vinculados ─────────────
      if (status === 'Confirmed' && !order.stock_decremented) {
        const items = await trx('order_items').where({ order_id: id })
        for (const item of items) {
          if (!item.bottling_id) continue
          await trx.raw(
            'UPDATE bottlings SET quantity_available = GREATEST(0, quantity_available - ?) WHERE id = ?',
            [parseInt(item.quantity), item.bottling_id]
          )
        }
        updateData.stock_decremented = true
      }

      // ── Cancelamento ou regressão para Pendente: restaurar estoque ──────
      if ((status === 'Cancelled' || status === 'Pending') && order.stock_decremented) {
        const items = await trx('order_items').where({ order_id: id })
        for (const item of items) {
          if (!item.bottling_id) continue
          await trx('bottlings')
            .where({ id: item.bottling_id })
            .increment('quantity_available', parseInt(item.quantity))
        }
        updateData.stock_decremented = false
      }

      return trx('orders').where({ id }).update(updateData).returning('*')
    })

    await activityLogger.log('order_updated', 'order', id, {
      description: `Status do pedido alterado para: ${status}`,
    })

    res.json(updated)
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

    const [productionOrders, bottlingOrders, purchaseOrders] = await Promise.all([
      db('production_orders')
        .leftJoin('formulas', 'production_orders.formula_id', 'formulas.id')
        .leftJoin('products', 'formulas.product_id', 'products.id')
        .where('production_orders.order_id', id)
        .select('production_orders.*', 'products.name as product_name'),

      db('bottling_orders')
        .leftJoin('products', 'bottling_orders.product_id', 'products.id')
        .leftJoin('batches', 'bottling_orders.batch_id', 'batches.id')
        .where('bottling_orders.order_id', id)
        .select('bottling_orders.*', 'products.name as product_name', 'batches.code as batch_code'),

      db('purchase_orders')
        .leftJoin('supplies', 'purchase_orders.supply_id', 'supplies.id')
        .leftJoin('suppliers', 'purchase_orders.supplier_id', 'suppliers.id')
        .where('purchase_orders.order_id', id)
        .select('purchase_orders.*', 'supplies.name as supply_name', 'suppliers.name as supplier_name'),
    ])

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

/**
 * Edita um item do pedido (somente Pending ou Confirmed)
 */
exports.updateItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params
    const { product_id, volume_ml, quantity, unit_price, item_discount } = req.body

    const order = await db('orders').where({ id: orderId }).first()
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (!['Pending', 'Confirmed'].includes(order.status)) {
      return res.status(400).json({ error: 'Só é possível editar itens quando o pedido está Pendente ou Confirmado' })
    }

    const item = await db('order_items').where({ id: itemId, order_id: orderId }).first()
    if (!item) return res.status(404).json({ error: 'Item not found' })

    const decision = await orderDecisionEngine.executeDecision({ product_id, volume_ml, quantity })

    const updateData = {
      product_id,
      volume_ml,
      quantity,
      unit_price,
      decision_status: decision.status,
      estimated_days: decision.estimatedDays,
      decision_notes: decision.notes,
    }
    if (item_discount !== undefined) updateData.item_discount = parseFloat(item_discount) || 0

    const [updated] = await db('order_items')
      .where({ id: itemId })
      .update(updateData)
      .returning('*')

    await activityLogger.log('order_updated', 'order', orderId, {
      description: `Item ${itemId} do pedido ${order.code} atualizado`,
    })

    res.json(updated)
  } catch (error) {
    console.error('Error updating order item:', error)
    res.status(500).json({ error: 'Failed to update order item' })
  }
}

/**
 * Vincula (ou desvincula) um envase a um item do pedido — M16 rastreabilidade.
 * Permite status: Confirmed, In Production, Ready.
 */
exports.linkBottling = async (req, res) => {
  try {
    const { orderId, itemId } = req.params
    const { bottling_id } = req.body

    const order = await db('orders').where({ id: parseInt(orderId) }).first()
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (!['Confirmed', 'In Production', 'Ready'].includes(order.status)) {
      return res.status(400).json({ error: 'Vínculo de envase só é permitido em pedidos Confirmados, Em Produção ou Prontos' })
    }

    const item = await db('order_items').where({ id: parseInt(itemId), order_id: parseInt(orderId) }).first()
    if (!item) return res.status(404).json({ error: 'Item not found' })

    if (bottling_id != null) {
      const bottling = await db('bottlings').where({ id: parseInt(bottling_id) }).first()
      if (!bottling) return res.status(404).json({ error: 'Envase não encontrado' })
      if (parseInt(bottling.quantity_available) < parseInt(item.quantity)) {
        return res.status(400).json({
          error: `Envase sem estoque suficiente: disponível ${bottling.quantity_available}, necessário ${item.quantity}`
        })
      }
    }

    // Quando o pedido já foi confirmado, linkBottling gerencia quantity_available diretamente
    if (order.stock_decremented) {
      if (item.bottling_id) {
        await db('bottlings').where({ id: item.bottling_id }).increment('quantity_available', parseInt(item.quantity))
      }
      if (bottling_id != null) {
        await db('bottlings').where({ id: parseInt(bottling_id) }).decrement('quantity_available', parseInt(item.quantity))
      }
    }

    const [updated] = await db('order_items')
      .where({ id: parseInt(itemId) })
      .update({ bottling_id: bottling_id != null ? parseInt(bottling_id) : null })
      .returning('*')

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * Aplica ou remove um cupom em pedido Pendente/Confirmado
 */
exports.applyCoupon = async (req, res) => {
  try {
    const { id } = req.params
    const { coupon_code } = req.body

    const order = await db('orders').where({ id }).first()
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (!['Pending', 'Confirmed'].includes(order.status)) {
      return res.status(400).json({ error: 'Cupom só pode ser aplicado em pedidos Pendente ou Confirmado' })
    }

    // Remover cupom
    if (!coupon_code) {
      const [updated] = await db('orders').where({ id })
        .update({ coupon_id: null, coupon_discount: 0, updated_at: db.fn.now() })
        .returning('*')
      return res.json({ ...updated, coupon_discount: 0 })
    }

    const coupon = await db('coupons')
      .where({ code: coupon_code.trim().toUpperCase(), active: true })
      .where('valid_from', '<=', db.fn.now())
      .where(function () {
        this.whereNull('valid_until').orWhere('valid_until', '>=', db.fn.now())
      })
      .first()

    if (!coupon) return res.status(400).json({ error: 'Cupom inválido ou expirado' })
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return res.status(400).json({ error: 'Limite de usos do cupom atingido' })
    }

    const items    = await db('order_items').where({ order_id: id })
    const subtotal = items.reduce((s, i) => s + parseFloat(i.unit_price) * parseInt(i.quantity), 0)

    // Gap #4: validar valor mínimo do pedido
    const minOrderValue = parseFloat(coupon.min_order_value || 0)
    if (minOrderValue > 0 && subtotal < minOrderValue) {
      return res.status(400).json({ error: `Valor mínimo do pedido para este cupom: R$ ${minOrderValue.toFixed(2)}` })
    }

    let couponDiscount = 0
    switch (coupon.type) {
      case 'Percentage':
        couponDiscount = (subtotal * coupon.discount_value) / 100
        break
      case 'Fixed Amount':
        couponDiscount = parseFloat(coupon.discount_value)
        break
      case 'Progressive': {
        // Aplica desconto somente sobre a parte que excede o valor mínimo
        const excessAmount = Math.max(0, subtotal - minOrderValue)
        couponDiscount = (excessAmount * coupon.discount_value) / 100
        break
      }
      case 'Buy X Get Y': {
        const totalQty = items.reduce((s, i) => s + parseInt(i.quantity), 0)
        if (totalQty >= coupon.min_items) {
          const free    = Math.floor(totalQty / coupon.min_items) * coupon.free_items
          const avgPrc  = totalQty > 0 ? subtotal / totalQty : 0
          couponDiscount = free * avgPrc
        }
        break
      }
    }

    const [updated] = await db('orders').where({ id })
      .update({ coupon_id: coupon.id, coupon_discount: couponDiscount, updated_at: db.fn.now() })
      .returning('*')

    res.json({ ...updated, coupon_code: coupon.code, coupon_type: coupon.type, coupon_discount: couponDiscount })
  } catch (error) {
    console.error('Error applying coupon:', error)
    res.status(500).json({ error: error.message })
  }
}

module.exports = exports
