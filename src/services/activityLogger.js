const { db } = require('../models/db')

/**
 * Serviço centralizado de logging de atividades
 * Registra todas as movimentações do sistema para rastreabilidade
 */

class ActivityLogger {
  /**
   * Registra uma atividade no log
   * @param {string} activityType - Tipo de atividade (ex: 'product_created')
   * @param {string} entityType - Tipo de entidade (ex: 'product')
   * @param {number} entityId - ID da entidade
   * @param {object} options - Opções adicionais
   */
  static async log(activityType, entityType, entityId, options = {}) {
    try {
      const {
        entityName = null,
        changes = null,
        description = null,
        operator = 'system',
        ipAddress = null,
        userAgent = null
      } = options

      await db('activity_logs').insert({
        activity_type: activityType,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        changes: changes ? JSON.stringify(changes) : null,
        description,
        operator,
        ip_address: ipAddress,
        user_agent: userAgent
      })
    } catch (error) {
      console.error('Erro ao registrar atividade:', error.message)
      // Não lançar erro para não interromper a operação principal
    }
  }

  /**
   * Registra criação de entidade
   */
  static async logCreate(entityType, entityId, entityName, data, operator = 'system') {
    await this.log(
      `${entityType}_created`,
      entityType,
      entityId,
      {
        entityName,
        changes: { created: data },
        description: `${entityType} criado: ${entityName}`,
        operator
      }
    )
  }

  /**
   * Registra atualização de entidade
   */
  static async logUpdate(entityType, entityId, entityName, before, after, operator = 'system') {
    const changes = {}
    
    // Identificar apenas campos que mudaram
    for (const key in after) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes[key] = {
          before: before[key],
          after: after[key]
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      await this.log(
        `${entityType}_updated`,
        entityType,
        entityId,
        {
          entityName,
          changes,
          description: `${entityType} atualizado: ${entityName}`,
          operator
        }
      )
    }
  }

  /**
   * Registra exclusão de entidade
   */
  static async logDelete(entityType, entityId, entityName, data, operator = 'system') {
    await this.log(
      `${entityType}_deleted`,
      entityType,
      entityId,
      {
        entityName,
        changes: { deleted: data },
        description: `${entityType} removido: ${entityName}`,
        operator
      }
    )
  }

  /**
   * Registra validação de fórmula
   */
  static async logFormulaValidation(formulaId, formulaName, totalPercentage, isValid, operator = 'system') {
    await this.log(
      'formula_validated',
      'formula',
      formulaId,
      {
        entityName: formulaName,
        changes: { total_percentage: totalPercentage, validated: isValid },
        description: `Fórmula ${isValid ? 'validada' : 'invalidada'}: ${formulaName} (${totalPercentage}%)`,
        operator
      }
    )
  }

  /**
   * Registra início de maceração
   */
  static async logMacerationStart(batchId, batchCode, macerationEnd, operator = 'system') {
    await this.log(
      'batch_maceration_started',
      'batch',
      batchId,
      {
        entityName: batchCode,
        changes: { maceration_start: new Date(), maceration_end: macerationEnd },
        description: `Maceração iniciada: ${batchCode} (10 dias até ${macerationEnd})`,
        operator
      }
    )
  }

  /**
   * Registra envase
   */
  static async logBottling(bottlingId, bottlingCode, productName, quantity, volumeMl, totalCost, operator = 'system') {
    await this.log(
      'bottling_created',
      'bottling',
      bottlingId,
      {
        entityName: bottlingCode,
        changes: {
          product_name: productName,
          quantity,
          volume_ml: volumeMl,
          total_cost: totalCost
        },
        description: `Envase realizado: ${bottlingCode} - ${productName} (${quantity}x${volumeMl}ml) - Custo: R$${totalCost}`,
        operator
      }
    )
  }

  /**
   * Registra perda de insumo/lote
   */
  static async logLoss(entityType, entityId, entityName, quantity, reason, operator = 'system') {
    await this.log(
      'loss_recorded',
      entityType,
      entityId,
      {
        entityName,
        changes: { quantity_lost: quantity, reason },
        description: `Perda registrada: ${entityName} - ${quantity} (Motivo: ${reason})`,
        operator
      }
    )
  }

  /**
   * Registra doação
   */
  static async logDonation(entityType, entityId, entityName, quantity, recipient, operator = 'system') {
    await this.log(
      'donation_recorded',
      entityType,
      entityId,
      {
        entityName,
        changes: { quantity_donated: quantity, recipient },
        description: `Doação registrada: ${entityName} - ${quantity} para ${recipient}`,
        operator
      }
    )
  }

  /**
   * Registra transferência entre lotes
   */
  static async logTransfer(fromBatchId, fromBatchCode, toBatchId, toBatchCode, quantityMl, operator = 'system') {
    await this.log(
      'transfer_recorded',
      'batch',
      fromBatchId,
      {
        entityName: fromBatchCode,
        changes: {
          from_batch: fromBatchCode,
          to_batch: toBatchCode,
          quantity_ml: quantityMl
        },
        description: `Transferência: ${quantityMl}ml de ${fromBatchCode} para ${toBatchCode}`,
        operator
      }
    )
  }

  /**
   * Busca logs de uma entidade
   */
  static async getEntityLogs(entityType, entityId, limit = 50) {
    return await db('activity_logs')
      .where('entity_type', entityType)
      .where('entity_id', entityId)
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  /**
   * Busca logs por tipo de atividade
   */
  static async getActivityLogs(activityType, limit = 100) {
    return await db('activity_logs')
      .where('activity_type', activityType)
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  /**
   * Busca logs em um período
   */
  static async getLogsByDateRange(startDate, endDate, limit = 500) {
    return await db('activity_logs')
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', endDate)
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * 🔍 RASTREABILIDADE COMPLETA: FRASCO → ORIGEM
   * ═══════════════════════════════════════════════════════════════
   * Dado um frasco vendido, reconstrói 100% do histórico:
   * - Qual lote originou o produto?
   * - Quais insumos compuseram a fórmula?
   * - De quais fornecedores vieram os insumos?
   * - Em que data foi produzido, macerado e envasado?
   * - Para quais clientes foi vendido?
   * ═══════════════════════════════════════════════════════════════
   */
  static async traceProductOrigin(bottlingId) {
    try {
      // 1. Buscar envase
      const bottling = await db('bottlings as bt')
        .leftJoin('supplies as bs', 'bs.id', 'bt.bottle_supply_id')
        .leftJoin('supplies as ls', 'ls.id', 'bt.label_supply_id')
        .select(
          'bt.*',
          'bs.name as bottle_name',
          'bs.unit_cost as bottle_cost',
          'ls.name as label_name',
          'ls.unit_cost as label_cost'
        )
        .where('bt.id', bottlingId)
        .first()
      
      if (!bottling) return null

      // 2. Buscar lotes utilizados no envase
      const batchesUsed = await db('bottling_batches as bb')
        .join('batches as b', 'b.id', 'bb.batch_id')
        .join('formulas as f', 'f.id', 'b.formula_id')
        .join('products as p', 'p.id', 'f.product_id')
        .select(
          'bb.ml_used',
          'bb.proportional_cost',
          'b.id as batch_id',
          'b.batch_code',
          'b.production_date',
          'b.maceration_start',
          'b.maceration_end',
          'b.quantity_ml as batch_total_ml',
          'b.cost_per_ml',
          'f.id as formula_id',
          'f.name as formula_name',
          'p.id as product_id',
          'p.project_name',
          'p.commercial_name',
          'p.brand_inspiration',
          'p.gender'
        )
        .where('bb.bottling_id', bottlingId)

      // 3. Para cada lote, buscar insumos da fórmula
      const batchesWithIngredients = []
      for (const batch of batchesUsed) {
        const ingredients = await db('formula_items as fi')
          .join('supplies as s', 's.id', 'fi.supply_id')
          .leftJoin('suppliers as sp', 'sp.id', 's.supplier_id')
          .select(
            's.id as supply_id',
            's.name as supply_name',
            's.type as supply_type',
            's.unit_cost',
            'fi.percentage',
            'sp.id as supplier_id',
            'sp.name as supplier_name',
            'sp.contact as supplier_contact',
            'sp.email as supplier_email'
          )
          .where('fi.formula_id', batch.formula_id)
          .orderBy('fi.percentage', 'desc')

        // Calcular quanto de cada insumo foi usado neste lote
        const ingredientsWithUsage = ingredients.map(ing => ({
          ...ing,
          ml_used_in_batch: (batch.ml_used * ing.percentage) / 100,
          cost_in_batch: ((batch.ml_used * ing.percentage) / 100) * ing.unit_cost
        }))

        batchesWithIngredients.push({
          ...batch,
          ingredients: ingredientsWithUsage,
          total_ingredients: ingredients.length
        })
      }

      // 4. Buscar pedidos que usaram este envase
      const orders = await db('order_items as oi')
        .join('orders as o', 'o.id', 'oi.order_id')
        .leftJoin('customers as c', 'c.id', 'o.customer_id')
        .select(
          'o.id as order_id',
          'o.code as order_code',
          'o.status as order_status',
          'o.created_at as order_date',
          'oi.quantity as quantity_sold',
          'oi.unit_price',
          'oi.total_price',
          'c.id as customer_id',
          'c.name as customer_name',
          'c.email as customer_email',
          'c.phone as customer_phone'
        )
        .where('oi.bottling_id', bottlingId)

      // 5. Buscar movimentações do lote (histórico completo)
      const batchMovements = []
      for (const batch of batchesUsed) {
        const movements = await db('batch_movements')
          .where('batch_id', batch.batch_id)
          .orderBy('created_at', 'asc')
        
        batchMovements.push({
          batch_code: batch.batch_code,
          movements
        })
      }

      // 6. Buscar logs de atividade relacionados
      const activityLogs = await db('activity_logs')
        .where(function() {
          this.where('entity_type', 'bottling').where('entity_id', bottlingId)
            .orWhereIn('entity_id', batchesUsed.map(b => b.batch_id))
              .where('entity_type', 'batch')
        })
        .orderBy('created_at', 'desc')
        .limit(50)

      // 7. Calcular totais e estatísticas
      const totalMlUsed = batchesUsed.reduce((sum, b) => sum + parseFloat(b.ml_used), 0)
      const totalLiquidCost = batchesUsed.reduce((sum, b) => sum + parseFloat(b.proportional_cost), 0)
      const uniqueSuppliers = new Set()
      const uniqueIngredients = new Set()
      
      batchesWithIngredients.forEach(batch => {
        batch.ingredients.forEach(ing => {
          if (ing.supplier_id) uniqueSuppliers.add(ing.supplier_id)
          uniqueIngredients.add(ing.supply_id)
        })
      })

      return {
        summary: {
          bottling_code: bottling.bottling_code,
          product_name: bottling.product_name,
          quantity_produced: bottling.quantity,
          volume_ml: bottling.volume_ml,
          total_ml_used: totalMlUsed,
          total_cost: parseFloat(bottling.total_cost),
          unit_cost: parseFloat(bottling.unit_cost),
          bottling_date: bottling.bottling_date,
          batches_used: batchesUsed.length,
          unique_ingredients: uniqueIngredients.size,
          unique_suppliers: uniqueSuppliers.size,
          units_sold: orders.reduce((sum, o) => sum + o.quantity_sold, 0),
          customers_reached: new Set(orders.map(o => o.customer_id).filter(Boolean)).size
        },
        bottling_details: {
          ...bottling,
          bottle: bottling.bottle_name ? {
            name: bottling.bottle_name,
            cost: bottling.bottle_cost
          } : null,
          label: bottling.label_name ? {
            name: bottling.label_name,
            cost: bottling.label_cost
          } : null
        },
        batches: batchesWithIngredients,
        orders: orders.length > 0 ? orders : null,
        batch_movements: batchMovements,
        activity_logs: activityLogs,
        traceability_complete: true,
        traced_at: new Date().toISOString()
      }
    } catch (error) {
      console.error('Erro na rastreabilidade frasco→origem:', error)
      throw error
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   * 🔍 RASTREABILIDADE COMPLETA: INSUMO → DESTINO
   * ═══════════════════════════════════════════════════════════════
   * Dado um insumo, mostra onde foi usado:
   * - Em quais fórmulas esse insumo foi usado?
   * - Em quais lotes?
   * - Quais pedidos foram atendidos com esse lote?
   * - Quais clientes receberam produtos desse lote?
   * ═══════════════════════════════════════════════════════════════
   */
  static async traceSupplyUsage(supplyId) {
    try {
      // 1. Buscar insumo
      const supply = await db('supplies as s')
        .leftJoin('suppliers as sp', 'sp.id', 's.supplier_id')
        .select(
          's.*',
          'sp.id as supplier_id',
          'sp.name as supplier_name',
          'sp.contact as supplier_contact',
          'sp.email as supplier_email'
        )
        .where('s.id', supplyId)
        .first()
      
      if (!supply) return null

      // 2. Buscar em quais fórmulas foi usado
      const formulas = await db('formula_items as fi')
        .join('formulas as f', 'f.id', 'fi.formula_id')
        .join('products as p', 'p.id', 'f.product_id')
        .select(
          'f.id as formula_id',
          'f.name as formula_name',
          'f.created_at as formula_created',
          'fi.percentage',
          'p.id as product_id',
          'p.project_name',
          'p.commercial_name',
          'p.brand_inspiration'
        )
        .where('fi.supply_id', supplyId)
        .orderBy('fi.percentage', 'desc')

      if (formulas.length === 0) {
        return {
          supply,
          summary: {
            used_in_formulas: 0,
            used_in_batches: 0,
            used_in_bottlings: 0,
            customers_reached: 0
          },
          formulas: [],
          batches: [],
          bottlings: [],
          orders: [],
          message: 'Este insumo ainda não foi usado em nenhuma fórmula'
        }
      }

      const formulaIds = formulas.map(f => f.formula_id)

      // 3. Buscar em quais lotes foi usado
      const batches = await db('batches as b')
        .join('formulas as f', 'f.id', 'b.formula_id')
        .join('products as p', 'p.id', 'f.product_id')
        .select(
          'b.id as batch_id',
          'b.batch_code',
          'b.production_date',
          'b.quantity_ml',
          'b.remaining_ml',
          'b.cost_per_ml',
          'b.status',
          'f.id as formula_id',
          'f.name as formula_name',
          'p.project_name'
        )
        .whereIn('b.formula_id', formulaIds)
        .orderBy('b.production_date', 'desc')

      if (batches.length === 0) {
        return {
          supply,
          summary: {
            used_in_formulas: formulas.length,
            used_in_batches: 0,
            used_in_bottlings: 0,
            customers_reached: 0
          },
          formulas,
          batches: [],
          bottlings: [],
          orders: [],
          message: 'Este insumo foi usado em fórmulas, mas ainda não foi produzido em lotes'
        }
      }

      const batchIds = batches.map(b => b.batch_id)

      // 4. Buscar em quais envases foi usado
      const bottlings = await db('bottling_batches as bb')
        .join('bottlings as bt', 'bt.id', 'bb.bottling_id')
        .join('batches as b', 'b.id', 'bb.batch_id')
        .select(
          'bt.id as bottling_id',
          'bt.bottling_code',
          'bt.product_name',
          'bt.quantity',
          'bt.volume_ml',
          'bt.bottling_date',
          'bb.ml_used',
          'b.batch_code'
        )
        .whereIn('bb.batch_id', batchIds)
        .orderBy('bt.bottling_date', 'desc')

      if (bottlings.length === 0) {
        return {
          supply,
          summary: {
            used_in_formulas: formulas.length,
            used_in_batches: batches.length,
            used_in_bottlings: 0,
            customers_reached: 0
          },
          formulas,
          batches,
          bottlings: [],
          orders: [],
          message: 'Este insumo foi usado em lotes, mas ainda não foi envasado'
        }
      }

      const bottlingIds = bottlings.map(b => b.bottling_id)

      // 5. Buscar pedidos que usaram esses envases
      const orders = await db('order_items as oi')
        .join('orders as o', 'o.id', 'oi.order_id')
        .leftJoin('customers as c', 'c.id', 'o.customer_id')
        .select(
          'o.id as order_id',
          'o.code as order_code',
          'o.status as order_status',
          'o.created_at as order_date',
          'oi.product_name',
          'oi.quantity',
          'oi.unit_price',
          'oi.bottling_id',
          'c.id as customer_id',
          'c.name as customer_name',
          'c.email as customer_email'
        )
        .whereIn('oi.bottling_id', bottlingIds)
        .orderBy('o.created_at', 'desc')

      // 6. Calcular quanto do insumo foi usado em cada fórmula
      const formulasWithUsage = formulas.map(formula => {
        const batchesOfFormula = batches.filter(b => b.formula_id === formula.formula_id)
        const totalMlProduced = batchesOfFormula.reduce((sum, b) => sum + parseFloat(b.quantity_ml), 0)
        const supplyMlUsed = (totalMlProduced * formula.percentage) / 100
        
        return {
          ...formula,
          batches_produced: batchesOfFormula.length,
          total_ml_produced: totalMlProduced,
          supply_ml_used: supplyMlUsed,
          supply_cost_in_formula: supplyMlUsed * parseFloat(supply.unit_cost)
        }
      })

      // 7. Calcular totais
      const totalMlUsed = formulasWithUsage.reduce((sum, f) => sum + f.supply_ml_used, 0)
      const totalCost = totalMlUsed * parseFloat(supply.unit_cost)
      const uniqueCustomers = new Set(orders.map(o => o.customer_id).filter(Boolean))

      return {
        supply: {
          ...supply,
          supplier: supply.supplier_name ? {
            id: supply.supplier_id,
            name: supply.supplier_name,
            contact: supply.supplier_contact,
            email: supply.supplier_email
          } : null
        },
        summary: {
          used_in_formulas: formulas.length,
          used_in_batches: batches.length,
          used_in_bottlings: bottlings.length,
          total_ml_used: totalMlUsed,
          total_cost_used: totalCost,
          units_produced: bottlings.reduce((sum, b) => sum + b.quantity, 0),
          units_sold: orders.reduce((sum, o) => sum + o.quantity, 0),
          customers_reached: uniqueCustomers.size,
          orders_fulfilled: orders.length
        },
        formulas: formulasWithUsage,
        batches,
        bottlings,
        orders: orders.length > 0 ? orders : null,
        traceability_complete: true,
        traced_at: new Date().toISOString()
      }
    } catch (error) {
      console.error('Erro na rastreabilidade insumo→destino:', error)
      throw error
    }
  }

  /**
   * Estatísticas de atividades
   */
  static async getActivityStats(days = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const stats = await db('activity_logs')
      .where('created_at', '>=', startDate)
      .select('activity_type')
      .count('* as count')
      .groupBy('activity_type')

    return stats
  }
}

module.exports = ActivityLogger