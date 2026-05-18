/**
 * Order Decision Engine
 * Motor de decisão automática para pedidos
 * 
 * Cadeia de decisão em cascata:
 * 1. Existe frasco pronto? → Separar frasco (3 dias úteis)
 * 2. Tem ML no lote? → Gerar Ordem de Envase (12 dias úteis)
 * 3. Lote em maceração? → Informar prazo (12 dias úteis)
 * 4. Tem insumos? → Gerar Ordem de Produção (17 dias úteis)
 * 5. Falta insumos? → Gerar Ordem de Compra + Produção (17 dias úteis)
 */

const { db } = require('../models/db')

class OrderDecisionEngine {
  /**
   * Executa a cadeia de decisão para um item do pedido
   * @param {Object} orderItem - Item do pedido
   * @param {number} orderItem.product_id - ID do produto
   * @param {number} orderItem.volume_ml - Volume em ml
   * @param {number} orderItem.quantity - Quantidade de frascos
   * @returns {Promise<Object>} Resultado da decisão
   */
  async executeDecision(orderItem) {
    const { product_id, volume_ml, quantity } = orderItem
    const totalMlNeeded = volume_ml * quantity

    // 1. Verificar se existe frasco pronto em estoque
    const readyStock = await this.checkReadyStock(product_id, volume_ml, quantity)
    if (readyStock.available) {
      return {
        status: 'Ready Stock',
        estimatedDays: 3,
        notes: `${quantity} frasco(s) disponível(is) em estoque`,
        actions: []
      }
    }

    // 2. Verificar se tem ML suficiente em lote pronto para envase
    const batchReady = await this.checkBatchReady(product_id, totalMlNeeded)
    if (batchReady.available) {
      return {
        status: 'Needs Bottling',
        estimatedDays: 12,
        notes: `ML disponível no lote ${batchReady.batch_id}. Envase necessário.`,
        actions: [{
          type: 'bottling_order',
          batch_id: batchReady.batch_id,
          volume_ml,
          quantity
        }]
      }
    }

    // 3. Verificar se tem lote em maceração
    const batchMacerating = await this.checkBatchMacerating(product_id, totalMlNeeded)
    if (batchMacerating.inMaceration) {
      return {
        status: 'In Maceration',
        estimatedDays: 12,
        notes: `Lote ${batchMacerating.batch_id} em maceração. ${batchMacerating.daysRemaining} dia(s) restante(s).`,
        actions: [{
          type: 'bottling_order',
          batch_id: batchMacerating.batch_id,
          volume_ml,
          quantity,
          waitForMaceration: true
        }]
      }
    }

    // 4. Verificar se tem insumos suficientes para produzir
    const suppliesCheck = await this.checkSuppliesAvailable(product_id, totalMlNeeded)
    if (suppliesCheck.available) {
      return {
        status: 'Needs Production',
        estimatedDays: 17,
        notes: `Insumos disponíveis. Produção necessária de ${totalMlNeeded}ml.`,
        actions: [{
          type: 'production_order',
          formula_id: suppliesCheck.formula_id,
          quantity_ml: totalMlNeeded
        }, {
          type: 'bottling_order',
          volume_ml,
          quantity,
          waitForProduction: true
        }]
      }
    }

    // 5. Faltam insumos - gerar ordem de compra
    return {
      status: 'Needs Purchase',
      estimatedDays: 17,
      notes: `Insumos insuficientes. Compra necessária: ${suppliesCheck.missingSupplies.join(', ')}`,
      actions: [
        ...suppliesCheck.missingSupplies.map(supply => ({
          type: 'purchase_order',
          supply_id: supply.id,
          supplier_id: supply.preferred_supplier_id,
          quantity_needed: supply.quantity_needed
        })),
        {
          type: 'production_order',
          formula_id: suppliesCheck.formula_id,
          quantity_ml: totalMlNeeded,
          waitForPurchase: true
        },
        {
          type: 'bottling_order',
          volume_ml,
          quantity,
          waitForProduction: true
        }
      ]
    }
  }

  /**
   * Verifica se existe frasco pronto em estoque
   */
  async checkReadyStock(product_id, volume_ml, quantity) {
    const product = await db('products')
      .where({ id: product_id })
      .select('project_name')
      .first()

    if (!product) return { available: false }

    const bottling = await db('bottlings')
      .where({ product_name: product.project_name, volume_ml })
      .where('quantity_available', '>=', quantity)
      .first()

    return {
      available: !!bottling,
      bottling_id: bottling?.id
    }
  }

  /**
   * Verifica se tem ML suficiente em lote pronto para envase
   */
  async checkBatchReady(product_id, totalMlNeeded) {
    // Buscar fórmula do produto
    const formula = await db('formulas')
      .where({ product_id })
      .first()

    if (!formula) {
      return { available: false }
    }

    // Buscar lote pronto (não em maceração) com ML suficiente
    const batch = await db('batches')
      .where({ formula_id: formula.id })
      .where('status', 'Pronto para envase')
      .where('remaining_ml', '>=', totalMlNeeded)
      .orderBy('created_at', 'desc')
      .first()

    return {
      available: !!batch,
      batch_id: batch?.id
    }
  }

  /**
   * Verifica se tem lote em maceração
   */
  async checkBatchMacerating(product_id, totalMlNeeded) {
    const formula = await db('formulas')
      .where({ product_id })
      .first()

    if (!formula) {
      return { inMaceration: false }
    }

    const batch = await db('batches')
      .where({ formula_id: formula.id })
      .where('status', 'Em maceração')
      .where('quantity_ml', '>=', totalMlNeeded)
      .orderBy('maceration_end', 'asc')
      .first()

    if (!batch) {
      return { inMaceration: false }
    }

    // Calcular dias restantes
    const now = new Date()
    const macerationEnd = new Date(batch.maceration_end)
    const daysRemaining = Math.ceil((macerationEnd - now) / (1000 * 60 * 60 * 24))

    return {
      inMaceration: true,
      batch_id: batch.id,
      daysRemaining: Math.max(0, daysRemaining)
    }
  }

  /**
   * Verifica se tem insumos suficientes para produzir
   */
  async checkSuppliesAvailable(product_id, totalMlNeeded) {
    // Buscar fórmula
    const formula = await db('formulas')
      .where({ product_id })
      .first()

    if (!formula) {
      return { available: false, missingSupplies: [] }
    }

    // Buscar itens da fórmula
    const formulaItems = await db('formula_items')
      .where({ formula_id: formula.id })
      .select('*')

    const missingSupplies = []

    // Verificar cada insumo
    for (const item of formulaItems) {
      const quantityNeeded = (totalMlNeeded * item.percentage) / 100

      // Somar estoque disponível de todos os lotes do insumo
      const totalStock = await db('supplies')
        .where({ id: item.supply_id })
        .sum('quantity_available as total')
        .first()

      if (!totalStock.total || totalStock.total < quantityNeeded) {
        const supply = await db('supplies')
          .where({ id: item.supply_id })
          .first()

        missingSupplies.push({
          id: supply.id,
          name: supply.name,
          quantity_needed: quantityNeeded - (totalStock.total || 0),
          preferred_supplier_id: supply.supplier_id
        })
      }
    }

    return {
      available: missingSupplies.length === 0,
      formula_id: formula.id,
      missingSupplies
    }
  }

  /**
   * Calcula o prazo do pedido (maior prazo entre todos os itens)
   */
  calculateOrderDeadline(items) {
    const maxDays = Math.max(...items.map(item => item.estimated_days || 0))
    
    // Calcular data de entrega (dias úteis)
    const deliveryDate = this.addBusinessDays(new Date(), maxDays)

    return {
      estimatedDays: maxDays,
      estimatedDelivery: deliveryDate
    }
  }

  /**
   * Adiciona dias úteis a uma data
   */
  addBusinessDays(date, days) {
    let currentDate = new Date(date)
    let addedDays = 0

    while (addedDays < days) {
      currentDate.setDate(currentDate.getDate() + 1)
      const dayOfWeek = currentDate.getDay()
      
      // Pular finais de semana (0 = domingo, 6 = sábado)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        addedDays++
      }
    }

    return currentDate
  }

  /**
   * Cria as ordens automáticas baseadas nas ações da decisão
   */
  async createAutomaticOrders(orderId, orderItemId, actions) {
    const createdOrders = []

    for (const action of actions) {
      switch (action.type) {
        case 'production_order':
          const productionOrder = await db('production_orders').insert({
            order_id: orderId,
            order_item_id: orderItemId,
            formula_id: action.formula_id,
            quantity_ml: action.quantity_ml,
            status: action.waitForPurchase ? 'Pending' : 'Pending',
            notes: action.waitForPurchase ? 'Aguardando compra de insumos' : ''
          }).returning('*')
          createdOrders.push({ type: 'production', id: productionOrder[0].id })
          break

        case 'bottling_order':
          const bottlingOrder = await db('bottling_orders').insert({
            order_id: orderId,
            order_item_id: orderItemId,
            batch_id: action.batch_id || null,
            product_id: action.product_id,
            volume_ml: action.volume_ml,
            quantity: action.quantity,
            status: action.waitForProduction || action.waitForMaceration ? 'Pending' : 'Pending',
            notes: action.waitForProduction 
              ? 'Aguardando produção do lote' 
              : action.waitForMaceration 
                ? 'Aguardando maceração do lote' 
                : ''
          }).returning('*')
          createdOrders.push({ type: 'bottling', id: bottlingOrder[0].id })
          break

        case 'purchase_order':
          const purchaseOrder = await db('purchase_orders').insert({
            order_id: orderId,
            order_item_id: orderItemId,
            supply_id: action.supply_id,
            supplier_id: action.supplier_id,
            quantity_needed: action.quantity_needed,
            status: 'Pending'
          }).returning('*')
          createdOrders.push({ type: 'purchase', id: purchaseOrder[0].id })
          break
      }
    }

    return createdOrders
  }
}

module.exports = new OrderDecisionEngine()
