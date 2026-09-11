const { db } = require('../models/db')
const { parseEssenceName } = require('../services/essenceName')

// Venda de fato = do Confirmado em diante. Pendente é pré-pedido que ainda pode
// não virar venda; Cancelado, Abandonado e Perdido não são venda.
const SOLD_STATUSES = ['Confirmed', 'In Production', 'Ready', 'Shipped', 'Delivered']

// Volumes que ganham coluna própria no ranking; o resto soma em "outros".
const VOLUME_COLUMNS = [15, 30, 50, 100]

// Arredonda antes de sair do backend: somar centavos em ponto flutuante produz
// 12662.799999999967 e -0.00, que a tela exibiria cru.
const money = v => Math.round(((Number(v) || 0) + Number.EPSILON) * 100) / 100

const norm = s => (s == null ? '' : String(s))
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function periodFilter (query, col, { start, end }) {
  if (start) query = query.where(col, '>=', start)
  if (end)   query = query.where(col, '<=', `${end} 23:59:59`)
  return query
}

// ─── ESSÊNCIA DO PROJETO ──────────────────────────────────────────────────────
// Não existe vínculo formal entre essência e projeto. Duas fontes, nesta ordem:
//   'lote'       → essências realmente consumidas em lotes daquele projeto (certo)
//   'inspiracao' → nome da essência casa com a inspiração do projeto (estimativa)
// A origem viaja junto com o número para a tela poder marcar o que é estimativa.
async function buildEssenceIndex () {
  const essencias = await db('supplies')
    .where('type', 'Essence')
    .select('id', 'name', 'quantity_available')

  const porMarcaNome = new Map()
  const porNome      = new Map()
  for (const e of essencias) {
    const { brand, essence } = parseEssenceName(e.name)
    if (!essence) continue
    const push = (map, key) => {
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e)
    }
    if (brand) push(porMarcaNome, `${norm(brand)}|${norm(essence)}`)
    push(porNome, norm(essence))
  }

  // Vínculo certo: supply_ids que já entraram em lote de cada produto
  const usadas = await db('batch_essences as be')
    .join('batches as b', 'b.id', 'be.batch_id')
    .whereNotNull('b.product_id')
    .groupBy('b.product_id', 'be.supply_id')
    .select('b.product_id', 'be.supply_id')

  const porProduto = new Map()
  for (const r of usadas) {
    if (!porProduto.has(r.product_id)) porProduto.set(r.product_id, [])
    porProduto.get(r.product_id).push(r.supply_id)
  }
  const saldo = Object.fromEntries(essencias.map(e => [e.id, parseFloat(e.quantity_available || 0)]))

  return function essenceFor (product) {
    const ids = porProduto.get(product.id)
    if (ids && ids.length > 0) {
      return {
        essence_ml:     ids.reduce((s, id) => s + (saldo[id] || 0), 0),
        essence_source: 'lote',
        essence_count:  ids.length,
      }
    }
    const chave = `${norm(product.inspiration_brand)}|${norm(product.inspiration_name)}`
    const lista = porMarcaNome.get(chave) || porNome.get(norm(product.inspiration_name))
    if (lista && lista.length > 0) {
      return {
        essence_ml:     lista.reduce((s, e) => s + parseFloat(e.quantity_available || 0), 0),
        essence_source: 'inspiracao',
        essence_count:  lista.length,
      }
    }
    return { essence_ml: null, essence_source: null, essence_count: 0 }
  }
}

// ─── ESTOQUE POR PRODUTO ──────────────────────────────────────────────────────
// Duas naturezas diferentes, não somáveis: líquido em lote (ml) e frasco já
// envasado e disponível (unidades).
async function buildStockIndex () {
  const lotes = await db('batches')
    .whereNotNull('product_id')
    .whereNot('status', 'Finalizado')
    .where('remaining_ml', '>', 0)
    .groupBy('product_id')
    .select('product_id')
    .sum('remaining_ml as ml')
    .count('* as lotes')

  // bottlings liga a products por SKU (product_ref). Agrupado ANTES do join para
  // não multiplicar o estoque pelo nº de itens de pedido do produto.
  const envases = await db('bottlings')
    .whereNotNull('product_ref')
    .where('quantity_available', '>', 0)
    .groupBy('product_ref')
    .select('product_ref')
    .sum('quantity_available as un')

  const mlPorProduto = Object.fromEntries(lotes.map(r => [r.product_id, {
    ml: parseFloat(r.ml || 0), lotes: parseInt(r.lotes || 0),
  }]))
  const unPorSku = Object.fromEntries(envases.map(r => [r.product_ref, parseInt(r.un || 0)]))

  return function stockFor (product) {
    const l = mlPorProduto[product.id] || { ml: 0, lotes: 0 }
    return {
      stock_ml:      l.ml,
      stock_batches: l.lotes,
      ready_units:   product.sku ? (unPorSku[product.sku] || 0) : 0,
    }
  }
}

// ─── 1. PERFUMES MAIS VENDIDOS ────────────────────────────────────────────────
exports.topProducts = async (req, res) => {
  try {
    const { start, end } = req.query

    let q = db('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .whereIn('o.status', SOLD_STATUSES)
      .whereNotNull('oi.product_id')
      .groupBy('oi.product_id', 'oi.volume_ml')
      .select('oi.product_id', 'oi.volume_ml')
      .sum('oi.quantity as un')
      .select(db.raw('SUM(oi.quantity * oi.unit_price) AS receita'))
    q = periodFilter(q, 'o.created_at', { start, end })
    const vendas = await q

    if (vendas.length === 0) return res.json({ data: [], volumes: VOLUME_COLUMNS, totals: null })

    const ids = [...new Set(vendas.map(v => v.product_id))]
    const produtos = await db('products').whereIn('id', ids)
      .select('id', 'project_name', 'commercial_name', 'inspiration_brand', 'inspiration_name', 'sku')
    const porId = Object.fromEntries(produtos.map(p => [p.id, p]))

    const [essenceFor, stockFor] = await Promise.all([buildEssenceIndex(), buildStockIndex()])

    const linhas = new Map()
    for (const v of vendas) {
      const p = porId[v.product_id]
      if (!p) continue
      let row = linhas.get(v.product_id)
      if (!row) {
        row = {
          product_id:        p.id,
          project_name:      p.project_name,
          commercial_name:   p.commercial_name,
          inspiration_brand: p.inspiration_brand,
          inspiration_name:  p.inspiration_name,
          by_volume:         {},
          other_units:       0,
          units:             0,
          ml_sold:           0,
          revenue:           0,
          ...stockFor(p),
          ...essenceFor(p),
        }
        linhas.set(v.product_id, row)
      }
      const vol = parseFloat(v.volume_ml)
      const un  = parseInt(v.un || 0)
      if (VOLUME_COLUMNS.includes(vol)) row.by_volume[vol] = (row.by_volume[vol] || 0) + un
      else row.other_units += un
      row.units   += un
      row.ml_sold += un * vol
      row.revenue += parseFloat(v.receita || 0)
    }

    const data = [...linhas.values()]
      .sort((a, b) => b.units - a.units || b.ml_sold - a.ml_sold)
      .map((r, i) => ({
        ...r,
        rank:       i + 1,
        revenue:    money(r.revenue),
        stock_ml:   money(r.stock_ml),
        essence_ml: r.essence_ml == null ? null : money(r.essence_ml),
      }))

    res.json({
      data,
      volumes: VOLUME_COLUMNS,
      totals: {
        produtos: data.length,
        units:    data.reduce((s, r) => s + r.units, 0),
        ml_sold:  data.reduce((s, r) => s + r.ml_sold, 0),
        revenue:  money(data.reduce((s, r) => s + r.revenue, 0)),
      },
    })
  } catch (e) {
    console.error('Error building top products report:', e)
    res.status(500).json({ error: e.message })
  }
}

// ─── 2. MAIORES CLIENTES ──────────────────────────────────────────────────────
exports.topCustomers = async (req, res) => {
  try {
    const { start, end } = req.query

    let q = db('orders as o')
      .leftJoin('customers as c', 'c.id', 'o.customer_id')
      .whereIn('o.status', SOLD_STATUSES)
      .select(
        'o.id', 'o.code', 'o.status', 'o.created_at', 'o.customer_id',
        'o.discount', 'o.coupon_discount', 'o.shipping',
        'o.amount_paid', 'o.payment_date', 'o.payment_method',
        'c.name as customer_name', 'c.phone as customer_phone'
      )
    q = periodFilter(q, 'o.created_at', { start, end })
    const pedidos = await q

    if (pedidos.length === 0) return res.json({ data: [], totals: null })

    // Subtotal por pedido = Σ preço × qtd dos itens (mesma conta do resumo do pedido)
    const subtotais = await db('order_items')
      .whereIn('order_id', pedidos.map(p => p.id))
      .groupBy('order_id')
      .select('order_id')
      .select(db.raw('SUM(quantity * unit_price) AS subtotal'))
    const subtotalPorPedido = Object.fromEntries(
      subtotais.map(r => [r.order_id, parseFloat(r.subtotal || 0)]))

    const clientes = new Map()
    for (const p of pedidos) {
      const subtotal = subtotalPorPedido[p.id] || 0
      const total = subtotal
        - parseFloat(p.discount || 0)
        - parseFloat(p.coupon_discount || 0)
        + parseFloat(p.shipping || 0)
      const pago = p.amount_paid == null ? null : parseFloat(p.amount_paid)

      const key = p.customer_id || 0
      let c = clientes.get(key)
      if (!c) {
        c = {
          customer_id:    p.customer_id,
          customer_name:  p.customer_name || 'Cliente não informado',
          customer_phone: p.customer_phone || null,
          orders:         0,
          total:          0,
          paid:           0,
          unpaid_orders:  0,
          last_order:     null,
          order_list:     [],
        }
        clientes.set(key, c)
      }
      c.orders += 1
      c.total  += total
      c.paid   += pago || 0
      if (pago == null) c.unpaid_orders += 1
      if (!c.last_order || new Date(p.created_at) > new Date(c.last_order)) c.last_order = p.created_at
      c.order_list.push({
        id: p.id, code: p.code, status: p.status, created_at: p.created_at,
        total, paid: pago, payment_method: p.payment_method, payment_date: p.payment_date,
      })
    }

    const data = [...clientes.values()]
      .map(c => ({
        ...c,
        total:       money(c.total),
        paid:        money(c.paid),
        open_amount: money(c.total - c.paid),
        avg_ticket:  money(c.orders > 0 ? c.total / c.orders : 0),
        order_list:  c.order_list
          .map(o => ({ ...o, total: money(o.total), paid: o.paid == null ? null : money(o.paid) }))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      }))
      .sort((a, b) => b.paid - a.paid || b.total - a.total)
      .map((c, i) => ({ ...c, rank: i + 1 }))

    res.json({
      data,
      totals: {
        clientes:    data.length,
        orders:      data.reduce((s, c) => s + c.orders, 0),
        total:       money(data.reduce((s, c) => s + c.total, 0)),
        paid:        money(data.reduce((s, c) => s + c.paid, 0)),
        open_amount: money(data.reduce((s, c) => s + c.open_amount, 0)),
      },
    })
  } catch (e) {
    console.error('Error building top customers report:', e)
    res.status(500).json({ error: e.message })
  }
}

// ─── 3. LISTA RÁPIDA DE ESTOQUE ───────────────────────────────────────────────
exports.stockOverview = async (req, res) => {
  try {
    const lotes = await db('batches as b')
      .join('products as p', 'p.id', 'b.product_id')
      .whereNot('b.status', 'Finalizado')
      .where('b.remaining_ml', '>', 0)
      .select(
        'b.id', 'b.batch_code', 'b.reduced_lot_number', 'b.remaining_ml', 'b.quantity_ml',
        'b.status', 'b.production_date', 'b.maceration_end', 'b.cost_per_ml',
        'p.id as product_id', 'p.project_name', 'p.commercial_name',
        'p.inspiration_brand', 'p.inspiration_name', 'p.sku'
      )
      .orderBy('b.reduced_lot_number', 'asc')

    const envases = await db('bottlings')
      .whereNotNull('product_ref')
      .where('quantity_available', '>', 0)
      .groupBy('product_ref')
      .select('product_ref')
      .sum('quantity_available as un')
    const unPorSku = Object.fromEntries(envases.map(r => [r.product_ref, parseInt(r.un || 0)]))

    const porProduto = new Map()
    for (const l of lotes) {
      let row = porProduto.get(l.product_id)
      if (!row) {
        row = {
          product_id:        l.product_id,
          project_name:      l.project_name,
          commercial_name:   l.commercial_name,
          inspiration_brand: l.inspiration_brand || '—',
          inspiration_name:  l.inspiration_name || '—',
          stock_ml:          0,
          batches:           0,
          macerating_ml:     0,
          ready_units:       l.sku ? (unPorSku[l.sku] || 0) : 0,
          lots:              [],
        }
        porProduto.set(l.product_id, row)
      }
      const ml = parseFloat(l.remaining_ml || 0)
      row.stock_ml += ml
      row.batches  += 1
      if (l.status === 'Em maceração') row.macerating_ml += ml
      row.lots.push({
        id: l.id, batch_code: l.batch_code, reduced_lot_number: l.reduced_lot_number,
        remaining_ml: ml, quantity_ml: parseFloat(l.quantity_ml || 0),
        status: l.status, production_date: l.production_date,
        maceration_end: l.maceration_end, cost_per_ml: l.cost_per_ml,
      })
    }

    for (const row of porProduto.values()) {
      row.stock_ml      = money(row.stock_ml)
      row.macerating_ml = money(row.macerating_ml)
    }

    const data = [...porProduto.values()].sort((a, b) =>
      (a.inspiration_brand || '').localeCompare(b.inspiration_brand || '', 'pt-BR', { sensitivity: 'base' }) ||
      (a.project_name || '').localeCompare(b.project_name || '', 'pt-BR', { sensitivity: 'base' })
    )

    res.json({
      data,
      totals: {
        produtos:      data.length,
        stock_ml:      money(data.reduce((s, r) => s + r.stock_ml, 0)),
        macerating_ml: money(data.reduce((s, r) => s + r.macerating_ml, 0)),
        batches:       data.reduce((s, r) => s + r.batches, 0),
        ready_units:   data.reduce((s, r) => s + r.ready_units, 0),
      },
    })
  } catch (e) {
    console.error('Error building stock overview report:', e)
    res.status(500).json({ error: e.message })
  }
}

exports.SOLD_STATUSES = SOLD_STATUSES
