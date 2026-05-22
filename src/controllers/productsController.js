const { db } = require('../models/db')
const ActivityLogger = require('../services/activityLogger')

// ─── LIST PRODUCTS ────────────────────────────────────────────────────────────
async function list(req, res) {
  try {
    const { search, gender, active } = req.query
    
    let query = db('products as p')
      .leftJoin('formulas as f', 'f.product_id', 'p.id')
      .select(
        'p.*',
        db.raw('COUNT(f.id) as formula_count'),
        db.raw('COUNT(CASE WHEN f.validated = true THEN 1 END) as validated_formulas'),
        db.raw(`(
          SELECT COALESCE(SUM(oi.quantity), 0)
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = p.id
          AND o.status IN ('Pending','Confirmed','In Production','Ready')
        ) as committed_quantity`)
      )
      .groupBy('p.id')
      .orderBy('p.project_name', 'asc')
    
    // Filtros
    if (search) {
      query = query.where(function() {
        this.where('p.project_name', 'ilike', `%${search}%`)
          .orWhere('p.inspiration_brand', 'ilike', `%${search}%`)
          .orWhere('p.inspiration_name', 'ilike', `%${search}%`)
          .orWhere('p.commercial_name', 'ilike', `%${search}%`)
      })
    }
    
    if (gender) {
      query = query.where('p.gender', gender)
    }
    
    if (active !== undefined) {
      query = query.where('p.active', active === 'true')
    }
    
    const products = await query
    res.json(products)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── GET ONE PRODUCT ──────────────────────────────────────────────────────────
async function getOne(req, res) {
  try {
    const product = await db('products')
      .where('id', parseInt(req.params.id))
      .first()
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    
    // Buscar fórmulas do produto
    const formulas = await db('formulas as f')
      .leftJoin('batches as b', 'b.formula_id', 'f.id')
      .select(
        'f.*',
        db.raw('COUNT(b.id) as batch_count'),
        db.raw('SUM(b.remaining_ml) as total_remaining_ml')
      )
      .where('f.product_id', product.id)
      .groupBy('f.id')
      .orderBy('f.created_at', 'desc')
    
    product.formulas = formulas
    res.json(product)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── CREATE PRODUCT ───────────────────────────────────────────────────────────
async function create(req, res) {
  try {
    const {
      project_name,
      inspiration_brand = '',
      inspiration_name = '',
      commercial_name = '',
      sku = null,
      gender = 'Unissex',
      narrative = '',
      top_notes = '',
      heart_notes = '',
      base_notes = '',
      notes = ''
    } = req.body

    const [product] = await db('products').insert({
      project_name,
      inspiration_brand,
      inspiration_name,
      commercial_name,
      sku,
      gender,
      narrative,
      top_notes,
      heart_notes,
      base_notes,
      notes,
      active: true
    }).returning('*')
    
    // Log da criação
    await ActivityLogger.logCreate('product', product.id, project_name, product)

    // Auto-criar entradas na tabela de preços para cada tipo de embalagem ativo
    try {
      const packagingTypes = await db('packaging_types').where('active', true).orderBy('volume_ml', 'asc')
      if (packagingTypes.length > 0) {
        const today = new Date().toISOString().slice(0, 10)
        await db('price_lists').insert(packagingTypes.map(pt => ({
          product_id:        product.id,
          packaging_type_id: pt.id,
          volume_ml:         parseFloat(pt.volume_ml),
          price:             pt.suggested_price ? parseFloat(pt.suggested_price) : 0,
          valid_from:        today,
        })))
      }
    } catch { /* não bloqueia a criação do produto */ }

    res.status(201).json(product)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// ─── UPDATE PRODUCT ───────────────────────────────────────────────────────────
async function update(req, res) {
  try {
    const product = await db('products').where('id', parseInt(req.params.id)).first()
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    
    const updateData = { ...req.body }
    updateData.updated_at = db.fn.now()
    
    const [updated] = await db('products')
      .where('id', parseInt(req.params.id))
      .update(updateData)
      .returning('*')
    
    // Log da atualização
    await ActivityLogger.logUpdate('product', product.id, product.project_name, product, updated)
    
    res.json(updated)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// ─── DELETE PRODUCT ───────────────────────────────────────────────────────────
async function remove(req, res) {
  try {
    const id = parseInt(req.params.id)
    const product = await db('products').where('id', id).first()
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    const bottlingOrderCount = await db('bottling_orders').where({ product_id: id }).count('* as total').first()
    if (parseInt(bottlingOrderCount.total) > 0) {
      return res.status(409).json({ error: 'Produto não pode ser excluído pois está vinculado a ordens de envase.' })
    }

    // formulas tem CASCADE mas batches tem RESTRICT em formulas — verifica indiretamente
    const batchViaFormulaCount = await db('batches as b')
      .join('formulas as f', 'f.id', 'b.formula_id')
      .where('f.product_id', id)
      .count('* as total').first()
    if (parseInt(batchViaFormulaCount.total) > 0) {
      return res.status(409).json({ error: 'Produto não pode ser excluído pois possui lotes de produção vinculados. Exclua os lotes primeiro.' })
    }

    await db('products').where('id', id).del()
    await ActivityLogger.logDelete('product', id, product.project_name, product)
    res.json({ message: 'Product deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── PRODUCT STATS ────────────────────────────────────────────────────────────
async function stats(req, res) {
  try {
    const totalProducts = await db('products').count('* as count').first()
    const activeProducts = await db('products').where('active', true).count('* as count').first()
    
    const genderStats = await db('products')
      .select('gender')
      .count('* as count')
      .where('active', true)
      .groupBy('gender')
    
    const formulaStats = await db('formulas as f')
      .join('products as p', 'p.id', 'f.product_id')
      .where('p.active', true)
      .count('* as total_formulas')
      .first()
      
    const validatedFormulas = await db('formulas as f')
      .join('products as p', 'p.id', 'f.product_id')
      .where('p.active', true)
      .where('f.validated', true)
      .count('* as validated_formulas')
      .first()
    
    res.json({
      total_products: parseInt(totalProducts.count),
      active_products: parseInt(activeProducts.count),
      by_gender: genderStats,
      formulas: {
        total: parseInt(formulaStats.total_formulas || 0),
        validated: parseInt(validatedFormulas.validated_formulas || 0)
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  stats
}