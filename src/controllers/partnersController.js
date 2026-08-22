/**
 * Partners Controller (Fase 1)
 * CRUD de parceiros (afiliados/divulgadores) + soft-delete.
 * A comissão/livro-razão é da Fase 2 — aqui só o cadastro e os cupons vinculados.
 */

const { db } = require('../models/db')

// ─── Saldo do parceiro ─────────────────────────────────────────────────────────
// Saldo = comissões aprovadas − resgates ativos. @param conn trx ou db.
async function computeBalance (partnerId, conn = db) {
  const cr = await conn('partner_commissions')
    .where({ partner_id: partnerId, status: 'aprovado' })
    .sum('amount as total').first()
  const rd = await conn('partner_redemptions')
    .where({ partner_id: partnerId, status: 'ativo' })
    .sum('amount as total').first()
  return Number(cr?.total || 0) - Number(rd?.total || 0)
}

// ─── LIST ─────────────────────────────────────────────────────────────────────
async function list (req, res) {
  try {
    const { busca, incluir_inativos } = req.query

    let query = db('partners as p')
      .leftJoin('coupons as c', 'c.partner_id', 'p.id')
      .select('p.*')
      .count('c.id as total_coupons')
      .groupBy('p.id')
      .orderBy('p.name', 'asc')

    if (!incluir_inativos) {
      query = query.where('p.active', true)
    }

    if (busca) {
      query = query.where(function () {
        this.where('p.name', 'like', `%${busca}%`)
          .orWhere('p.handle', 'like', `%${busca}%`)
          .orWhere('p.doc', 'like', `%${busca}%`)
          .orWhere('p.contact_email', 'like', `%${busca}%`)
      })
    }

    const partners = await query

    // ── Métricas de performance (Fase 5) ─────────────────────────────────────
    // Em queries separadas p/ evitar fan-out do join de cupons. Tudo all-time.
    if (partners.length) {
      const ids = partners.map(p => p.id)

      // Comissões aprovadas: receita gerada (base), comissão paga (amount), nº pedidos
      const comm = await db('partner_commissions')
        .whereIn('partner_id', ids).where('status', 'aprovado')
        .groupBy('partner_id')
        .select('partner_id')
        .sum('base_amount as revenue')
        .sum('amount as commission_total')
        .countDistinct('order_id as orders_count')
      const commByPartner = Object.fromEntries(comm.map(c => [c.partner_id, c]))

      // Resgates ativos (p/ saldo = comissão − resgatado)
      const red = await db('partner_redemptions')
        .whereIn('partner_id', ids).where('status', 'ativo')
        .groupBy('partner_id')
        .select('partner_id')
        .sum('amount as redeemed')
      const redByPartner = Object.fromEntries(red.map(r => [r.partner_id, Number(r.redeemed) || 0]))

      for (const p of partners) {
        const c = commByPartner[p.id] || {}
        p.orders_count     = Number(c.orders_count) || 0
        p.revenue_generated = Number(c.revenue) || 0
        p.commission_total = Number(c.commission_total) || 0
        p.balance          = p.commission_total - (redByPartner[p.id] || 0)
        p.avg_ticket       = p.orders_count > 0 ? p.revenue_generated / p.orders_count : 0
      }
    }

    res.json(partners)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── GET ONE (com cupons vinculados) ──────────────────────────────────────────
async function getOne (req, res) {
  try {
    const partner = await db('partners').where({ id: parseInt(req.params.id) }).first()
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' })
    }

    // Cupons vinculados — commission_rate NULL herda a taxa padrão do parceiro
    partner.coupons = await db('coupons')
      .where({ partner_id: partner.id })
      .select('id', 'code', 'description', 'type', 'discount_value',
        'commission_rate', 'active', 'current_uses', 'max_uses', 'valid_until')
      .orderBy('created_at', 'desc')

    // Saldo = comissões aprovadas − resgates ativos
    partner.balance = await computeBalance(partner.id)

    res.json(partner)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
async function create (req, res) {
  try {
    const {
      name, doc = '', channel_type = 'outro', handle = '', url = '',
      contact_email = '', contact_phone = '', default_commission_rate = 0,
      payout_mode = 'mercadoria', notes = ''
    } = req.body

    const [partner] = await db('partners').insert({
      name,
      doc,
      channel_type,
      handle,
      url,
      contact_email,
      contact_phone,
      default_commission_rate: Number(default_commission_rate) || 0,
      payout_mode,
      notes,
      active: true,
    }).returning('*')

    res.status(201).json(partner)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
async function update (req, res) {
  try {
    const partner = await db('partners').where({ id: parseInt(req.params.id) }).first()
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' })
    }

    const {
      name, doc, channel_type, handle, url, contact_email, contact_phone,
      default_commission_rate, payout_mode, notes, active
    } = req.body

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (doc !== undefined) updateData.doc = doc
    if (channel_type !== undefined) updateData.channel_type = channel_type
    if (handle !== undefined) updateData.handle = handle
    if (url !== undefined) updateData.url = url
    if (contact_email !== undefined) updateData.contact_email = contact_email
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone
    if (default_commission_rate !== undefined) updateData.default_commission_rate = Number(default_commission_rate) || 0
    if (payout_mode !== undefined) updateData.payout_mode = payout_mode
    if (notes !== undefined) updateData.notes = notes
    if (active !== undefined) updateData.active = Boolean(active)
    updateData.updated_at = db.fn.now()

    await db('partners').where({ id: parseInt(req.params.id) }).update(updateData)

    const updated = await db('partners').where({ id: parseInt(req.params.id) }).first()
    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── INATIVAR (soft delete) ───────────────────────────────────────────────────
async function remove (req, res) {
  try {
    const partner = await db('partners').where({ id: parseInt(req.params.id) }).first()
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' })
    }

    await db('partners').where({ id: parseInt(req.params.id) }).update({
      active: false,
      updated_at: db.fn.now(),
    })

    res.json({ message: 'Partner deactivated' })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── REATIVAR ─────────────────────────────────────────────────────────────────
async function reativar (req, res) {
  try {
    const partner = await db('partners').where({ id: parseInt(req.params.id) }).first()
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' })
    }

    await db('partners').where({ id: parseInt(req.params.id) }).update({
      active: true,
      updated_at: db.fn.now(),
    })

    const updated = await db('partners').where({ id: parseInt(req.params.id) }).first()
    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── EXTRATO (livro-razão de comissões) ───────────────────────────────────────
async function statement (req, res) {
  try {
    const id = parseInt(req.params.id)
    const partner = await db('partners').where({ id }).first()
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' })
    }

    const { month } = req.query // 'YYYY-MM' opcional

    // Saldo = comissões aprovadas − resgates ativos
    const balance = await computeBalance(id)

    // Linhas do extrato (do mês, se filtrado) com pedido e cupom
    let q = db('partner_commissions as pc')
      .leftJoin('orders as o', 'o.id', 'pc.order_id')
      .leftJoin('coupons as c', 'c.id', 'pc.coupon_id')
      .where('pc.partner_id', id)
      .select(
        'pc.id', 'pc.order_id', 'pc.base_amount', 'pc.rate', 'pc.amount',
        'pc.status', 'pc.competence', 'pc.created_at', 'pc.reversal_reason',
        'o.code as order_code', 'o.status as order_status',
        'c.code as coupon_code'
      )
      .orderBy('pc.created_at', 'desc')
    if (month) q = q.where('pc.competence', month)
    const items = await q

    // Resgates (débitos) do mesmo período, com os itens de mercadoria
    let rq = db('partner_redemptions').where({ partner_id: id }).orderBy('redeemed_at', 'desc')
    if (month) rq = rq.whereRaw("to_char(redeemed_at, 'YYYY-MM') = ?", [month])
    const redemptions = await rq
    if (redemptions.length) {
      const rItems = await db('partner_redemption_items')
        .whereIn('redemption_id', redemptions.map(r => r.id))
      for (const r of redemptions) r.items = rItems.filter(i => i.redemption_id === r.id)
    }

    const approved = items.filter(i => i.status === 'aprovado').reduce((s, i) => s + Number(i.amount), 0)
    const reversed = items.filter(i => i.status === 'estornado').reduce((s, i) => s + Number(i.amount), 0)
    const redeemed = redemptions.filter(r => r.status === 'ativo').reduce((s, r) => s + Number(r.amount), 0)

    res.json({
      partner: { id: partner.id, name: partner.name, payout_mode: partner.payout_mode },
      balance,
      month: month || null,
      summary: { approved, reversed, redeemed, count: items.length },
      items,
      redemptions,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── RESGATE: criar (debita saldo + baixa estoque dos envases dados) ───────────
async function createRedemption (req, res) {
  try {
    const id = parseInt(req.params.id)
    const partner = await db('partners').where({ id }).first()
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' })
    }

    const { amount, payout_mode = 'mercadoria', description = '', redeemed_at, items = [] } = req.body
    const value = Number(amount)
    if (!(value > 0)) {
      return res.status(400).json({ error: 'Informe um valor de resgate maior que zero.' })
    }

    const redemption = await db.transaction(async (trx) => {
      // G3: trava a linha do parceiro p/ serializar resgates concorrentes. O 2º
      // resgate espera o 1º commitar e recalcula o saldo já com ele descontado —
      // impede duplo-clique/corrida gastarem o saldo duas vezes (saldo negativo).
      await trx('partners').where({ id }).forUpdate().first()
      const balance = await computeBalance(id, trx)
      if (value > balance + 0.001) {
        throw new Error(`Valor acima do saldo disponível (R$ ${balance.toFixed(2)}).`)
      }

      const [rd] = await trx('partner_redemptions').insert({
        partner_id: id,
        amount: value,
        payout_mode,
        description,
        status: 'ativo',
        redeemed_at: redeemed_at || trx.fn.now(),
      }).returning('*')

      for (const it of (items || [])) {
        const bottlingId = parseInt(it.bottling_id)
        const qty = parseInt(it.quantity)
        if (!bottlingId || !(qty > 0)) continue
        const b = await trx('bottlings').where({ id: bottlingId }).first()
        if (!b) throw new Error(`Envase ${bottlingId} não encontrado`)
        // Não resgatar mais que o estoque: se floreasse em 0, o cancelamento
        // (que incrementa a qtd cheia) criaria estoque fantasma. Bloqueia aqui.
        if (qty > Number(b.quantity_available)) {
          throw new Error(`Estoque insuficiente de "${b.product_name}" (${b.volume_ml}ml): disponível ${b.quantity_available}, pedido ${qty}.`)
        }

        await trx('partner_redemption_items').insert({
          redemption_id: rd.id,
          bottling_id: bottlingId,
          quantity: qty,
          product_name: b.product_name,
          volume_ml: b.volume_ml,
        })
        // Baixa do estoque (mesma primitiva do confirm de pedido: piso em 0)
        await trx.raw(
          'UPDATE bottlings SET quantity_available = GREATEST(0, quantity_available - ?) WHERE id = ?',
          [qty, bottlingId]
        )
      }

      return rd
    })

    res.status(201).json({ ...redemption, balance: await computeBalance(id) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── RESGATE: cancelar (volta ao saldo + restaura estoque) ─────────────────────
async function cancelRedemption (req, res) {
  try {
    const id  = parseInt(req.params.id)
    const rid = parseInt(req.params.rid)
    const rd = await db('partner_redemptions').where({ id: rid, partner_id: id }).first()
    if (!rd) {
      return res.status(404).json({ error: 'Redemption not found' })
    }
    if (rd.status === 'cancelado') {
      return res.status(400).json({ error: 'Resgate já está cancelado.' })
    }

    await db.transaction(async (trx) => {
      const rItems = await trx('partner_redemption_items').where({ redemption_id: rid })
      for (const it of rItems) {
        await trx('bottlings').where({ id: it.bottling_id }).increment('quantity_available', parseInt(it.quantity))
      }
      await trx('partner_redemptions').where({ id: rid }).update({
        status: 'cancelado',
        updated_at: trx.fn.now(),
      })
    })

    res.json({ message: 'Redemption cancelled', balance: await computeBalance(id) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

module.exports = {
  list, getOne, create, update, remove, reativar, statement,
  createRedemption, cancelRedemption,
}
