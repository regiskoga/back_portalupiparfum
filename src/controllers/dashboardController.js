const { db } = require('../models/db')
const { tickAutoFinishMaceration } = require('../services/macerationService')

// ─── DASHBOARD OVERVIEW ───────────────────────────────────────────────────────
async function getOverview(req, res) {
  try {
    await tickAutoFinishMaceration()

    // Busca limiar de estoque baixo primeiro (query leve, necessária para a próxima)
    const overviewParams = await db('parameters')
      .whereIn('key', ['low_stock_supply_warning'])
      .select('key', 'value')
    const overviewParamsMap = Object.fromEntries(overviewParams.map(r => [r.key, parseFloat(r.value)]))
    const overviewLowStockWarning = overviewParamsMap.low_stock_supply_warning ?? 100

    // Todas as demais queries em paralelo
    const [
      productionStats,
      bottlingStats,
      salesStats,
      batchesByStatus,
      readyForBottling,
      inMaceration,
      topProducts,
      lowStockSupplies,
      topCustomers,
    ] = await Promise.all([
      db('batches')
        .select(
          db.raw('COUNT(*) as total_batches'),
          db.raw('SUM(quantity_ml) as total_ml_produced'),
          db.raw('SUM(remaining_ml) as total_ml_remaining'),
          db.raw('SUM(total_cost) as total_production_cost')
        )
        .first(),

      db('bottlings')
        .select(
          db.raw('COUNT(*) as total_bottlings'),
          db.raw('SUM(quantity) as total_units_produced'),
          db.raw('SUM(total_cost) as total_bottling_cost')
        )
        .first(),

      db('orders')
        .where('status', '!=', 'Cancelled')
        .select(
          db.raw('COUNT(DISTINCT orders.id) as total_orders'),
          db.raw('SUM(oi.quantity * oi.unit_price) as total_revenue')
        )
        .leftJoin('order_items as oi', 'oi.order_id', 'orders.id')
        .first(),

      db('batches')
        .select('status')
        .count('* as count')
        .sum('remaining_ml as remaining_ml')
        .groupBy('status'),

      db('batches')
        .where('status', 'Pronto para envase')
        .where('remaining_ml', '>', 0)
        .count('* as count')
        .first(),

      db('batches')
        .where('status', 'Em maceração')
        .where('maceration_end', '>', db.fn.now())
        .count('* as count')
        .first(),

      db('products as p')
        .leftJoin('formulas as f', 'f.product_id', 'p.id')
        .leftJoin('batches as b', 'b.formula_id', 'f.id')
        .select(
          'p.id',
          'p.project_name',
          'p.commercial_name',
          db.raw('COUNT(b.id) as batch_count'),
          db.raw('SUM(b.quantity_ml) as total_ml_produced')
        )
        .groupBy('p.id', 'p.project_name', 'p.commercial_name')
        .orderBy('total_ml_produced', 'desc')
        .limit(5),

      db('supplies')
        .select('id', 'name', 'type', 'quantity_available', 'unit')
        .where('type', 'Essence')
        .where('quantity_available', '<', overviewLowStockWarning)
        .orderBy('quantity_available', 'asc')
        .limit(10),

      db('customers as c')
        .leftJoin('orders as o', 'o.customer_id', 'c.id')
        .select(
          'c.id',
          'c.name',
          db.raw('COUNT(o.id) as order_count'),
          db.raw('SUM(oi.quantity * oi.unit_price) as total_spent')
        )
        .leftJoin('order_items as oi', 'oi.order_id', 'o.id')
        .groupBy('c.id', 'c.name')
        .orderBy('total_spent', 'desc')
        .limit(5),
    ])

    res.json({
      production: {
        total_batches: parseInt(productionStats.total_batches || 0),
        total_ml_produced: parseFloat(productionStats.total_ml_produced || 0),
        total_ml_remaining: parseFloat(productionStats.total_ml_remaining || 0),
        total_production_cost: parseFloat(productionStats.total_production_cost || 0)
      },
      bottling: {
        total_bottlings: parseInt(bottlingStats.total_bottlings || 0),
        total_units_produced: parseInt(bottlingStats.total_units_produced || 0),
        total_bottling_cost: parseFloat(bottlingStats.total_bottling_cost || 0)
      },
      sales: {
        total_orders: parseInt(salesStats.total_orders || 0),
        total_revenue: parseFloat(salesStats.total_revenue || 0)
      },
      batches_by_status: batchesByStatus,
      ready_for_bottling: parseInt(readyForBottling.count || 0),
      in_maceration: parseInt(inMaceration.count || 0),
      top_products: topProducts,
      low_stock_supplies: lowStockSupplies,
      top_customers: topCustomers
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── FINANCIAL DASHBOARD ──────────────────────────────────────────────────────
async function getFinancialDashboard(req, res) {
  try {
    const { startDate, endDate } = req.query

    let bottlingQuery = db('bottlings')
    let orderQuery = db('orders')

    if (startDate) {
      bottlingQuery = bottlingQuery.where('bottling_date', '>=', startDate)
      orderQuery = orderQuery.where('created_at', '>=', startDate)
    }

    if (endDate) {
      bottlingQuery = bottlingQuery.where('bottling_date', '<=', endDate)
      orderQuery = orderQuery.where('created_at', '<=', endDate)
    }

    // Custos de produção
    const productionCosts = await db('batches')
      .select(
        db.raw('SUM(total_cost) as total_cost'),
        db.raw('AVG(cost_per_ml) as avg_cost_per_ml'),
        db.raw('MIN(cost_per_ml) as min_cost_per_ml'),
        db.raw('MAX(cost_per_ml) as max_cost_per_ml')
      )
      .first()

    // Custos de envase
    const bottlingCosts = await bottlingQuery
      .select(
        db.raw('SUM(total_cost) as total_cost'),
        db.raw('SUM(liquid_cost) as liquid_cost'),
        db.raw('SUM(bottle_cost) as bottle_cost'),
        db.raw('SUM(label_cost) as label_cost'),
        db.raw('AVG(unit_cost) as avg_unit_cost')
      )
      .first()

    // Receita de vendas
    const salesRevenue = await orderQuery
      .where('status', '!=', 'Cancelled')
      .select(
        db.raw('COUNT(DISTINCT orders.id) as total_orders'),
        db.raw('SUM(oi.quantity * oi.unit_price) as gross_revenue'),
        db.raw('SUM(DISTINCT orders.discount) as total_discounts'),
        db.raw('SUM(DISTINCT orders.shipping) as total_shipping')
      )
      .leftJoin('order_items as oi', 'oi.order_id', 'orders.id')
      .first()

    // Margem por produto
    const marginByProduct = await db('bottlings as bt')
      .select(
        'bt.product_name',
        db.raw('COUNT(*) as units_sold'),
        db.raw('SUM(bt.total_cost) as total_cost'),
        db.raw('AVG(bt.unit_cost) as avg_unit_cost')
      )
      .groupBy('bt.product_name')
      .orderBy('units_sold', 'desc')

    const netRevenue = parseFloat(salesRevenue.gross_revenue || 0) - parseFloat(salesRevenue.total_discounts || 0) + parseFloat(salesRevenue.total_shipping || 0)
    const totalCosts = parseFloat(productionCosts.total_cost || 0) + parseFloat(bottlingCosts.total_cost || 0)
    const profit = netRevenue - totalCosts
    const profitMargin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0

    res.json({
      period: {
        start_date: startDate || 'all',
        end_date: endDate || 'all'
      },
      production_costs: {
        total: parseFloat(productionCosts.total_cost || 0),
        avg_per_ml: parseFloat(productionCosts.avg_cost_per_ml || 0),
        min_per_ml: parseFloat(productionCosts.min_cost_per_ml || 0),
        max_per_ml: parseFloat(productionCosts.max_cost_per_ml || 0)
      },
      bottling_costs: {
        total: parseFloat(bottlingCosts.total_cost || 0),
        liquid: parseFloat(bottlingCosts.liquid_cost || 0),
        bottles: parseFloat(bottlingCosts.bottle_cost || 0),
        labels: parseFloat(bottlingCosts.label_cost || 0),
        avg_per_unit: parseFloat(bottlingCosts.avg_unit_cost || 0)
      },
      sales_revenue: {
        total_orders: parseInt(salesRevenue.total_orders || 0),
        gross_revenue: parseFloat(salesRevenue.gross_revenue || 0),
        total_discounts: parseFloat(salesRevenue.total_discounts || 0),
        total_shipping: parseFloat(salesRevenue.total_shipping || 0),
        net_revenue: netRevenue
      },
      profitability: {
        total_costs: totalCosts,
        profit: profit,
        profit_margin_percentage: profitMargin.toFixed(2)
      },
      margin_by_product: marginByProduct
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── PRODUCTION DASHBOARD ─────────────────────────────────────────────────────
async function getProductionDashboard(req, res) {
  try {
    // Lotes por status
    const batchesByStatus = await db('batches')
      .select('status')
      .count('* as count')
      .sum('quantity_ml as total_ml')
      .sum('remaining_ml as remaining_ml')
      .groupBy('status')

    // Fórmulas mais utilizadas
    const topFormulas = await db('formulas as f')
      .leftJoin('batches as b', 'b.formula_id', 'f.id')
      .select(
        'f.id',
        'f.name',
        db.raw('COUNT(b.id) as batch_count'),
        db.raw('SUM(b.quantity_ml) as total_ml_produced')
      )
      .groupBy('f.id', 'f.name')
      .orderBy('total_ml_produced', 'desc')
      .limit(10)

    // Consumo de insumos
    const supplyConsumption = await db('formula_items as fi')
      .join('supplies as s', 's.id', 'fi.supply_id')
      .select(
        's.id',
        's.name',
        's.type',
        db.raw('COUNT(DISTINCT fi.formula_id) as used_in_formulas'),
        db.raw('SUM(fi.percentage) as total_percentage_used')
      )
      .groupBy('s.id', 's.name', 's.type')
      .orderBy('total_percentage_used', 'desc')
      .limit(15)

    // Lotes prontos para envase
    const readyBatches = await db('batches as b')
      .join('formulas as f', 'f.id', 'b.formula_id')
      .join('products as p', 'p.id', 'f.product_id')
      .select(
        'b.id',
        'b.batch_code',
        'b.remaining_ml',
        'b.cost_per_ml',
        'f.name as formula_name',
        'p.project_name'
      )
      .where('b.status', 'Pronto para envase')
      .where('b.remaining_ml', '>', 0)
      .orderBy('b.production_date', 'asc')
      .limit(10)

    // Lotes em maceração com progresso
    const macerationBatches = await db('batches as b')
      .join('formulas as f', 'f.id', 'b.formula_id')
      .join('products as p', 'p.id', 'f.product_id')
      .select(
        'b.id',
        'b.batch_code',
        'b.maceration_start',
        'b.maceration_end',
        'f.name as formula_name',
        'p.project_name'
      )
      .where('b.status', 'Em maceração')
      .where('b.maceration_end', '>', db.fn.now())
      .orderBy('b.maceration_end', 'asc')

    res.json({
      batches_by_status: batchesByStatus,
      top_formulas: topFormulas,
      supply_consumption: supplyConsumption,
      ready_for_bottling: readyBatches,
      in_maceration: macerationBatches.map(b => ({
        ...b,
        days_remaining: Math.ceil((new Date(b.maceration_end) - new Date()) / (1000 * 60 * 60 * 24))
      }))
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── ALERTS DASHBOARD ─────────────────────────────────────────────────────────
async function getAlerts(req, res) {
  try {
    const paramsRows = await db('parameters').select('key', 'value')
    const p = Object.fromEntries(paramsRows.map(r => [r.key, parseFloat(r.value)]))

    const lowStockSupplyWarning   = p.low_stock_supply_warning   ?? 100
    const lowStockSupplyCritical  = p.low_stock_supply_critical  ?? 50
    const lowStockBatchMl         = p.low_stock_batch_ml         ?? 500
    const profitMarginMinPct      = p.profit_margin_minimum_pct  ?? 30
    const profitMarginWarningPct  = p.profit_margin_warning_pct  ?? 20
    const macerationAlertDays     = p.maceration_alert_days      ?? 3
    const criticalSupplyQty       = p.critical_supply_qty        ?? 200
    const criticalSupplyFormulas  = p.critical_supply_formulas_min ?? 3
    const highDemandOrdersMin     = p.high_demand_orders_min     ?? 5

    const alerts = []

    // 1. Essências com estoque abaixo do mínimo
    const lowStockSupplies = await db('supplies')
      .select('id', 'name', 'type', 'quantity_available', 'unit')
      .where('type', 'Essence')
      .where('quantity_available', '<', lowStockSupplyWarning)
      .orderBy('quantity_available', 'asc')

    lowStockSupplies.forEach(supply => {
      alerts.push({
        type: 'low_stock',
        severity: supply.quantity_available < lowStockSupplyCritical ? 'critical' : 'warning',
        title: 'Estoque baixo de essência',
        message: `${supply.name} está com apenas ${supply.quantity_available}${supply.unit} disponível`,
        entity_type: 'supply',
        entity_id: supply.id,
        action_required: 'Realizar compra de insumo'
      })
    })

    // 2. Produtos com alta demanda e estoque baixo
    const highDemandProducts = await db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .select(
        'oi.product_name',
        db.raw('COUNT(*) as order_count'),
        db.raw('SUM(oi.quantity) as total_quantity')
      )
      .where('o.created_at', '>=', db.raw("NOW() - INTERVAL '30 days'"))
      .where('o.status', '!=', 'Cancelled')
      .groupBy('oi.product_name')
      .having(db.raw('COUNT(*)'), '>=', highDemandOrdersMin)

    if (highDemandProducts.length > 0) {
      const productNames = highDemandProducts.map(p => p.product_name)
      const stockRows = await db('batches as b')
        .join('formulas as f', 'f.id', 'b.formula_id')
        .join('products as p', 'p.id', 'f.product_id')
        .whereIn('p.commercial_name', productNames)
        .where('b.status', 'Pronto para envase')
        .select('p.commercial_name', db.raw('COALESCE(SUM(b.remaining_ml), 0) as total_ml'))
        .groupBy('p.commercial_name')
      const stockByName = Object.fromEntries(stockRows.map(r => [r.commercial_name, parseFloat(r.total_ml)]))

      for (const product of highDemandProducts) {
        const totalMl = stockByName[product.product_name] || 0
        if (totalMl < lowStockBatchMl) {
          alerts.push({
            type: 'high_demand_low_stock',
            severity: totalMl === 0 ? 'critical' : 'warning',
            title: 'Produto com alta demanda e estoque baixo',
            message: `${product.product_name} teve ${product.order_count} pedidos nos últimos 30 dias, mas tem apenas ${totalMl}ml disponível`,
            entity_type: 'product',
            entity_name: product.product_name,
            action_required: 'Produzir novo lote'
          })
        }
      }
    }

    // 3. Sugestão de reprecificação
    const lowMarginProducts = await db('bottlings as bt')
      .leftJoin('order_items as oi', function() {
        this.on('oi.product_name', '=', 'bt.product_name')
      })
      .select(
        'bt.product_name',
        db.raw('AVG(bt.unit_cost) as avg_cost'),
        db.raw('AVG(oi.unit_price) as avg_price'),
        db.raw('COUNT(DISTINCT bt.id) as bottling_count')
      )
      .groupBy('bt.product_name')
      .havingRaw('AVG(oi.unit_price) IS NOT NULL')

    lowMarginProducts.forEach(product => {
      const margin = ((product.avg_price - product.avg_cost) / product.avg_price) * 100

      if (margin < profitMarginMinPct && margin > 0) {
        const suggestedPrice = product.avg_cost / (1 - profitMarginMinPct / 100)

        alerts.push({
          type: 'repricing_suggestion',
          severity: margin < profitMarginWarningPct ? 'warning' : 'info',
          title: 'Sugestão de reprecificação',
          message: `${product.product_name} está com margem de ${margin.toFixed(1)}% (abaixo de ${profitMarginMinPct}%)`,
          entity_type: 'product',
          entity_name: product.product_name,
          current_price: parseFloat(product.avg_price).toFixed(2),
          current_cost: parseFloat(product.avg_cost).toFixed(2),
          current_margin: margin.toFixed(2),
          suggested_price: suggestedPrice.toFixed(2),
          suggested_margin: profitMarginMinPct.toFixed(2),
          action_required: 'Considerar aumento de preço'
        })
      }
    })

    // 4. Lotes próximos de liberar da maceração
    const upcomingBatches = await db('batches as b')
      .join('formulas as f', 'f.id', 'b.formula_id')
      .join('products as p', 'p.id', 'f.product_id')
      .select(
        'b.id',
        'b.batch_code',
        'b.maceration_end',
        'p.project_name',
        'f.name as formula_name'
      )
      .where('b.status', 'Em maceração')
      .whereBetween('b.maceration_end', [
        db.fn.now(),
        db.raw(`NOW() + INTERVAL '${macerationAlertDays} days'`)
      ])
      .orderBy('b.maceration_end', 'asc')

    upcomingBatches.forEach(batch => {
      const daysRemaining = Math.ceil((new Date(batch.maceration_end) - new Date()) / (1000 * 60 * 60 * 24))
      
      alerts.push({
        type: 'maceration_ending',
        severity: 'info',
        title: 'Lote próximo de liberar',
        message: `Lote ${batch.batch_code} (${batch.project_name}) estará pronto em ${daysRemaining} dia(s)`,
        entity_type: 'batch',
        entity_id: batch.id,
        maceration_end: batch.maceration_end,
        days_remaining: daysRemaining,
        action_required: 'Preparar para envase'
      })
    })

    // 5. Insumos críticos com previsão de término
    const criticalSupplies = await db('supplies as s')
      .leftJoin('formula_items as fi', 'fi.supply_id', 's.id')
      .select(
        's.id',
        's.name',
        's.type',
        's.quantity_available',
        's.unit',
        db.raw('COUNT(DISTINCT fi.formula_id) as used_in_formulas'),
        db.raw('AVG(fi.percentage) as avg_usage_percentage')
      )
      .where('s.quantity_available', '<', criticalSupplyQty)
      .groupBy('s.id', 's.name', 's.type', 's.quantity_available', 's.unit')
      .havingRaw(`COUNT(DISTINCT fi.formula_id) >= ${criticalSupplyFormulas}`)

    criticalSupplies.forEach(supply => {
      alerts.push({
        type: 'critical_supply',
        severity: 'critical',
        title: 'Insumo crítico com estoque baixo',
        message: `${supply.name} é usado em ${supply.used_in_formulas} fórmulas e está com apenas ${supply.quantity_available}${supply.unit}`,
        entity_type: 'supply',
        entity_id: supply.id,
        action_required: 'Compra urgente necessária'
      })
    })

    // Ordenar alertas por severidade
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    res.json({
      total_alerts: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
      alerts
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── SALES DASHBOARD ──────────────────────────────────────────────────────────
async function getSalesDashboard(req, res) {
  try {
    const { startDate, endDate } = req.query

    let orderQuery = db('orders')
    
    if (startDate) {
      orderQuery = orderQuery.where('created_at', '>=', startDate)
    }
    
    if (endDate) {
      orderQuery = orderQuery.where('created_at', '<=', endDate)
    }

    // Top clientes por volume
    const topCustomersByVolume = await orderQuery.clone()
      .join('customers as c', 'c.id', 'orders.customer_id')
      .select(
        'c.id',
        'c.name',
        'c.email',
        db.raw('COUNT(orders.id) as order_count')
      )
      .where('orders.status', '!=', 'Cancelled')
      .groupBy('c.id', 'c.name', 'c.email')
      .orderBy('order_count', 'desc')
      .limit(10)

    // Top clientes por valor
    const topCustomersByValue = await orderQuery.clone()
      .join('customers as c', 'c.id', 'orders.customer_id')
      .join('order_items as oi', 'oi.order_id', 'orders.id')
      .select(
        'c.id',
        'c.name',
        'c.email',
        db.raw('COUNT(DISTINCT orders.id) as order_count'),
        db.raw('SUM(oi.quantity * oi.unit_price) as total_spent')
      )
      .where('orders.status', '!=', 'Cancelled')
      .groupBy('c.id', 'c.name', 'c.email')
      .orderBy('total_spent', 'desc')
      .limit(10)

    // Perfumes mais vendidos
    const topProducts = await orderQuery.clone()
      .join('order_items as oi', 'oi.order_id', 'orders.id')
      .select(
        'oi.product_name',
        db.raw('COUNT(*) as order_count'),
        db.raw('SUM(oi.quantity) as total_quantity'),
        db.raw('SUM(oi.quantity * oi.unit_price) as total_revenue')
      )
      .where('orders.status', '!=', 'Cancelled')
      .groupBy('oi.product_name')
      .orderBy('total_quantity', 'desc')
      .limit(10)

    // Volume vendido por tamanho de frasco
    const salesByBottleSize = await db('bottlings')
      .select(
        'volume_ml',
        db.raw('COUNT(*) as bottling_count'),
        db.raw('SUM(quantity) as total_units'),
        db.raw('SUM(quantity * volume_ml) as total_ml')
      )
      .groupBy('volume_ml')
      .orderBy('total_units', 'desc')

    // Vendas por período (últimos 12 meses)
    const salesByMonth = await db('orders')
      .join('order_items as oi', 'oi.order_id', 'orders.id')
      .select(
        db.raw("TO_CHAR(orders.created_at, 'YYYY-MM') as month"),
        db.raw('COUNT(DISTINCT orders.id) as order_count'),
        db.raw('SUM(oi.quantity) as units_sold'),
        db.raw('SUM(oi.quantity * oi.unit_price) as revenue')
      )
      .where('orders.created_at', '>=', db.raw("NOW() - INTERVAL '12 months'"))
      .where('orders.status', '!=', 'Cancelled')
      .groupBy('month')
      .orderBy('month', 'asc')

    res.json({
      period: {
        start_date: startDate || 'all',
        end_date: endDate || 'all'
      },
      top_customers_by_volume: topCustomersByVolume,
      top_customers_by_value: topCustomersByValue,
      top_products: topProducts,
      sales_by_bottle_size: salesByBottleSize,
      sales_by_month: salesByMonth
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── NOTIFICAÇÕES (sino do topo) ──────────────────────────────────────────────
// Diferente de /alerts, que devolve uma linha por item: aqui os avisos vêm
// AGRUPADOS por tipo, com contagem + amostra. Sem agrupar o sino seria
// inutilizável — só "essência abaixo do mínimo" dá 246 linhas hoje.
async function getNotifications (req, res) {
  try {
    const { essenceLabel } = require('../services/essenceName')
    const paramsRows = await db('parameters').select('key', 'value')
    const p = Object.fromEntries(paramsRows.map(r => [r.key, parseFloat(r.value)]))

    const bottleWarn = p.low_stock_bottle_warning  ?? 50
    const bottleCrit = p.low_stock_bottle_critical ?? 20
    const essWarn    = p.low_stock_supply_warning  ?? 100
    const essCrit    = p.low_stock_supply_critical ?? 50
    const macDays    = p.maceration_alert_days     ?? 3
    const staleDays  = p.order_stale_days          ?? 7
    const idleDays   = p.essence_idle_days         ?? 180

    const SAMPLE = 8
    const groups = []

    // ① Frascos com estoque baixo (não existia alerta nenhum para frasco)
    const bottles = await db('supplies')
      .where('type', 'Bottle')
      .where('quantity_available', '<', bottleWarn)
      .orderBy('quantity_available', 'asc')
      .select('id', 'name', 'quantity_available', 'unit')

    if (bottles.length > 0) {
      const crit = bottles.filter(b => parseFloat(b.quantity_available) < bottleCrit)
      groups.push({
        key: 'bottle_low_stock',
        severity: crit.length > 0 ? 'critical' : 'warning',
        title: 'Frascos com estoque baixo',
        count: bottles.length,
        summary: crit.length > 0
          ? `${crit.length} abaixo de ${bottleCrit} un.` +
            (bottles.length > crit.length ? ` · ${bottles.length - crit.length} abaixo de ${bottleWarn}` : '')
          : `${bottles.length} abaixo de ${bottleWarn} un.`,
        route: 'insumos',
        items: bottles.slice(0, SAMPLE).map(b => ({
          label: b.name,
          detail: `${parseFloat(b.quantity_available)} ${b.unit}`,
          severity: parseFloat(b.quantity_available) < bottleCrit ? 'critical' : 'warning',
        })),
      })
    }

    // ② Essências com estoque baixo (regra que já existia, agora agrupada).
    // Só as ABERTAS: essência já consumida e fechada não é "estoque baixo",
    // é estoque gasto — senão a lista começa com um monte de 0 ml.
    const essences = await db('supplies')
      .where('type', 'Essence')
      .where('is_open', true)
      .where('quantity_available', '<', essWarn)
      .orderBy('quantity_available', 'asc')
      .select('id', 'name', 'quantity_available', 'unit')

    if (essences.length > 0) {
      const crit = essences.filter(e => parseFloat(e.quantity_available) < essCrit)
      groups.push({
        key: 'essence_low_stock',
        severity: crit.length > 0 ? 'critical' : 'warning',
        title: 'Essências com estoque baixo',
        count: essences.length,
        summary: `${crit.length} abaixo de ${essCrit}ml · ${essences.length} abaixo de ${essWarn}ml`,
        route: 'essencias-estoque',
        items: essences.slice(0, SAMPLE).map(e => ({
          label: essenceLabel(e.name),
          detail: `${parseFloat(e.quantity_available)} ${e.unit}`,
          severity: parseFloat(e.quantity_available) < essCrit ? 'critical' : 'warning',
        })),
      })
    }

    // ③ Pedido parado na fila: confirmado há mais de N dias e ainda sem envase
    const staleOrders = await db('orders')
      .whereIn('status', ['Confirmed', 'In Production'])
      .whereRaw(`created_at < now() - (? || ' days')::interval`, [staleDays])
      .orderBy('created_at', 'asc')
      .select('id', 'code', 'created_at', 'status')

    if (staleOrders.length > 0) {
      const pendingRows = await db('order_items as oi')
        .leftJoin(
          db.raw('(SELECT order_item_id, SUM(quantity) AS linked FROM order_item_bottlings GROUP BY order_item_id) l'),
          'l.order_item_id', 'oi.id'
        )
        .whereIn('oi.order_id', staleOrders.map(o => o.id))
        .whereNotNull('oi.product_id')
        .groupBy('oi.order_id')
        .select('oi.order_id')
        .select(db.raw('SUM(GREATEST(0, oi.quantity - COALESCE(l.linked, 0))) AS pending'))

      const pendingByOrder = Object.fromEntries(pendingRows.map(r => [r.order_id, parseInt(r.pending)]))
      const travados = staleOrders.filter(o => (pendingByOrder[o.id] || 0) > 0)

      if (travados.length > 0) {
        groups.push({
          key: 'order_stale',
          severity: 'warning',
          title: 'Pedidos parados na fila',
          count: travados.length,
          summary: `sem envase completo há mais de ${staleDays} dias`,
          route: 'producao',
          items: travados.slice(0, SAMPLE).map(o => {
            const dias = Math.floor((Date.now() - new Date(o.created_at)) / 86400000)
            return {
              label: o.code,
              detail: `há ${dias} dias · faltam ${pendingByOrder[o.id]} un.`,
              severity: 'warning',
            }
          }),
        })
      }
    }

    // ④ Maceração terminando nos próximos dias
    const macerando = await db('batches as b')
      .leftJoin('products as p', 'p.id', 'b.product_id')
      .where('b.status', 'Em maceração')
      .whereNotNull('b.maceration_end')
      .where('b.maceration_end', '>', db.fn.now())
      .whereRaw(`b.maceration_end <= now() + (? || ' days')::interval`, [macDays])
      .orderBy('b.maceration_end', 'asc')
      .select('b.id', 'b.batch_code', 'b.reduced_lot_number', 'b.maceration_end', 'p.project_name')

    if (macerando.length > 0) {
      groups.push({
        key: 'maceration_ending',
        severity: 'info',
        title: 'Maceração terminando',
        count: macerando.length,
        summary: `nos próximos ${macDays} dias`,
        route: 'acompanhamento-maceracao',
        items: macerando.slice(0, SAMPLE).map(b => {
          const dias = Math.ceil((new Date(b.maceration_end) - Date.now()) / 86400000)
          return {
            label: `${b.project_name || b.batch_code}${b.reduced_lot_number ? ` [Lote ${b.reduced_lot_number}]` : ''}`,
            detail: dias <= 0 ? 'hoje' : `em ${dias} dia${dias > 1 ? 's' : ''}`,
            severity: 'info',
          }
        }),
      })
    }

    // ⑤ Essência comprada há muito tempo e nunca usada (dinheiro parado)
    const idle = await db('supplies')
      .where('type', 'Essence')
      .whereRaw('quantity_available >= quantity_purchased')
      .whereNotNull('purchase_date')
      .whereRaw(`purchase_date < now() - (? || ' days')::interval`, [idleDays])
      .orderBy('purchase_date', 'asc')
      .select('id', 'name', 'purchase_date', 'quantity_available', 'unit')

    if (idle.length > 0) {
      groups.push({
        key: 'essence_idle',
        severity: 'info',
        title: 'Essências paradas',
        count: idle.length,
        summary: `compradas há mais de ${idleDays} dias e nunca usadas`,
        route: 'essencias-estoque',
        items: idle.slice(0, SAMPLE).map(e => {
          const dias = Math.floor((Date.now() - new Date(e.purchase_date)) / 86400000)
          return {
            label: essenceLabel(e.name),
            detail: `${parseFloat(e.quantity_available)} ${e.unit} · há ${dias} dias`,
            severity: 'info',
          }
        }),
      })
    }

    res.json({
      generated_at: new Date().toISOString(),
      // Contagem do sino = nº de GRUPOS, não de itens: o selo precisa ser legível.
      badge:    groups.length,
      critical: groups.filter(g => g.severity === 'critical').length,
      warning:  groups.filter(g => g.severity === 'warning').length,
      groups,
    })
  } catch (error) {
    console.error('Error building notifications:', error)
    res.status(500).json({ error: error.message })
  }
}

module.exports = {
  getOverview,
  getFinancialDashboard,
  getProductionDashboard,
  getAlerts,
  getNotifications,
  getSalesDashboard
}