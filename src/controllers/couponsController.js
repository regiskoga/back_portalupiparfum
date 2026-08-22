/**
 * Coupons Controller
 * Gerencia cupons de desconto
 */

const { db } = require('../models/db')

/**
 * Lista todos os cupons
 */
exports.list = async (req, res) => {
  try {
    const { active } = req.query

    let query = db('coupons').select('*')

    if (active !== undefined) {
      query = query.where('active', active === 'true')
    }

    const coupons = await query.orderBy('created_at', 'desc')

    res.json({ data: coupons })
  } catch (error) {
    console.error('Error listing coupons:', error)
    res.status(500).json({ error: 'Failed to list coupons' })
  }
}

/**
 * Busca um cupom por código
 */
exports.getByCode = async (req, res) => {
  try {
    const { code } = req.params

    const coupon = await db('coupons')
      .where({ code })
      .first()

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    res.json(coupon)
  } catch (error) {
    console.error('Error getting coupon:', error)
    res.status(500).json({ error: 'Failed to get coupon' })
  }
}

/**
 * Valida um cupom
 */
exports.validate = async (req, res) => {
  try {
    const { code, order_value = 0 } = req.body

    const coupon = await db('coupons')
      .where({ code, active: true })
      .where('valid_from', '<=', db.fn.now())
      .where(function() {
        this.whereNull('valid_until').orWhere('valid_until', '>=', db.fn.now())
      })
      .first()

    if (!coupon) {
      return res.status(404).json({ 
        valid: false, 
        error: 'Cupom inválido ou expirado' 
      })
    }

    // Verificar limite de usos
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Limite de usos do cupom atingido' 
      })
    }

    // Verificar valor mínimo do pedido
    if (order_value < coupon.min_order_value) {
      return res.status(400).json({ 
        valid: false, 
        error: `Valor mínimo do pedido: R$ ${coupon.min_order_value.toFixed(2)}` 
      })
    }

    // Calcular desconto
    let discount = 0
    switch (coupon.type) {
      case 'Percentage':
        discount = (order_value * coupon.discount_value) / 100
        break
      case 'Fixed Amount':
        discount = coupon.discount_value
        break
      case 'Progressive':
        discount = (order_value * coupon.discount_value) / 100
        break
    }

    res.json({
      valid: true,
      coupon,
      discount,
      final_value: Math.max(0, order_value - discount)
    })
  } catch (error) {
    console.error('Error validating coupon:', error)
    res.status(500).json({ error: 'Failed to validate coupon' })
  }
}

/**
 * Cria um novo cupom
 */
exports.create = async (req, res) => {
  try {
    const {
      code,
      description = '',
      type = 'Percentage',
      discount_value,
      min_items = null,
      free_items = null,
      min_order_value = 0,
      max_uses = null,
      active = true,
      valid_from = null,
      valid_until = null,
      partner_id = null,
      commission_rate = null
    } = req.body

    // Verificar se código já existe
    const existing = await db('coupons')
      .where({ code })
      .first()

    if (existing) {
      return res.status(400).json({ error: 'Coupon code already exists' })
    }

    const [coupon] = await db('coupons')
      .insert({
        code: code.toUpperCase(),
        description,
        type,
        discount_value,
        min_items,
        free_items,
        min_order_value,
        max_uses,
        active,
        valid_from: valid_from || db.fn.now(),
        valid_until,
        partner_id: partner_id || null,
        commission_rate: commission_rate === '' || commission_rate === undefined ? null : commission_rate
      })
      .returning('*')

    res.status(201).json(coupon)
  } catch (error) {
    console.error('Error creating coupon:', error)
    res.status(500).json({ error: 'Failed to create coupon' })
  }
}

/**
 * Atualiza um cupom
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params
    const {
      code,
      description,
      type,
      discount_value,
      min_items,
      free_items,
      min_order_value,
      max_uses,
      active,
      valid_from,
      valid_until,
      partner_id,
      commission_rate
    } = req.body

    // Se mudou o código, verificar se já existe
    if (code) {
      const existing = await db('coupons')
        .where({ code })
        .whereNot({ id })
        .first()

      if (existing) {
        return res.status(400).json({ error: 'Coupon code already exists' })
      }
    }

    // G1: bloquear reatribuição de cupom já vinculado a OUTRO parceiro (evita
    // comissão ambígua). Desvincular (partner_id=null) é livre; force explícito libera.
    if (partner_id) {
      const current = await db('coupons').where({ id }).first()
      if (!current) return res.status(404).json({ error: 'Coupon not found' })
      if (current.partner_id && Number(current.partner_id) !== Number(partner_id) && !req.body.force) {
        return res.status(409).json({
          error: 'Este cupom já pertence a outro parceiro. Desvincule primeiro ou confirme a transferência.',
          code: 'COUPON_PARTNER_CONFLICT'
        })
      }
    }

    // Monta só os campos enviados (PATCH parcial) — evita zerar o que não veio
    const updateData = {
      code: code?.toUpperCase(),
      description,
      type,
      discount_value,
      min_items,
      free_items,
      min_order_value,
      max_uses,
      active,
      valid_from,
      valid_until
    }
    if (partner_id !== undefined) updateData.partner_id = partner_id || null
    if (commission_rate !== undefined) {
      updateData.commission_rate = commission_rate === '' || commission_rate === null ? null : commission_rate
    }

    const [coupon] = await db('coupons')
      .where({ id })
      .update(updateData)
      .returning('*')

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    res.json(coupon)
  } catch (error) {
    console.error('Error updating coupon:', error)
    res.status(500).json({ error: 'Failed to update coupon' })
  }
}

/**
 * Deleta um cupom
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params

    const deleted = await db('coupons')
      .where({ id })
      .delete()

    if (!deleted) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    res.json({ message: 'Coupon deleted successfully' })
  } catch (error) {
    console.error('Error deleting coupon:', error)
    // G6: violação de FK (comissões de parceiro apontam p/ este cupom, RESTRICT)
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'Não é possível excluir: este cupom tem comissões de parceiro vinculadas. Desative-o (Ativo = não) em vez de excluir.'
      })
    }
    res.status(500).json({ error: 'Failed to delete coupon' })
  }
}

/**
 * Estatísticas de uso de cupons
 */
exports.stats = async (req, res) => {
  try {
    const stats = await db('coupons')
      .select(
        db.raw('COUNT(*) as total_coupons'),
        db.raw('SUM(CASE WHEN active = true THEN 1 ELSE 0 END) as active_coupons'),
        db.raw('SUM(current_uses) as total_uses'),
        db.raw('AVG(discount_value) as avg_discount')
      )
      .first()

    const topCoupons = await db('coupons')
      .select('code', 'description', 'current_uses', 'type', 'discount_value')
      .orderBy('current_uses', 'desc')
      .limit(10)

    res.json({
      stats,
      top_coupons: topCoupons
    })
  } catch (error) {
    console.error('Error getting coupon stats:', error)
    res.status(500).json({ error: 'Failed to get coupon stats' })
  }
}

module.exports = exports
