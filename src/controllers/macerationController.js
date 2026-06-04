const { db } = require('../models/db')

async function getParam (key, defaultValue) {
  const row = await db('parameters').where('key', key).first()
  return row ? row.value : String(defaultValue)
}

// Maceração alternada: dia 1 = geladeira, dia 2 = fora, dia 3 = geladeira...
function locationForDay (dayNumber) {
  return dayNumber % 2 === 1 ? 'geladeira' : 'fora'
}

function dayDiff (laterDate, earlierDate) {
  const a = new Date(laterDate); a.setHours(0, 0, 0, 0)
  const b = new Date(earlierDate); b.setHours(0, 0, 0, 0)
  return Math.floor((a - b) / (1000 * 60 * 60 * 24))
}

// Constrói o cronograma diário para um lote a partir de maceration_start e dos checkins existentes.
function buildSchedule (batch, checkins, today, totalDays) {
  const startDate = new Date(batch.maceration_start)
  startDate.setHours(0, 0, 0, 0)

  const checkinByDay = {}
  for (const c of checkins) checkinByDay[c.day_number] = c

  const days = []
  for (let d = 1; d <= totalDays; d++) {
    const dayDate = new Date(startDate)
    dayDate.setDate(startDate.getDate() + (d - 1))
    const expected = locationForDay(d)
    const checkin = checkinByDay[d] || null
    days.push({
      day_number: d,
      date: dayDate.toISOString().slice(0, 10),
      expected_location: expected,
      done: !!checkin,
      checked_at: checkin?.checked_at || null,
      operator: checkin?.operator || null,
      notes: checkin?.notes || '',
      is_today: dayDiff(today, dayDate) === 0,
      is_past:  dayDiff(today, dayDate) > 0,
      is_future: dayDiff(today, dayDate) < 0,
    })
  }
  return days
}

// ─── LIST MACERATIONS ─────────────────────────────────────────────────────────
// Por padrão lista apenas lotes em maceração ativa. Aceita ?include_finished=true.
async function list (req, res) {
  try {
    const includeFinished = String(req.query.include_finished || '').toLowerCase() === 'true'
    const totalDays = parseInt(await getParam('maceration_days', 10))

    let query = db('batches as b')
      .join('formulas as f', 'f.id', 'b.formula_id')
      .leftJoin('products as p', 'p.id', 'b.product_id')
      .select(
        'b.id',
        'b.batch_code',
        'b.reduced_lot_number',
        'b.production_date',
        'b.maceration_start',
        'b.maceration_end',
        'b.remaining_ml',
        'b.status',
        'f.name as formula_name',
        'p.project_name',
        'p.commercial_name'
      )
      .where('b.active', true)
      .whereNotNull('b.maceration_start')
      .orderBy('b.maceration_end', 'asc')

    if (includeFinished) {
      query = query.whereIn('b.status', ['Em maceração', 'Pronto para envase', 'Finalizado'])
    } else {
      query = query.where('b.status', 'Em maceração')
    }

    const batches = await query
    if (batches.length === 0) {
      return res.json({ total: 0, batches: [], total_days: totalDays })
    }

    const ids = batches.map(b => b.id)
    const checkins = await db('maceration_checkins')
      .whereIn('batch_id', ids)
      .orderBy('day_number', 'asc')

    const checkinsByBatch = {}
    for (const c of checkins) {
      if (!checkinsByBatch[c.batch_id]) checkinsByBatch[c.batch_id] = []
      checkinsByBatch[c.batch_id].push(c)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const enriched = batches.map(batch => {
      const startDate = new Date(batch.maceration_start)
      startDate.setHours(0, 0, 0, 0)
      const endDate = batch.maceration_end ? new Date(batch.maceration_end) : null
      if (endDate) endDate.setHours(0, 0, 0, 0)

      const elapsed = Math.max(0, dayDiff(today, startDate))
      const currentDay = Math.min(totalDays, elapsed + 1)
      const remaining = endDate ? Math.max(0, dayDiff(endDate, today)) : 0
      const schedule = buildSchedule(batch, checkinsByBatch[batch.id] || [], today, totalDays)

      const todayEntry = schedule.find(d => d.is_today) || null
      const overdue = schedule.filter(d => d.is_past && !d.done).length

      return {
        ...batch,
        total_days: totalDays,
        current_day: currentDay,
        days_remaining: remaining,
        progress_pct: Math.min(100, Math.round((elapsed / totalDays) * 100)),
        is_ready: batch.status !== 'Em maceração' || (endDate && today >= endDate),
        today_action: todayEntry,
        overdue_count: overdue,
        schedule
      }
    })

    res.json({
      total: enriched.length,
      total_days: totalDays,
      include_finished: includeFinished,
      batches: enriched
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── CHECK-IN DAY ─────────────────────────────────────────────────────────────
async function checkin (req, res) {
  try {
    const batchId = parseInt(req.params.batch_id)
    const dayNumber = parseInt(req.params.day)
    const { notes = '', operator = '' } = req.body || {}

    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      return res.status(400).json({ error: 'Dia inválido' })
    }

    const batch = await db('batches').where('id', batchId).first()
    if (!batch) return res.status(404).json({ error: 'Lote não encontrado' })

    const expected = locationForDay(dayNumber)

    // Upsert manual: se já existe, atualiza; se não, insere.
    const existing = await db('maceration_checkins')
      .where({ batch_id: batchId, day_number: dayNumber })
      .first()

    if (existing) {
      const [updated] = await db('maceration_checkins')
        .where('id', existing.id)
        .update({
          checked_at: db.fn.now(),
          operator,
          notes,
          expected_location: expected
        })
        .returning('*')
      return res.json(updated)
    }

    const [inserted] = await db('maceration_checkins')
      .insert({
        batch_id: batchId,
        day_number: dayNumber,
        expected_location: expected,
        operator,
        notes
      })
      .returning('*')

    res.status(201).json(inserted)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── UNDO CHECK-IN ────────────────────────────────────────────────────────────
async function uncheckin (req, res) {
  try {
    const batchId = parseInt(req.params.batch_id)
    const dayNumber = parseInt(req.params.day)

    const removed = await db('maceration_checkins')
      .where({ batch_id: batchId, day_number: dayNumber })
      .del()

    if (!removed) return res.status(404).json({ error: 'Check-in não encontrado' })
    res.json({ message: 'Check-in removido' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports = { list, checkin, uncheckin }
