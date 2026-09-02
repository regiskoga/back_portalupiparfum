/**
 * Orders Controller
 * Gerencia pedidos com motor de decisão automática
 */

const { db } = require('../models/db')
const orderDecisionEngine = require('../services/orderDecisionEngine')
const activityLogger = require('../services/activityLogger')
const events = require('../services/events')

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
 * Helper compartilhado (tarefas ③ e ④): dado um conjunto de product_id,
 * retorna um mapa product_id -> total de envases PRONTOS disponíveis.
 * "Pronto" = bottling type 'normal', ativo, com quantity_available > 0.
 * Resolução product_id -> sku -> bottlings.product_ref (chave de junção interna).
 */
async function getReadyBottlingsByProduct (productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean).map(Number))]
  if (ids.length === 0) return {}

  // IMPORTANTE: juntar products→bottlings DIRETO. Passar por order_items causaria
  // fan-out (o produto multiplicaria o estoque pelo nº de itens de pedido dele).
  const rows = await db('products as p')
    .join('bottlings as b', 'b.product_ref', 'p.sku')
    .whereIn('p.id', ids)
    .where('b.type', 'normal')
    .where('b.active', true)
    .where('b.quantity_available', '>', 0)
    .whereNotNull('p.sku')
    .where('p.sku', '<>', '')
    .groupBy('p.id')
    .select('p.id as product_id')
    .sum('b.quantity_available as ready_available')
    .count('b.id as ready_lots')

  const map = {}
  for (const r of rows) {
    map[r.product_id] = {
      ready_available: parseInt(r.ready_available) || 0,
      ready_lots: parseInt(r.ready_lots) || 0,
    }
  }
  return map
}
exports.getReadyBottlingsByProduct = getReadyBottlingsByProduct

/**
 * Comissão de parceiro (Fase 2) — sincroniza o livro-razão quando o cupom do
 * pedido é anexado/trocado/removido FORA do create (via applyCoupon). Mantém no
 * máximo 1 linha por pedido (UNIQUE order_id): faz upsert se o cupom tem parceiro
 * e comissão > 0, senão apaga a linha (cupom removido ou sem parceiro). Chamado
 * só com pedido Pendente/Confirmado (pré-realização), por isso pode substituir.
 * Base = perfumes − desconto − cupom (SEM frete). @param conn trx ou db.
 */
async function syncOrderCommission (order, coupon, subtotal, couponDiscount, conn = db) {
  if (!coupon || !coupon.partner_id) {
    await conn('partner_commissions').where({ order_id: order.id }).del()
    return
  }
  const partner = await conn('partners').where({ id: coupon.partner_id }).first()
  const rate = coupon.commission_rate != null
    ? Number(coupon.commission_rate)
    : Number(partner?.default_commission_rate || 0)
  const base = Math.max(0, subtotal - Number(order.discount || 0) - couponDiscount)
  const amount = Math.round(base * rate) / 100

  if (rate <= 0 || amount <= 0) {
    await conn('partner_commissions').where({ order_id: order.id }).del()
    return
  }

  const competence = new Date(order.created_at).toISOString().slice(0, 7) // YYYY-MM
  await conn('partner_commissions')
    .insert({
      partner_id: coupon.partner_id,
      coupon_id: coupon.id,
      order_id: order.id,
      base_amount: base,
      rate,
      amount,
      status: 'aprovado',
      competence,
      reversed_at: null,
      reversal_reason: null,
      updated_at: conn.fn.now(),
    })
    .onConflict('order_id')
    .merge()
}

/**
 * Calcula o desconto de um cupom sobre uma lista de itens do pedido.
 * Extraído do fluxo de create/applyCoupon para ser reusado ao editar itens
 * (o desconto de cupons percentuais/progressivos depende do subtotal).
 * NÃO valida min_order_value nem incrementa uso — isso fica em applyCoupon/create.
 */
function computeCouponDiscount (coupon, items) {
  const subtotal = items.reduce((s, i) => s + parseFloat(i.unit_price || 0) * parseInt(i.quantity || 0), 0)
  const minOrderValue = parseFloat(coupon.min_order_value || 0)
  switch (coupon.type) {
    case 'Percentage':
      return (subtotal * coupon.discount_value) / 100
    case 'Fixed Amount':
      return parseFloat(coupon.discount_value)
    case 'Progressive': {
      const excessAmount = Math.max(0, subtotal - minOrderValue)
      return (excessAmount * coupon.discount_value) / 100
    }
    case 'Buy X Get Y': {
      const totalQty = items.reduce((s, i) => s + parseInt(i.quantity || 0), 0)
      if (totalQty >= coupon.min_items) {
        const free   = Math.floor(totalQty / coupon.min_items) * coupon.free_items
        const avgPrc = totalQty > 0 ? subtotal / totalQty : 0
        return free * avgPrc
      }
      return 0
    }
    default:
      return 0
  }
}

/**
 * Recalcula desconto de cupom + comissão de parceiro de um pedido a partir dos
 * itens atuais. Chamado após editar/adicionar/remover itens (GAP G2) para manter
 * o total exibido e a base da comissão coerentes. Subtotal = unit_price × qtd,
 * SEM item_discount (mesma regra do resumo e da tela de detalhes).
 */
async function recalcOrderCommission (orderId, conn = db) {
  const order = await conn('orders').where({ id: orderId }).first()
  if (!order) return
  const items    = await conn('order_items').where({ order_id: orderId })
  const subtotal = items.reduce((s, i) => s + parseFloat(i.unit_price || 0) * parseInt(i.quantity || 0), 0)

  let coupon = null
  let couponDiscount = 0
  if (order.coupon_id) {
    coupon = await conn('coupons').where({ id: order.coupon_id }).first()
    if (coupon) {
      couponDiscount = computeCouponDiscount(coupon, items)
      await conn('orders').where({ id: orderId })
        .update({ coupon_discount: couponDiscount, updated_at: conn.fn.now() })
    }
  }

  await syncOrderCommission(order, coupon, subtotal, couponDiscount, conn)
}

/**
 * ③ Fila de produção: pedidos CONFIRMADOS (aguardando) e EM PRODUÇÃO (em
 * andamento), do mais antigo ao mais recente, já com seus itens (perfumes) e o
 * saldo de envases prontos por produto — para acompanhar produção sem abrir
 * pedido por pedido. Ao avançar de Confirmado p/ Em Produção o pedido continua
 * na fila (antes sumia porque o filtro era só 'Confirmed').
 */
exports.productionQueue = async (req, res) => {
  try {
    const orders = await db('orders')
      .leftJoin('customers', 'orders.customer_id', 'customers.id')
      .whereIn('orders.status', ['Confirmed', 'In Production'])
      .orderBy('orders.created_at', 'asc') // mais antigo primeiro
      .select(
        'orders.id', 'orders.code', 'orders.status', 'orders.created_at',
        'orders.channel', 'orders.notes',
        'customers.name as customer_name', 'customers.phone as customer_phone'
      )

    if (orders.length === 0) return res.json({ data: [] })

    const orderIds = orders.map(o => o.id)
    const items = await db('order_items')
      .leftJoin('products', 'order_items.product_id', 'products.id')
      .whereIn('order_items.order_id', orderIds)
      .whereNotNull('order_items.product_id') // só itens "ricos" (perfumes)
      .select(
        'order_items.id', 'order_items.order_id', 'order_items.product_id',
        'order_items.product_name', 'order_items.volume_ml',
        'order_items.quantity', 'order_items.unit_price',
        'products.commercial_name', 'products.inspiration_brand', 'products.inspiration_name'
      )

    // Envases já vinculados por item (quanto do pedido já foi atendido)
    const itemIds = items.map(i => i.id)
    const links = itemIds.length > 0
      ? await db('order_item_bottlings')
          .whereIn('order_item_id', itemIds)
          .groupBy('order_item_id')
          .select('order_item_id')
          .sum('quantity as linked_quantity')
      : []
    const linkedByItem = Object.fromEntries(
      links.map(l => [l.order_item_id, parseInt(l.linked_quantity) || 0])
    )

    // Vínculos detalhados por item (p/ exibir e remover direto na fila)
    const detailLinks = itemIds.length > 0
      ? await db('order_item_bottlings as oib')
          .join('bottlings as b', 'b.id', 'oib.bottling_id')
          .whereIn('oib.order_item_id', itemIds)
          .select('oib.id', 'oib.order_item_id', 'oib.bottling_id', 'oib.quantity',
                  'b.bottling_code', 'b.volume_ml', 'b.quantity_available')
      : []
    const linksListByItem = {}
    for (const l of detailLinks) { (linksListByItem[l.order_item_id] ||= []).push(l) }

    // Envases candidatos por produto (normal, ativo, com saldo) p/ vincular na fila
    const prodIds = [...new Set(items.map(i => i.product_id).filter(Boolean))]
    const candRows = prodIds.length > 0
      ? await db('products as p')
          .join('bottlings as b', 'b.product_ref', 'p.sku')
          .whereIn('p.id', prodIds)
          .where('b.type', 'normal').where('b.active', true).where('b.quantity_available', '>', 0)
          .whereNotNull('p.sku').where('p.sku', '<>', '')
          .select('p.id as product_id', 'b.id', 'b.bottling_code', 'b.volume_ml', 'b.quantity_available')
      : []
    const candByProduct = {}
    for (const c of candRows) { (candByProduct[c.product_id] ||= []).push(c) }

    const readyByProduct = await getReadyBottlingsByProduct(items.map(i => i.product_id))

    const itemsByOrder = {}
    for (const it of items) {
      const linked = linkedByItem[it.id] || 0
      const ready = readyByProduct[it.product_id] || { ready_available: 0, ready_lots: 0 }
      const enriched = {
        ...it,
        linked_quantity: linked,
        pending_quantity: Math.max(0, parseInt(it.quantity) - linked),
        ready_available: ready.ready_available,
        ready_lots: ready.ready_lots,
        bottling_links: linksListByItem[it.id] || [],
        available_bottlings: candByProduct[it.product_id] || [],
      }
      ;(itemsByOrder[it.order_id] ||= []).push(enriched)
    }

    const data = orders.map(o => ({ ...o, items: itemsByOrder[o.id] || [] }))
    res.json({ data })
  } catch (error) {
    console.error('Error building production queue:', error)
    res.status(500).json({ error: 'Failed to build production queue' })
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

    let countQuery = db('orders')
    if (status) countQuery = countQuery.where('orders.status', status)
    if (customer_id) countQuery = countQuery.where('orders.customer_id', customer_id)
    const [{ total }] = await countQuery.count('* as total')

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

    // Carregar vínculos de envase por item (junction table)
    const itemIds = items.map(i => i.id)
    const bottlingLinks = itemIds.length > 0
      ? await db('order_item_bottlings as oib')
          .join('bottlings as b', 'b.id', 'oib.bottling_id')
          .whereIn('oib.order_item_id', itemIds)
          .select(
            'oib.id', 'oib.order_item_id', 'oib.bottling_id', 'oib.quantity',
            'b.bottling_code', 'b.volume_ml', 'b.product_name', 'b.quantity_available'
          )
      : []

    const linksByItem = {}
    for (const l of bottlingLinks) {
      if (!linksByItem[l.order_item_id]) linksByItem[l.order_item_id] = []
      linksByItem[l.order_item_id].push(l)
    }
    // ④ Envases prontos disponíveis por produto (só aparece na UI se > 0)
    const readyByProduct = await getReadyBottlingsByProduct(items.map(i => i.product_id))
    order.items = items.map(i => ({
      ...i,
      bottling_links: linksByItem[i.id] || [],
      linked_quantity: (linksByItem[i.id] || []).reduce((s, l) => s + parseInt(l.quantity), 0),
      ready_available: (readyByProduct[i.product_id] || {}).ready_available || 0,
      ready_lots: (readyByProduct[i.product_id] || {}).ready_lots || 0,
    }))

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
      freight_type = null,
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
        freight_type: freight_type ? String(freight_type).trim() : null,
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

      // ── Comissão de parceiro (Fase 2) ────────────────────────────────────
      // Se o cupom pertence a um parceiro, credita a comissão no livro-razão
      // (mesmo helper usado pelo applyCoupon, dentro da trx). Estorno no cancelamento.
      await syncOrderCommission(order, coupon, subtotal, couponDiscount, trx)
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

    events.broadcast('orders-changed', { id: order.id, action: 'created' })

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
    const { status, discount, notes, cancellation_reason, loss_reason } = req.body

    const validStatuses = ['Pending', 'Confirmed', 'In Production', 'Ready', 'Shipped', 'Delivered', 'Cancelled', 'Lost']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const order = await db('orders').where({ id }).first()
    if (!order) return res.status(404).json({ error: 'Order not found' })

    // ── Trava: cancelamento exige motivo (evita cancelar sem querer) ──
    if (status === 'Cancelled') {
      const reason = (cancellation_reason || '').trim()
      if (!reason) {
        return res.status(400).json({ error: 'Informe o motivo do cancelamento.' })
      }
    }

    // ── Trava: Perdido/Avariado exige observação (documenta a perda) ──
    if (status === 'Lost') {
      const obs = (loss_reason || '').trim()
      if (!obs) {
        return res.status(400).json({ error: 'Informe a observação da perda/avaria.' })
      }
    }

    // ── Trava: só pode marcar Pronto se todos os itens têm envases suficientes ──
    if (status === 'Ready') {
      const items = await db('order_items').where({ order_id: id }).whereNotNull('product_id')
      const itemIds = items.map(i => i.id)
      const links = itemIds.length > 0
        ? await db('order_item_bottlings').whereIn('order_item_id', itemIds)
            .groupBy('order_item_id')
            .select('order_item_id', db.raw('SUM(quantity) as total_linked'))
        : []
      const linkedMap = Object.fromEntries(links.map(l => [l.order_item_id, parseInt(l.total_linked)]))
      const incomplete = items.filter(i => (linkedMap[i.id] || 0) < parseInt(i.quantity))
      if (incomplete.length > 0) {
        return res.status(400).json({
          error: `Não é possível marcar como Pronto: ${incomplete.length} item(ns) sem envase(s) suficiente(s) vinculado(s).`
        })
      }
    }

    const updateData = { status, updated_at: db.fn.now() }
    if (discount !== undefined) updateData.discount = parseFloat(discount) || 0
    if (notes    !== undefined) updateData.notes    = notes
    // Guarda o motivo ao cancelar; limpa se o pedido for reaberto.
    if (status === 'Cancelled') updateData.cancellation_reason = (cancellation_reason || '').trim()
    else if (order.status === 'Cancelled') updateData.cancellation_reason = null

    // Guarda a FASE de origem do cancelamento, gateado pela TRANSIÇÃO (entrar em
    // Cancelled captura o status anterior; sair de Cancelled limpa). Não usar
    // `status === 'Cancelled'` puro: um re-cancel via API sobrescreveria a origem
    // com 'Cancelled'. Espelha a lógica entering/leaving dos brindes.
    if (status === 'Cancelled' && order.status !== 'Cancelled') {
      updateData.cancelled_from_status = order.status
    } else if (status !== 'Cancelled' && order.status === 'Cancelled') {
      updateData.cancelled_from_status = null
    }

    // Perdido/Avariado: grava observação + fase de origem na transição; limpa ao sair.
    // OBS: NÃO restaura estoque nem brindes (a mercadoria se perdeu) — por isso 'Lost'
    // fica fora dos blocos de restore mais abaixo, mantendo stock_decremented como está.
    if (status === 'Lost') updateData.loss_reason = (loss_reason || '').trim()
    else if (order.status === 'Lost') updateData.loss_reason = null

    if (status === 'Lost' && order.status !== 'Lost') {
      updateData.lost_from_status = order.status
    } else if (status !== 'Lost' && order.status === 'Lost') {
      updateData.lost_from_status = null
    }

    const [updated] = await db.transaction(async (trx) => {
      // ── Confirmação: debitar via junction table ──────────────────────────
      if (status === 'Confirmed' && !order.stock_decremented) {
        const itemIds = (await trx('order_items').where({ order_id: id }).select('id')).map(i => i.id)
        const links = itemIds.length > 0 ? await trx('order_item_bottlings').whereIn('order_item_id', itemIds) : []
        for (const link of links) {
          await trx.raw(
            'UPDATE bottlings SET quantity_available = GREATEST(0, quantity_available - ?) WHERE id = ?',
            [parseInt(link.quantity), link.bottling_id]
          )
        }
        updateData.stock_decremented = true
      }

      // ── Cancelamento ou regressão para Pendente: restaurar via junction ──
      if ((status === 'Cancelled' || status === 'Pending') && order.stock_decremented) {
        const itemIds = (await trx('order_items').where({ order_id: id }).select('id')).map(i => i.id)
        const links = itemIds.length > 0 ? await trx('order_item_bottlings').whereIn('order_item_id', itemIds) : []
        for (const link of links) {
          await trx('bottlings').where({ id: link.bottling_id }).increment('quantity_available', parseInt(link.quantity))
        }
        updateData.stock_decremented = false
      }

      // ── Brindes: estoque é debitado no momento em que o brinde é adicionado
      //    (orderGiftsController.create), independente de stock_decremented.
      //    Ao CANCELAR, devolver o estoque dos brindes; ao REABRIR (sair de
      //    Cancelado), debitar de novo. Gateado pela transição de status para
      //    ser idempotente (não restaura/debita duas vezes num re-cancel). ──
      const enteringCancelled = status === 'Cancelled' && order.status !== 'Cancelled'
      const leavingCancelled  = order.status === 'Cancelled' && status !== 'Cancelled'
      if (enteringCancelled || leavingCancelled) {
        const gifts = await trx('order_gifts').where({ order_id: id }).select('bottling_id', 'quantity')
        for (const g of gifts) {
          if (enteringCancelled) {
            await trx('bottlings').where({ id: g.bottling_id }).increment('quantity_available', parseInt(g.quantity))
          } else {
            await trx.raw(
              'UPDATE bottlings SET quantity_available = GREATEST(0, quantity_available - ?) WHERE id = ?',
              [parseInt(g.quantity), g.bottling_id]
            )
          }
        }

        // ── Comissão de parceiro (Fase 2): estorna ao cancelar, reverte ao reabrir.
        //    Gateado pela transição + filtro de status = idempotente num re-cancel.
        if (enteringCancelled) {
          await trx('partner_commissions').where({ order_id: id, status: 'aprovado' }).update({
            status: 'estornado',
            reversed_at: trx.fn.now(),
            reversal_reason: (cancellation_reason || 'Pedido cancelado').trim(),
            updated_at: trx.fn.now(),
          })
        } else {
          await trx('partner_commissions').where({ order_id: id, status: 'estornado' }).update({
            status: 'aprovado',
            reversed_at: null,
            reversal_reason: null,
            updated_at: trx.fn.now(),
          })
        }
      }

      return trx('orders').where({ id }).update(updateData).returning('*')
    })

    await activityLogger.log('order_updated', 'order', id, {
      description: `Status do pedido alterado para: ${status}`,
    })

    events.broadcast('orders-changed', { id: parseInt(id), status })

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

    // GAP G2: editar item muda o subtotal → recalcula cupom + comissão do parceiro.
    await recalcOrderCommission(orderId)

    await activityLogger.log('order_updated', 'order', orderId, {
      description: `Item ${itemId} do pedido ${order.code} atualizado`,
    })

    events.broadcast('orders-changed', { id: parseInt(orderId), action: 'item-updated' })
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
      if (parseFloat(bottling.volume_ml) !== parseFloat(item.volume_ml)) {
        return res.status(400).json({
          error: `Volume incompatível: o item é de ${item.volume_ml}ml mas o envase é de ${bottling.volume_ml}ml`
        })
      }
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

    events.broadcast('orders-changed', { id: parseInt(orderId), action: 'bottling-linked' })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * Adiciona um vínculo de envase a um item via junction table (N:N).
 * Auto-calcula a quantidade: min(restante do item, disponível no envase).
 */
exports.addBottling = async (req, res) => {
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

    const bottling = await db('bottlings').where({ id: parseInt(bottling_id) }).first()
    if (!bottling) return res.status(404).json({ error: 'Envase não encontrado' })

    if (parseFloat(bottling.volume_ml) !== parseFloat(item.volume_ml)) {
      return res.status(400).json({
        error: `Volume incompatível: item é ${item.volume_ml}ml mas envase é ${bottling.volume_ml}ml`
      })
    }

    const existing = await db('order_item_bottlings')
      .where({ order_item_id: parseInt(itemId), bottling_id: parseInt(bottling_id) })
      .first()
    if (existing) return res.status(400).json({ error: 'Este envase já está vinculado a este item' })

    const existingLinks = await db('order_item_bottlings').where({ order_item_id: parseInt(itemId) })
    const alreadyLinked = existingLinks.reduce((s, l) => s + parseInt(l.quantity), 0)
    const remaining = parseInt(item.quantity) - alreadyLinked

    if (remaining <= 0) return res.status(400).json({ error: 'Item já está completamente vinculado' })
    if (parseInt(bottling.quantity_available) <= 0) {
      return res.status(400).json({ error: 'Envase sem estoque disponível' })
    }

    const quantityToLink = Math.min(remaining, parseInt(bottling.quantity_available))

    await db.transaction(async trx => {
      await trx('order_item_bottlings').insert({
        order_item_id: parseInt(itemId),
        bottling_id:   parseInt(bottling_id),
        quantity:      quantityToLink,
      })
      if (order.stock_decremented) {
        await trx.raw(
          'UPDATE bottlings SET quantity_available = GREATEST(0, quantity_available - ?) WHERE id = ?',
          [quantityToLink, parseInt(bottling_id)]
        )
      }
    })

    events.broadcast('orders-changed', { id: parseInt(orderId), action: 'bottling-added' })
    res.json({ linked: quantityToLink, bottling_id: parseInt(bottling_id) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * Remove um vínculo de envase de um item de pedido.
 * Restaura o estoque se o pedido já teve estoque debitado.
 */
exports.removeBottling = async (req, res) => {
  try {
    const { orderId, itemId, linkId } = req.params

    const order = await db('orders').where({ id: parseInt(orderId) }).first()
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (!['Confirmed', 'In Production', 'Ready'].includes(order.status)) {
      return res.status(400).json({ error: 'Operação não permitida neste status' })
    }

    const link = await db('order_item_bottlings')
      .where({ id: parseInt(linkId), order_item_id: parseInt(itemId) })
      .first()
    if (!link) return res.status(404).json({ error: 'Vínculo não encontrado' })

    await db.transaction(async trx => {
      if (order.stock_decremented) {
        await trx('bottlings')
          .where({ id: link.bottling_id })
          .increment('quantity_available', parseInt(link.quantity))
      }
      await trx('order_item_bottlings').where({ id: parseInt(linkId) }).del()
    })

    events.broadcast('orders-changed', { id: parseInt(orderId), action: 'bottling-removed' })
    res.json({ removed: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * Registra ou atualiza informações de pagamento do pedido
 */
exports.registerPayment = async (req, res) => {
  try {
    const { id } = req.params
    const { payment_method, amount_paid, payment_date } = req.body

    const order = await db('orders').where({ id }).first()
    if (!order) return res.status(404).json({ error: 'Order not found' })

    const [updated] = await db('orders')
      .where({ id })
      .update({
        payment_method: payment_method || null,
        amount_paid:    amount_paid != null ? parseFloat(amount_paid) : null,
        payment_date:   payment_date || null,
        updated_at:     db.fn.now(),
      })
      .returning('*')

    await activityLogger.log('order_updated', 'order', id, {
      description: `Pagamento registrado: ${payment_method} — ${amount_paid}`,
    })

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
      // Sem cupom → remove qualquer comissão de parceiro do pedido
      await syncOrderCommission(order, null, 0, 0)
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

    const couponDiscount = computeCouponDiscount(coupon, items)

    const [updated] = await db('orders').where({ id })
      .update({ coupon_id: coupon.id, coupon_discount: couponDiscount, updated_at: db.fn.now() })
      .returning('*')

    await db('coupons').where({ id: coupon.id }).increment('current_uses', 1)

    // Cupom aplicado/trocado pós-criação → sincroniza a comissão do parceiro
    await syncOrderCommission(order, coupon, subtotal, couponDiscount)

    res.json({ ...updated, coupon_code: coupon.code, coupon_type: coupon.type, coupon_discount: couponDiscount })
  } catch (error) {
    console.error('Error applying coupon:', error)
    res.status(500).json({ error: error.message })
  }
}

/**
 * Atualiza o frete do pedido (valor + tipo) em qualquer fase ANTES de concluído.
 * Bloqueado quando Entregue ou Cancelado. Mantém o padrão de broadcast SSE +
 * activity log das demais mutações de pedido.
 */
exports.updateFreight = async (req, res) => {
  try {
    const { id } = req.params
    const { shipping, freight_type } = req.body

    const order = await db('orders').where({ id }).first()
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (['Delivered', 'Cancelled'].includes(order.status)) {
      return res.status(400).json({ error: 'Frete não pode ser alterado em pedido Entregue ou Cancelado' })
    }

    const updateData = { updated_at: db.fn.now() }
    if (shipping !== undefined) updateData.shipping = Math.max(0, parseFloat(shipping) || 0)
    if (freight_type !== undefined) {
      const ft = freight_type == null ? null : String(freight_type).trim()
      updateData.freight_type = ft || null
    }

    const [updated] = await db('orders').where({ id }).update(updateData).returning('*')

    await activityLogger.log('order_updated', 'order', id, {
      description: `Frete do pedido ${order.code} atualizado`,
    })

    events.broadcast('orders-changed', { id: parseInt(id), action: 'freight-updated' })
    res.json(updated)
  } catch (error) {
    console.error('Error updating order freight:', error)
    res.status(500).json({ error: error.message })
  }
}

/**
 * Adiciona um novo item a um pedido existente — somente enquanto Pendente
 * (pré-pedido). Em Pending o estoque ainda não foi decrementado, então basta
 * inserir o item, rodar o motor de decisão (como no create) e recalcular a
 * comissão. Mesma estrutura de insert do create() para não deixar item "órfão".
 */
exports.addItem = async (req, res) => {
  const trx = await db.transaction()
  try {
    const { orderId } = req.params
    const { product_id, volume_ml, quantity, unit_price, item_discount = 0 } = req.body

    const order = await trx('orders').where({ id: orderId }).first()
    if (!order) { await trx.rollback(); return res.status(404).json({ error: 'Order not found' }) }
    // Só em Pending E com estoque ainda não reservado. Um pedido regredido de
    // Confirmado tem o estoque restaurado (stock_decremented=false) — a checagem
    // extra é blindagem contra qualquer caminho que deixe Pending decrementado.
    if (order.status !== 'Pending' || order.stock_decremented) {
      await trx.rollback()
      return res.status(400).json({ error: 'Só é possível adicionar itens enquanto o pedido está Pendente (sem estoque reservado)' })
    }

    const decision = await orderDecisionEngine.executeDecision({ product_id, volume_ml, quantity })

    const [orderItem] = await trx('order_items')
      .insert({
        order_id: order.id,
        product_id,
        product_name: req.body.product_name || '',
        product_ref: req.body.product_ref || '',
        volume_ml,
        quantity,
        unit_price,
        item_discount: parseFloat(item_discount) || 0,
        decision_status: decision.status,
        estimated_days: decision.estimatedDays,
        decision_notes: decision.notes,
      })
      .returning('*')

    await orderDecisionEngine.createAutomaticOrders(order.id, orderItem.id, decision.actions, trx)

    await recalcOrderCommission(order.id, trx)

    await activityLogger.log('order_updated', 'order', order.id, {
      description: `Item adicionado ao pedido ${order.code}`,
    })

    await trx.commit()
    events.broadcast('orders-changed', { id: parseInt(orderId), action: 'item-added' })
    res.status(201).json(orderItem)
  } catch (error) {
    await trx.rollback()
    console.error('Error adding order item:', error)
    res.status(500).json({ error: 'Failed to add order item' })
  }
}

/**
 * Remove um item de um pedido — somente enquanto Pendente. Bloqueia remover o
 * último item (pedido precisa ter ≥1). Vínculos de envase e ordens automáticas
 * do item caem por CASCADE; recalcula cupom + comissão ao final.
 */
exports.removeItem = async (req, res) => {
  const trx = await db.transaction()
  try {
    const { orderId, itemId } = req.params

    const order = await trx('orders').where({ id: orderId }).first()
    if (!order) { await trx.rollback(); return res.status(404).json({ error: 'Order not found' }) }
    // Só em Pending E sem estoque reservado (ver nota em addItem).
    if (order.status !== 'Pending' || order.stock_decremented) {
      await trx.rollback()
      return res.status(400).json({ error: 'Só é possível remover itens enquanto o pedido está Pendente (sem estoque reservado)' })
    }

    const item = await trx('order_items').where({ id: itemId, order_id: orderId }).first()
    if (!item) { await trx.rollback(); return res.status(404).json({ error: 'Item not found' }) }

    const { c } = await trx('order_items').where({ order_id: orderId }).count('* as c').first()
    if (parseInt(c) <= 1) {
      await trx.rollback()
      return res.status(400).json({ error: 'O pedido precisa ter pelo menos um item' })
    }

    // Vínculos de envase (defensivo — não deve haver em Pending); ordens
    // automáticas caem por onDelete CASCADE ao deletar o item.
    await trx('order_item_bottlings').where({ order_item_id: itemId }).del()
    await trx('order_items').where({ id: itemId }).del()

    await recalcOrderCommission(order.id, trx)

    await activityLogger.log('order_updated', 'order', order.id, {
      description: `Item removido do pedido ${order.code}`,
    })

    await trx.commit()
    events.broadcast('orders-changed', { id: parseInt(orderId), action: 'item-removed' })
    res.json({ success: true })
  } catch (error) {
    await trx.rollback()
    console.error('Error removing order item:', error)
    res.status(500).json({ error: error.message })
  }
}

module.exports = exports
