const { db } = require('../models/db')

// ─── Despesas lançadas à mão (Balancete Mensal) ───────────────────────────────
// Gasto que não passa pelo cadastro de insumos: caixa de papelão, papel kraft,
// plástico bolha, etiqueta de impressora, frasco de maceração. Não tem saldo nem
// rastreabilidade — é só dinheiro que saiu, com data e descrição.

// `month` = 'YYYY-MM'. Filtrar por texto em vez de intervalo de datas erraria o
// fuso; aqui a coluna é DATE (sem hora), então o recorte é exato.
function filtroMes (query, month) {
  if (!month) return query
  const [ano, mes] = String(month).split('-').map(Number)
  if (!ano || !mes) return query
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fimMes = new Date(ano, mes, 0).getDate()          // dia 0 do mês seguinte
  const fim    = `${ano}-${String(mes).padStart(2, '0')}-${fimMes}`
  return query.where('expense_date', '>=', inicio).where('expense_date', '<=', fim)
}

async function list (req, res) {
  try {
    let query = db('monthly_expenses').orderBy('expense_date', 'desc').orderBy('id', 'desc')
    query = filtroMes(query, req.query.month)
    if (req.query.category) query = query.where('category', req.query.category)
    res.json(await query)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// Categorias já usadas — alimentam o autocompletar da tela para ele não digitar
// "Embalagem" e "embalagens" e acabar com duas categorias que são a mesma.
async function categories (_req, res) {
  try {
    const rows = await db('monthly_expenses')
      .whereNot('category', '')
      .whereNotNull('category')
      .groupBy('category')
      .orderBy('category')
      .select('category')
    res.json(rows.map(r => r.category))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function getOne (req, res) {
  try {
    const row = await db('monthly_expenses').where('id', parseInt(req.params.id)).first()
    if (!row) return res.status(404).json({ error: 'Despesa não encontrada' })
    res.json(row)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function create (req, res) {
  try {
    const { expense_date, description, amount, category = '', notes = '' } = req.body
    const [row] = await db('monthly_expenses').insert({
      expense_date,
      description: String(description).trim(),
      amount: parseFloat(amount),
      category: String(category || '').trim(),
      notes: String(notes || '').trim(),
    }).returning('*')
    // Sem ActivityLogger de propósito: ele montaria o tipo
    // `monthly_expense_created`, que não está no CHECK `activity_logs_activity_type_check`
    // — o insert é recusado e o logger ENGOLE o erro, então cada despesa gravaria
    // com um log perdido em silêncio (verificado no sandbox). Colocar o tipo novo
    // no CHECK exige DROP + recriação com todos os valores atuais, que é a
    // migration mais arriscada deste projeto, e não vale por uma linha de despesa
    // manual. Mesma decisão já tomada para parceiro/comissão/resgate.
    res.status(201).json(row)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

async function update (req, res) {
  try {
    const id = parseInt(req.params.id)
    const existing = await db('monthly_expenses').where('id', id).first()
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' })

    const fields = { updated_at: db.fn.now() }
    if (req.body.expense_date !== undefined) fields.expense_date = req.body.expense_date
    if (req.body.description  !== undefined) fields.description  = String(req.body.description).trim()
    if (req.body.amount       !== undefined) fields.amount       = parseFloat(req.body.amount)
    if (req.body.category     !== undefined) fields.category     = String(req.body.category || '').trim()
    if (req.body.notes        !== undefined) fields.notes        = String(req.body.notes || '').trim()

    const [row] = await db('monthly_expenses').where('id', id).update(fields).returning('*')
    res.json(row)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

async function remove (req, res) {
  try {
    const id = parseInt(req.params.id)
    const existing = await db('monthly_expenses').where('id', id).first()
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' })
    await db('monthly_expenses').where('id', id).del()
    res.json({ message: 'Despesa removida', id })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

module.exports = { list, categories, getOne, create, update, remove }
