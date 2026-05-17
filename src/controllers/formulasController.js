const { db } = require('../models/db')
const ActivityLogger = require('../services/activityLogger')

// ─── LIST FORMULAS ────────────────────────────────────────────────────────────
async function list(req, res) {
  try {
    const { product_id, validated, active, sort } = req.query

    let query = db('formulas as f')
      .leftJoin('products as p', 'p.id', 'f.product_id')
      .leftJoin('batches as b', 'b.formula_id', 'f.id')
      .select(
        'f.*',
        'p.project_name',
        'p.commercial_name',
        db.raw('COUNT(b.id) as batch_count'),
        db.raw('SUM(b.remaining_ml) as total_remaining_ml')
      )
      .groupBy('f.id', 'p.id')
      .orderBy(sort === 'project_name' ? 'p.project_name' : 'f.created_at', sort === 'project_name' ? 'asc' : 'desc')
    
    // Filtros
    if (product_id) {
      query = query.where('f.product_id', parseInt(product_id))
    }
    
    if (validated !== undefined) {
      query = query.where('f.validated', validated === 'true')
    }
    
    if (active !== undefined) {
      query = query.where('f.active', active === 'true')
    }
    
    const formulas = await query
    res.json(formulas)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── GET ONE FORMULA ──────────────────────────────────────────────────────────
async function getOne(req, res) {
  try {
    const formula = await db('formulas as f')
      .leftJoin('products as p', 'p.id', 'f.product_id')
      .select('f.*', 'p.project_name', 'p.commercial_name')
      .where('f.id', parseInt(req.params.id))
      .first()
    
    if (!formula) {
      return res.status(404).json({ error: 'Formula not found' })
    }
    
    // Buscar itens da fórmula
    const items = await db('formula_items as fi')
      .join('supplies as s', 's.id', 'fi.supply_id')
      .join('suppliers as sp', 'sp.id', 's.supplier_id')
      .select(
        'fi.*',
        's.name as supply_name',
        's.type as supply_type',
        's.unit',
        's.unit_cost',
        'sp.name as supplier_name'
      )
      .where('fi.formula_id', formula.id)
      .orderBy('fi.order_index', 'asc')
    
    // Buscar lotes da fórmula
    const batches = await db('batches')
      .where('formula_id', formula.id)
      .orderBy('production_date', 'desc')
    
    formula.items = items
    formula.batches = batches
    
    res.json(formula)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── CREATE FORMULA ───────────────────────────────────────────────────────────
async function create(req, res) {
  try {
    const { product_id, name, description = '', essence_percentage = 0, items = [] } = req.body

    // Verificar se produto existe, se informado
    if (product_id) {
      const product = await db('products').where('id', parseInt(product_id)).first()
      if (!product) {
        return res.status(400).json({ error: 'Product not found' })
      }
    }

    // Usar transação para criar fórmula + itens
    const result = await db.transaction(async (trx) => {
      // Total = essência + demais insumos
      const essencePct = parseFloat(essence_percentage) || 0
      const itemsTotal = items.reduce((sum, item) => sum + parseFloat(item.percentage), 0)
      const totalPercentage = essencePct + itemsTotal
      const validated = Math.abs(totalPercentage - 100) < 0.01

      // Criar fórmula
      const [formula] = await trx('formulas').insert({
        product_id: product_id ? parseInt(product_id) : null,
        name,
        description,
        essence_percentage: essencePct,
        total_percentage: totalPercentage,
        validated,
        active: true
      }).returning('*')
      
      // Criar itens da fórmula
      if (items.length > 0) {
        const formulaItems = items.map((item, index) => ({
          formula_id: formula.id,
          supply_id: parseInt(item.supply_id),
          percentage: parseFloat(item.percentage),
          notes: item.notes || '',
          order_index: item.order_index || index + 1
        }))
        
        await trx('formula_items').insert(formulaItems)
      }
      
      return formula
    })
    
    // Log da criação
    await ActivityLogger.logCreate('formula', result.id, name, result)
    
    res.status(201).json(result)
  } catch (error) {
    if (error.code === '23503') { // Foreign key violation
      res.status(400).json({ error: 'Invalid supply_id in formula items' })
    } else if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Supply already exists in this formula' })
    } else {
      res.status(400).json({ error: error.message })
    }
  }
}

// ─── UPDATE FORMULA ───────────────────────────────────────────────────────────
async function update(req, res) {
  try {
    const formula = await db('formulas').where('id', parseInt(req.params.id)).first()
    if (!formula) {
      return res.status(404).json({ error: 'Formula not found' })
    }
    
    const { name, description, essence_percentage, items } = req.body

    const result = await db.transaction(async (trx) => {
      // Atualizar fórmula
      const updateData = { updated_at: trx.fn.now() }
      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description
      if (essence_percentage !== undefined) updateData.essence_percentage = parseFloat(essence_percentage) || 0

      // Se itens foram fornecidos, recalcular percentual total
      if (items) {
        const essencePct = essence_percentage !== undefined ? (parseFloat(essence_percentage) || 0) : parseFloat(formula.essence_percentage || 0)
        const itemsTotal = items.reduce((sum, item) => sum + parseFloat(item.percentage), 0)
        const totalPercentage = essencePct + itemsTotal
        updateData.total_percentage = totalPercentage
        updateData.validated = Math.abs(totalPercentage - 100) < 0.01
        
        // Remover itens existentes e inserir novos
        await trx('formula_items').where('formula_id', parseInt(req.params.id)).del()
        
        if (items.length > 0) {
          const formulaItems = items.map((item, index) => ({
            formula_id: parseInt(req.params.id),
            supply_id: parseInt(item.supply_id),
            percentage: parseFloat(item.percentage),
            notes: item.notes || '',
            order_index: item.order_index || index + 1
          }))
          
          await trx('formula_items').insert(formulaItems)
        }
      }
      
      const [updated] = await trx('formulas')
        .where('id', parseInt(req.params.id))
        .update(updateData)
        .returning('*')
      
      return updated
    })
    
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// ─── DELETE FORMULA ───────────────────────────────────────────────────────────
async function remove(req, res) {
  try {
    const formula = await db('formulas').where('id', parseInt(req.params.id)).first()
    if (!formula) {
      return res.status(404).json({ error: 'Formula not found' })
    }
    
    // Verificar se há lotes vinculados
    const batchCount = await db('batches').where('formula_id', parseInt(req.params.id)).count('id as count').first()
    if (parseInt(batchCount.count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete formula with existing batches. Delete batches first.' 
      })
    }
    
    await db('formulas').where('id', parseInt(req.params.id)).del()
    res.json({ message: 'Formula deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── VALIDATE FORMULA ─────────────────────────────────────────────────────────
async function validate(req, res) {
  try {
    const formula = await db('formulas').where('id', parseInt(req.params.id)).first()
    if (!formula) {
      return res.status(404).json({ error: 'Formula not found' })
    }
    
    // Recalcular percentual total (essência + itens)
    const items = await db('formula_items').where('formula_id', parseInt(req.params.id))
    const itemsTotal = items.reduce((sum, item) => sum + parseFloat(item.percentage), 0)
    const totalPercentage = parseFloat(formula.essence_percentage || 0) + itemsTotal
    const validated = Math.abs(totalPercentage - 100) < 0.01
    
    const [updated] = await db('formulas')
      .where('id', parseInt(req.params.id))
      .update({
        total_percentage: totalPercentage,
        validated,
        updated_at: db.fn.now()
      })
      .returning('*')
    
    // Log da validação
    await ActivityLogger.logFormulaValidation(formula.id, formula.name, totalPercentage, validated)
    
    res.json({
      ...updated,
      validation_result: {
        total_percentage: totalPercentage,
        is_valid: validated,
        difference: totalPercentage - 100
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── GET FORMULA ITEMS ────────────────────────────────────────────────────────
async function getItems(req, res) {
  try {
    const items = await db('formula_items as fi')
      .join('supplies as s', 's.id', 'fi.supply_id')
      .join('suppliers as sp', 'sp.id', 's.supplier_id')
      .select(
        'fi.*',
        's.name as supply_name',
        's.type as supply_type',
        's.unit',
        's.unit_cost',
        'sp.name as supplier_name'
      )
      .where('fi.formula_id', parseInt(req.params.id))
      .orderBy('fi.order_index', 'asc')
    
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports = {
  list,
  getOne,
  getItems,
  create,
  update,
  remove,
  validate
}