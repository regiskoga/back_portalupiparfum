const { db } = require('../models/db')

// ═══════════════════════════════════════════════════════════════════════════════
// RASTREABILIDADE TOTAL - PROMPT #12
// ═══════════════════════════════════════════════════════════════════════════════

// ─── RASTREABILIDADE: FRASCO → ORIGEM ─────────────────────────────────────────
async function traceBottlingToOrigin(req, res) {
  try {
    const { bottling_id } = req.params
    
    console.log(`🔍 Iniciando rastreabilidade: Frasco ${bottling_id} → Origem`)
    
    // 1. Buscar dados do envase
    const bottling = await db('bottlings as bt')
      .leftJoin('products as p', 'bt.product_id', 'p.id')
      .select(
        'bt.*',
        'p.project_name',
        'p.commercial_name',
        'p.brand_inspiration',
        'p.name_inspiration'
      )
      .where('bt.id', parseInt(bottling_id))
      .first()
    
    if (!bottling) {
      return res.status(404).json({ error: 'Envase não encontrado' })
    }
    
    // 2. Buscar lote(s) utilizados no envase
    const batchIds = JSON.parse(bottling.batch_ids || '[]')
    const batches = await db('batches as b')
      .leftJoin('formulas as f', 'b.formula_id', 'f.id')
      .leftJoin('products as p', 'f.product_id', 'p.id')
      .select(
        'b.*',
        'f.id as formula_id',
        'f.name as formula_name',
        'p.project_name as product_name'
      )
      .whereIn('b.id', batchIds)
    
    // 3. Buscar fórmula(s) e insumos utilizados
    const formulaIds = [...new Set(batches.map(b => b.formula_id))]
    const formulaItems = await db('formula_items as fi')
      .join('supplies as s', 'fi.supply_id', 's.id')
      .leftJoin('suppliers as sup', 's.supplier_id', 'sup.id')
      .select(
        'fi.*',
        's.name as supply_name',
        's.type as supply_type',
        's.unit as supply_unit',
        's.unit_cost',
        'sup.id as supplier_id',
        'sup.name as supplier_name',
        'sup.document as supplier_document'
      )
      .whereIn('fi.formula_id', formulaIds)
      .orderBy('fi.percentage', 'desc')
    
    // 4. Buscar fornecedores únicos
    const supplierIds = [...new Set(formulaItems.map(fi => fi.supplier_id).filter(Boolean))]
    const suppliers = await db('suppliers')
      .select('*')
      .whereIn('id', supplierIds)
    
    // 5. Buscar pedidos que utilizaram este envase
    const orders = await db('order_items as oi')
      .join('orders as o', 'oi.order_id', 'o.id')
      .leftJoin('customers as c', 'o.customer_id', 'c.id')
      .select(
        'o.id as order_id',
        'o.code as order_code',
        'o.status as order_status',
        'o.created_at as order_date',
        'oi.quantity as quantity_sold',
        'oi.unit_price',
        'c.id as customer_id',
        'c.name as customer_name',
        'c.email as customer_email',
        'c.phone as customer_phone'
      )
      .where('oi.bottling_id', parseInt(bottling_id))
      .orderBy('o.created_at', 'desc')
    
    // 6. Buscar logs de movimentação relacionados
    const logs = await db('activity_logs')
      .where(function() {
        this.where('entity_type', 'bottling').where('entity_id', parseInt(bottling_id))
          .orWhere('entity_type', 'batch').whereIn('entity_id', batchIds)
      })
      .orderBy('created_at', 'desc')
      .limit(50)
    
    // 7. Calcular custos e margens
    const totalSupplyCost = formulaItems.reduce((sum, item) => {
      const batchQuantity = batches.reduce((total, batch) => total + parseFloat(batch.quantity_produced_ml || 0), 0)
      const itemCostPerMl = (parseFloat(item.unit_cost || 0) * parseFloat(item.percentage || 0)) / 100
      return sum + (itemCostPerMl * parseFloat(bottling.volume_ml || 0))
    }, 0)
    
    const totalBottlingCost = parseFloat(bottling.total_cost || 0)
    const averageSalePrice = orders.length > 0 
      ? orders.reduce((sum, o) => sum + parseFloat(o.unit_price || 0), 0) / orders.length 
      : 0
    
    // 8. Estruturar resposta completa
    const traceabilityData = {
      // Dados do produto final
      bottling: {
        ...bottling,
        volume_ml: parseFloat(bottling.volume_ml || 0),
        quantity_produced: parseInt(bottling.quantity_produced || 0),
        total_cost: parseFloat(bottling.total_cost || 0),
        cost_per_unit: parseFloat(bottling.cost_per_unit || 0)
      },
      
      // Lotes de origem
      batches: batches.map(batch => ({
        ...batch,
        quantity_produced_ml: parseFloat(batch.quantity_produced_ml || 0),
        total_cost: parseFloat(batch.total_cost || 0),
        cost_per_ml: parseFloat(batch.cost_per_ml || 0),
        maceration_start: batch.maceration_start,
        maceration_release: batch.maceration_release
      })),
      
      // Fórmulas e insumos
      formula_composition: formulaItems.map(item => ({
        supply_name: item.supply_name,
        supply_type: item.supply_type,
        percentage: parseFloat(item.percentage || 0),
        unit_cost: parseFloat(item.unit_cost || 0),
        supplier_name: item.supplier_name,
        supplier_document: item.supplier_document,
        cost_contribution: (parseFloat(item.unit_cost || 0) * parseFloat(item.percentage || 0)) / 100
      })),
      
      // Fornecedores
      suppliers: suppliers,
      
      // Vendas realizadas
      sales: orders.map(order => ({
        ...order,
        quantity_sold: parseInt(order.quantity_sold || 0),
        unit_price: parseFloat(order.unit_price || 0),
        total_value: parseInt(order.quantity_sold || 0) * parseFloat(order.unit_price || 0)
      })),
      
      // Histórico de movimentações
      activity_logs: logs,
      
      // Análise financeira
      cost_analysis: {
        supply_cost_per_unit: totalSupplyCost,
        total_production_cost: totalBottlingCost,
        average_sale_price: averageSalePrice,
        margin_per_unit: averageSalePrice - totalBottlingCost,
        margin_percentage: averageSalePrice > 0 ? ((averageSalePrice - totalBottlingCost) / averageSalePrice) * 100 : 0,
        total_units_sold: orders.reduce((sum, o) => sum + parseInt(o.quantity_sold || 0), 0),
        total_revenue: orders.reduce((sum, o) => sum + (parseInt(o.quantity_sold || 0) * parseFloat(o.unit_price || 0)), 0)
      },
      
      // Metadados da consulta
      trace_metadata: {
        bottling_id: parseInt(bottling_id),
        traced_at: new Date().toISOString(),
        batches_count: batches.length,
        supplies_count: formulaItems.length,
        suppliers_count: suppliers.length,
        orders_count: orders.length,
        logs_count: logs.length
      }
    }
    
    console.log(`✅ Rastreabilidade completa: ${batches.length} lotes, ${formulaItems.length} insumos, ${suppliers.length} fornecedores, ${orders.length} vendas`)
    
    res.json(traceabilityData)
    
  } catch (error) {
    console.error('❌ Erro na rastreabilidade frasco→origem:', error)
    res.status(500).json({ error: error.message })
  }
}

// ─── RASTREABILIDADE: INSUMO → DESTINO ────────────────────────────────────────
async function traceSupplyToDestination(req, res) {
  try {
    const { supply_id } = req.params
    
    console.log(`🔍 Iniciando rastreabilidade: Insumo ${supply_id} → Destino`)
    
    // 1. Buscar dados do insumo
    const supply = await db('supplies as s')
      .leftJoin('suppliers as sup', 's.supplier_id', 'sup.id')
      .select(
        's.*',
        'sup.name as supplier_name',
        'sup.document as supplier_document',
        'sup.contact as supplier_contact'
      )
      .where('s.id', parseInt(supply_id))
      .first()
    
    if (!supply) {
      return res.status(404).json({ error: 'Insumo não encontrado' })
    }
    
    // 2. Buscar fórmulas que utilizam este insumo
    const formulas = await db('formula_items as fi')
      .join('formulas as f', 'fi.formula_id', 'f.id')
      .join('products as p', 'f.product_id', 'p.id')
      .select(
        'f.id as formula_id',
        'f.name as formula_name',
        'p.id as product_id',
        'p.project_name',
        'p.commercial_name',
        'fi.percentage',
        'fi.notes as formula_notes'
      )
      .where('fi.supply_id', parseInt(supply_id))
      .orderBy('fi.percentage', 'desc')
    
    // 3. Buscar lotes produzidos com essas fórmulas
    const formulaIds = formulas.map(f => f.formula_id)
    const batches = await db('batches as b')
      .join('formulas as f', 'b.formula_id', 'f.id')
      .join('products as p', 'f.product_id', 'p.id')
      .select(
        'b.*',
        'f.name as formula_name',
        'p.project_name as product_name'
      )
      .whereIn('b.formula_id', formulaIds)
      .orderBy('b.created_at', 'desc')
    
    // 4. Buscar envases feitos com esses lotes
    const batchIds = batches.map(b => b.id)
    const bottlings = await db('bottlings as bt')
      .leftJoin('products as p', 'bt.product_id', 'p.id')
      .select(
        'bt.*',
        'p.project_name',
        'p.commercial_name'
      )
      .where(function() {
        batchIds.forEach(batchId => {
          this.orWhereRaw(`JSON_EXTRACT(bt.batch_ids, '$') LIKE '%${batchId}%'`)
        })
      })
      .orderBy('bt.created_at', 'desc')
    
    // 5. Buscar pedidos que compraram esses produtos
    const bottlingIds = bottlings.map(bt => bt.id)
    const orders = await db('order_items as oi')
      .join('orders as o', 'oi.order_id', 'o.id')
      .join('customers as c', 'o.customer_id', 'c.id')
      .select(
        'o.id as order_id',
        'o.code as order_code',
        'o.status as order_status',
        'o.created_at as order_date',
        'oi.bottling_id',
        'oi.quantity as quantity_sold',
        'oi.unit_price',
        'c.id as customer_id',
        'c.name as customer_name',
        'c.email as customer_email',
        'c.phone as customer_phone'
      )
      .whereIn('oi.bottling_id', bottlingIds)
      .orderBy('o.created_at', 'desc')
    
    // 6. Buscar logs de movimentação do insumo
    const logs = await db('activity_logs')
      .where(function() {
        this.where('entity_type', 'supply').where('entity_id', parseInt(supply_id))
          .orWhere('entity_type', 'batch').whereIn('entity_id', batchIds)
          .orWhere('entity_type', 'bottling').whereIn('entity_id', bottlingIds)
      })
      .orderBy('created_at', 'desc')
      .limit(100)
    
    // 7. Calcular consumo e impacto
    const totalQuantityUsed = batches.reduce((sum, batch) => {
      const formula = formulas.find(f => f.formula_id === batch.formula_id)
      if (formula) {
        const quantityInBatch = (parseFloat(batch.quantity_produced_ml || 0) * parseFloat(formula.percentage || 0)) / 100
        return sum + quantityInBatch
      }
      return sum
    }, 0)
    
    const totalUnitsProduced = bottlings.reduce((sum, bt) => sum + parseInt(bt.quantity_produced || 0), 0)
    const totalUnitsSold = orders.reduce((sum, o) => sum + parseInt(o.quantity_sold || 0), 0)
    const totalRevenue = orders.reduce((sum, o) => sum + (parseInt(o.quantity_sold || 0) * parseFloat(o.unit_price || 0)), 0)
    
    // 8. Agrupar clientes únicos
    const uniqueCustomers = orders.reduce((acc, order) => {
      if (!acc.find(c => c.customer_id === order.customer_id)) {
        acc.push({
          customer_id: order.customer_id,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          customer_phone: order.customer_phone,
          orders_count: orders.filter(o => o.customer_id === order.customer_id).length,
          total_quantity: orders.filter(o => o.customer_id === order.customer_id)
            .reduce((sum, o) => sum + parseInt(o.quantity_sold || 0), 0)
        })
      }
      return acc
    }, [])
    
    // 9. Estruturar resposta completa
    const traceabilityData = {
      // Dados do insumo
      supply: {
        ...supply,
        quantity_purchased: parseFloat(supply.quantity_purchased || 0),
        quantity_available: parseFloat(supply.quantity_available || 0),
        unit_cost: parseFloat(supply.unit_cost || 0),
        total_cost: parseFloat(supply.total_cost || 0)
      },
      
      // Fórmulas que utilizam o insumo
      formulas_using_supply: formulas.map(formula => ({
        ...formula,
        percentage: parseFloat(formula.percentage || 0)
      })),
      
      // Lotes produzidos
      batches_produced: batches.map(batch => ({
        ...batch,
        quantity_produced_ml: parseFloat(batch.quantity_produced_ml || 0),
        supply_quantity_used: (parseFloat(batch.quantity_produced_ml || 0) * 
          parseFloat(formulas.find(f => f.formula_id === batch.formula_id)?.percentage || 0)) / 100
      })),
      
      // Produtos envasados
      bottlings_created: bottlings.map(bottling => ({
        ...bottling,
        quantity_produced: parseInt(bottling.quantity_produced || 0),
        volume_ml: parseFloat(bottling.volume_ml || 0)
      })),
      
      // Vendas realizadas
      sales_made: orders.map(order => ({
        ...order,
        quantity_sold: parseInt(order.quantity_sold || 0),
        unit_price: parseFloat(order.unit_price || 0),
        total_value: parseInt(order.quantity_sold || 0) * parseFloat(order.unit_price || 0)
      })),
      
      // Clientes que receberam produtos
      customers_reached: uniqueCustomers,
      
      // Histórico de movimentações
      activity_logs: logs,
      
      // Análise de impacto
      impact_analysis: {
        total_quantity_used_ml: totalQuantityUsed,
        quantity_remaining: parseFloat(supply.quantity_available || 0),
        utilization_percentage: parseFloat(supply.quantity_purchased || 0) > 0 
          ? ((parseFloat(supply.quantity_purchased || 0) - parseFloat(supply.quantity_available || 0)) / parseFloat(supply.quantity_purchased || 0)) * 100 
          : 0,
        formulas_count: formulas.length,
        batches_count: batches.length,
        bottlings_count: bottlings.length,
        total_units_produced: totalUnitsProduced,
        total_units_sold: totalUnitsSold,
        customers_reached: uniqueCustomers.length,
        total_revenue_generated: totalRevenue,
        revenue_per_ml_supply: totalQuantityUsed > 0 ? totalRevenue / totalQuantityUsed : 0
      },
      
      // Metadados da consulta
      trace_metadata: {
        supply_id: parseInt(supply_id),
        traced_at: new Date().toISOString(),
        formulas_count: formulas.length,
        batches_count: batches.length,
        bottlings_count: bottlings.length,
        orders_count: orders.length,
        customers_count: uniqueCustomers.length,
        logs_count: logs.length
      }
    }
    
    console.log(`✅ Rastreabilidade completa: ${formulas.length} fórmulas, ${batches.length} lotes, ${bottlings.length} envases, ${orders.length} vendas, ${uniqueCustomers.length} clientes`)
    
    res.json(traceabilityData)
    
  } catch (error) {
    console.error('❌ Erro na rastreabilidade insumo→destino:', error)
    res.status(500).json({ error: error.message })
  }
}

// ─── BUSCAR LOGS POR ENTIDADE ─────────────────────────────────────────────────
async function getEntityLogs(req, res) {
  try {
    const { entity_type, entity_id } = req.params
    const { limit = 50, offset = 0 } = req.query
    
    const logs = await db('activity_logs')
      .where({ entity_type, entity_id: parseInt(entity_id) })
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
    
    const total = await db('activity_logs')
      .where({ entity_type, entity_id: parseInt(entity_id) })
      .count('* as count')
      .first()
    
    res.json({
      data: logs,
      pagination: {
        total: parseInt(total.count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(parseInt(total.count) / parseInt(limit))
      }
    })
    
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── BUSCAR CADEIA COMPLETA ───────────────────────────────────────────────────
async function getFullChain(req, res) {
  try {
    const { type, id } = req.params
    
    let result = {}
    
    if (type === 'bottling') {
      // Começar do envase e ir para origem
      const bottlingTrace = await traceBottlingToOrigin({ params: { bottling_id: id } }, { json: (data) => data })
      result = { direction: 'bottling_to_origin', ...bottlingTrace }
      
    } else if (type === 'supply') {
      // Começar do insumo e ir para destino
      const supplyTrace = await traceSupplyToDestination({ params: { supply_id: id } }, { json: (data) => data })
      result = { direction: 'supply_to_destination', ...supplyTrace }
      
    } else {
      return res.status(400).json({ error: 'Tipo deve ser "bottling" ou "supply"' })
    }
    
    res.json(result)
    
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports = {
  traceBottlingToOrigin,
  traceSupplyToDestination,
  getEntityLogs,
  getFullChain
}