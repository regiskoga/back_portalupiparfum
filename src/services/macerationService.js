const { db } = require('../models/db')

// Converte um valor de data do banco (string 'YYYY-MM-DD' ou objeto Date vindo do pg)
// em um Date no fuso local na meia-noite do dia armazenado. Evita o bug em UTC-X
// onde `new Date('2026-06-15')` é interpretado como UTC midnight e desloca pra
// véspera local. Retorna null se vazio.
function parseLocalDate (value) {
  if (!value) return null
  const s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function todayLocal () {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return t
}

function dayDiff (later, earlier) {
  return Math.floor((later - earlier) / (1000 * 60 * 60 * 24))
}

// Flipa para "Pronto para envase" os lotes em maceração cujo prazo (maceration_end)
// já passou. Idempotente — só atua em status='Em maceração'. Preserva 'Finalizado'.
// Chamado em endpoints de leitura para manter o status coerente sem cron job.
async function tickAutoFinishMaceration () {
  const today = new Date().toISOString().slice(0, 10)
  const finished = await db('batches')
    .where('status', 'Em maceração')
    .where('maceration_end', '<=', today)
    .select('id', 'remaining_ml')

  if (!finished.length) return 0

  const ids = finished.map(b => b.id)
  await db('batches')
    .whereIn('id', ids)
    .update({
      status: db.raw(`CASE WHEN remaining_ml <= 0 THEN 'Finalizado' ELSE 'Pronto para envase' END`),
      updated_at: db.fn.now()
    })

  await db('batch_movements').insert(finished.map(b => ({
    batch_id: b.id,
    movement_type: 'maceration_complete',
    quantity_ml: 0,
    previous_ml: parseFloat(b.remaining_ml),
    current_ml: parseFloat(b.remaining_ml),
    notes: 'Maceração concluída automaticamente',
    operator: 'system'
  })))

  return finished.length
}

module.exports = { tickAutoFinishMaceration, parseLocalDate, todayLocal, dayDiff }
