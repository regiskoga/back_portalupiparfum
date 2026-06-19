const { db } = require('../models/db')

async function list(req, res) {
  try {
    const { marca, genero, busca, page = 1, limit = 24 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const today = new Date().toISOString().slice(0, 10)

    let query = db('products as p')
      .where('p.active', true)
      .whereNotNull('p.catalog_status')
      .select(
        'p.id',
        'p.project_name',
        'p.commercial_name',
        'p.inspiration_brand',
        'p.inspiration_name',
        'p.gender',
        'p.catalog_status',
        'p.narrative',
        'p.top_notes',
        'p.heart_notes',
        'p.base_notes',
        'p.bottle_photo_url',
        'p.original_photo_url',
        'p.main_accords',
        'p.perfumer',
        'p.launch_year',
        'p.day_night_profile'
      )
      .orderBy('p.project_name', 'asc')

    if (marca)  query = query.where('p.inspiration_brand', 'ilike', `%${marca}%`)
    if (genero) query = query.where('p.gender', genero)
    if (busca) {
      query = query.where(function () {
        this.where('p.project_name',      'ilike', `%${busca}%`)
          .orWhere('p.inspiration_name',  'ilike', `%${busca}%`)
          .orWhere('p.inspiration_brand', 'ilike', `%${busca}%`)
          .orWhere('p.commercial_name',   'ilike', `%${busca}%`)
      })
    }

    const [{ count }] = await query.clone().clearSelect().count('p.id as count')
    const produtos = await query.limit(parseInt(limit)).offset(offset)

    if (produtos.length === 0) {
      return res.json({ data: [], total: 0, page: parseInt(page), limit: parseInt(limit) })
    }

    const ids = produtos.map(p => p.id)

    // Preços vigentes (sem custo — só volume + preço + nome da embalagem)
    const prices = await db('price_lists as pl')
      .leftJoin('packaging_types as pt', 'pt.id', 'pl.packaging_type_id')
      .whereIn('pl.product_id', ids)
      .where('pl.price', '>', 0)
      .where('pl.valid_from', '<=', today)
      .where(function () {
        this.whereNull('pl.valid_to').orWhere('pl.valid_to', '>=', today)
      })
      .select('pl.product_id', db.raw('CAST(pl.volume_ml AS float) as volume_ml'), 'pl.price', 'pt.name as packaging_name')
      .orderBy('pl.volume_ml', 'asc')

    const priceMap = {}
    prices.forEach(r => {
      if (!priceMap[r.product_id]) priceMap[r.product_id] = []
      priceMap[r.product_id].push({
        volume_ml:      r.volume_ml,
        price:          parseFloat(r.price),
        packaging_name: r.packaging_name || `${r.volume_ml}ml`
      })
    })

    // Disponibilidade: produto tem envase ativo com saldo > 0?
    const available = await db('bottlings as bt')
      .join('bottling_batches as bb', 'bb.bottling_id', 'bt.id')
      .join('batches as b',           'b.id',           'bb.batch_id')
      .join('formulas as f',          'f.id',           'b.formula_id')
      .whereIn('f.product_id', ids)
      .where('bt.quantity_available', '>', 0)
      .where('bt.active', true)
      .distinct('f.product_id')
      .select('f.product_id')

    const availableSet = new Set(available.map(r => r.product_id))

    const data = produtos.map(p => ({
      id:               p.id,
      project_name:     p.project_name,
      commercial_name:  p.commercial_name || p.project_name,
      inspiration_brand: p.inspiration_brand,
      inspiration_name:  p.inspiration_name,
      gender:           p.gender,
      catalog_status:   p.catalog_status,
      narrative:        p.narrative,
      top_notes:        p.top_notes,
      heart_notes:      p.heart_notes,
      base_notes:       p.base_notes,
      bottle_photo_url:   p.bottle_photo_url,
      original_photo_url: p.original_photo_url,
      main_accords:     p.main_accords,
      perfumer:         p.perfumer,
      launch_year:      p.launch_year,
      day_night_profile: p.day_night_profile,
      prices:           priceMap[p.id] || [],
      disponivel:       availableSet.has(p.id),
    }))

    res.json({ data, total: parseInt(count), page: parseInt(page), limit: parseInt(limit) })
  } catch (error) {
    console.error('[catalog] list error:', error)
    res.status(500).json({ error: 'Erro ao carregar catálogo' })
  }
}

// Lista de marcas únicas para o filtro
async function brands(req, res) {
  try {
    const rows = await db('products')
      .where('active', true)
      .whereNotNull('catalog_status')
      .whereNotNull('inspiration_brand')
      .where('inspiration_brand', '!=', '')
      .distinct('inspiration_brand')
      .orderBy('inspiration_brand', 'asc')
      .select('inspiration_brand')

    res.json(rows.map(r => r.inspiration_brand))
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar marcas' })
  }
}

// Cria pedido a partir do catálogo público (sem JWT)
async function createOrder(req, res) {
  try {
    const { customer, items } = req.body

    if (!customer?.name?.trim() || !customer?.phone?.trim()) {
      return res.status(422).json({ error: 'Nome e telefone do cliente são obrigatórios' })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ error: 'Selecione ao menos um perfume' })
    }

    const phone = customer.phone.replace(/\D/g, '')

    // Buscar ou criar cliente pelo telefone (normalizado)
    let existingCustomer = await db('customers')
      .whereRaw("regexp_replace(phone, '[^0-9]', '', 'g') = ?", [phone])
      .first()

    if (!existingCustomer) {
      ;[existingCustomer] = await db('customers')
        .insert({
          name:  customer.name.trim(),
          phone: customer.phone.trim(),
        })
        .returning('*')
    }

    // Validar produtos — só aceita IDs existentes e com catalog_status
    const productIds = [...new Set(items.map(i => parseInt(i.product_id)).filter(Boolean))]
    const products = await db('products')
      .whereIn('id', productIds)
      .where('active', true)
      .whereNotNull('catalog_status')
      .select('id', 'project_name', 'sku')

    if (products.length === 0) {
      return res.status(422).json({ error: 'Nenhum produto válido encontrado' })
    }

    const productMap = Object.fromEntries(products.map(p => [p.id, p]))

    // Criar pedido em transação
    const result = await db.transaction(async trx => {
      const [order] = await trx('orders')
        .insert({
          customer_id:  existingCustomer.id,
          code:         `ORD-${Date.now()}`,
          status:       'Pending',
          channel:      'WhatsApp',
          from_catalog: true,
          discount:     0,
          shipping:     0,
          notes:        'Pedido recebido via catálogo público',
        })
        .returning('*')

      const orderItems = products.map(p => ({
        order_id:     order.id,
        product_id:   p.id,
        product_name: p.project_name,
        product_ref:  p.sku || '',
        volume_ml:    null,
        quantity:     1,
        unit_price:   0,
        item_discount: 0,
      }))

      await trx('order_items').insert(orderItems)

      return { order_id: order.id, order_code: order.code, customer_id: existingCustomer.id }
    })

    res.status(201).json(result)
  } catch (error) {
    console.error('[catalog] createOrder error:', error)
    res.status(500).json({ error: 'Erro ao registrar pedido' })
  }
}

module.exports = { list, brands, createOrder }
