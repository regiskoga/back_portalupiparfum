const { db } = require('../models/db')

// `valid_from`/`valid_to` sao colunas DATE, e o driver do Postgres as entrega
// como objeto Date, nao como string. Comparar Date com 'YYYY-MM-DD' direto
// ("row.valid_from > today") coage os dois a numero: a Date vira milissegundos e
// a string vira NaN, e TODA comparacao com NaN e false. O efeito, ate 09/11/2026,
// era a tela de Precos carimbar "Vigente" em cada linha e os filtros Expirado e
// Futuro nunca devolverem nada.
//
// Montado dos componentes LOCAIS de proposito: coluna DATE volta como meia-noite
// local, e toISOString() empurraria para o dia anterior em qualquer fuso a oeste
// de Greenwich (o nosso).
function ymd (v) {
  if (!v) return ''
  if (v instanceof Date) {
    const pad = n => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  }
  return String(v).slice(0, 10)
}

function classify (row) {
  const today = new Date().toISOString().slice(0, 10)
  const de  = ymd(row.valid_from)
  const ate = ymd(row.valid_to)
  if (de && de > today) return 'FUTURO'
  if (ate && ate < today) return 'EXPIRADO'
  return 'VIGENTE'
}

// ─── LIST ─────────────────────────────────────────────────────────────────────
async function list (req, res) {
  try {
    const { product_id, status, busca } = req.query

    let query = db('price_lists as pl')
      .join('products as p', 'p.id', 'pl.product_id')
      .leftJoin('packaging_types as pt', 'pt.id', 'pl.packaging_type_id')
      .select('pl.*', 'p.project_name', 'p.commercial_name', 'pt.name as packaging_type_name')
      .orderBy('p.project_name', 'asc')
      .orderBy('pl.volume_ml', 'asc')
      .orderBy('pl.valid_from', 'desc')

    if (product_id) query = query.where('pl.product_id', parseInt(product_id))

    if (busca) {
      query = query.where(function () {
        this.where('p.project_name', 'ilike', `%${busca}%`)
          .orWhere('p.commercial_name', 'ilike', `%${busca}%`)
      })
    }

    const rows = await query
    const today = new Date().toISOString().slice(0, 10)

    let data = rows.map(r => ({ ...r, status: classify(r) }))

    if (status) data = data.filter(r => r.status === status)

    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
async function create (req, res) {
  try {
    const { product_id, packaging_type_id = null, volume_ml, price, site_price = null, valid_from, valid_to = null, notes = '' } = req.body

    const product = await db('products').where('id', parseInt(product_id)).first()
    if (!product) return res.status(400).json({ error: 'Projeto não encontrado' })

    let resolvedVolume = parseFloat(volume_ml)
    const resolvedPtId = packaging_type_id ? parseInt(packaging_type_id) : null

    if (resolvedPtId && !volume_ml) {
      const pt = await db('packaging_types').where('id', resolvedPtId).first()
      if (pt) resolvedVolume = parseFloat(pt.volume_ml)
    }

    const [row] = await db('price_lists').insert({
      product_id: parseInt(product_id),
      packaging_type_id: resolvedPtId,
      volume_ml: resolvedVolume,
      price: parseFloat(price),
      // Preco do SITE: vazio fica NULL, nao 0. NULL quer dizer "sem excecao,
      // usa a tabela por frasco"; 0 significaria vender de graca.
      site_price: site_price === null || site_price === '' ? null : parseFloat(site_price),
      valid_from,
      valid_to: valid_to || null,
      notes
    }).returning('*')

    const full = await db('price_lists as pl')
      .join('products as p', 'p.id', 'pl.product_id')
      .leftJoin('packaging_types as pt', 'pt.id', 'pl.packaging_type_id')
      .select('pl.*', 'p.project_name', 'p.commercial_name', 'pt.name as packaging_type_name')
      .where('pl.id', row.id)
      .first()

    res.status(201).json({ ...full, status: classify(full) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
async function update (req, res) {
  try {
    const existing = await db('price_lists').where('id', parseInt(req.params.id)).first()
    if (!existing) return res.status(404).json({ error: 'Preço não encontrado' })

    const { volume_ml, packaging_type_id, price, site_price, valid_from, valid_to, notes } = req.body
    const updateData = { updated_at: db.fn.now() }
    if (volume_ml         !== undefined) updateData.volume_ml         = parseFloat(volume_ml)
    if (packaging_type_id !== undefined) updateData.packaging_type_id = packaging_type_id ? parseInt(packaging_type_id) : null
    if (price             !== undefined) updateData.price             = parseFloat(price)
    // Mesma regra do create: limpar o campo na tela volta a valer a tabela
    // por frasco, e para isso tem de gravar NULL e nao 0.
    if (site_price        !== undefined) updateData.site_price        = (site_price === null || site_price === '') ? null : parseFloat(site_price)
    if (valid_from        !== undefined) updateData.valid_from        = valid_from
    if (valid_to          !== undefined) updateData.valid_to          = valid_to || null
    if (notes             !== undefined) updateData.notes             = notes

    await db('price_lists').where('id', parseInt(req.params.id)).update(updateData)

    const full = await db('price_lists as pl')
      .join('products as p', 'p.id', 'pl.product_id')
      .leftJoin('packaging_types as pt', 'pt.id', 'pl.packaging_type_id')
      .select('pl.*', 'p.project_name', 'p.commercial_name', 'pt.name as packaging_type_name')
      .where('pl.id', parseInt(req.params.id))
      .first()

    res.json({ ...full, status: classify(full) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
async function remove (req, res) {
  try {
    const existing = await db('price_lists').where('id', parseInt(req.params.id)).first()
    if (!existing) return res.status(404).json({ error: 'Preço não encontrado' })
    await db('price_lists').where('id', parseInt(req.params.id)).del()
    res.json({ message: 'Preço removido' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

module.exports = { list, create, update, remove }
