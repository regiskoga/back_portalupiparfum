const xlsx = require('xlsx')
const { db } = require('../models/db')

// ══════════════════════════════════════════════════════════════════════════════
// IMPORTAÇÃO DE DADOS — Template alinhado às TELAS do sistema
// Cada aba do .xlsx corresponde a um cadastro do app.
// Apenas a chave natural (PK) e FK fundamentais são obrigatórias —
// o resto é opcional. Lote pode ser criado sem essência vinculada
// (carga inicial). Abas vazias ou ausentes são ignoradas sem erro.
// ══════════════════════════════════════════════════════════════════════════════

const EXAMPLE_MARK = '[EXEMPLO]'

const TEMPLATE = {
  Fornecedores: {
    title: 'Tela: Estoque → Fornecedores',
    headers: ['Nome', 'Tipo', 'CNPJ', 'Contato', 'Email', 'Telefone', 'Endereço', 'Observações'],
    example: [
      [`${EXAMPLE_MARK} Fragella Essências`, 'Essence', '12.345.678/0001-90', 'João Silva', 'contato@forn.com.br', '(11) 99999-9999', 'Rua A, 100 — SP', 'Fornecedor principal de essências'],
      [`${EXAMPLE_MARK} Mercado Livre`, 'Other', '', '', '', '', '', 'Utensílios diversos']
    ]
  },

  Projetos: {
    title: 'Tela: Produção → Projetos',
    headers: ['Nome do Projeto', 'Nome Comercial', 'SKU', 'Marca Inspiração', 'Nome Inspiração', 'Gênero', 'Descrição do Conceito', 'Notas de Saída', 'Notas de Coração', 'Notas de Fundo', 'Observações'],
    example: [
      [`${EXAMPLE_MARK} Dragon Tea X`, 'Wulong Cha X - Dragon Tea X', 'PFM-001', 'Nishane', 'Wulong Cha', 'Unissex', 'Notas cítricas com chá verde — fragrância luminosa e mística.', 'Bergamota, limão', 'Chá oolong, gengibre', 'Cedro, almíscar', 'Pronúncia: Druagan tee']
    ]
  },

  Frascos: {
    title: 'Tela: Estoque → Frascos',
    headers: ['Nome', 'Tipo de Embalagem', 'Fornecedor', 'Data da Compra', 'Quantidade Comprada', 'Total Pago (R$)', 'Preço Ideal/un', 'Saldo Disponível', 'Lote/NF', 'Status de Recebimento', 'Observações'],
    example: [
      [`${EXAMPLE_MARK} Frasco Vidro 30ml`, 'Frasco 30ml', 'Fragella Essências', '2026-03-15', 30, 234.86, 7.00, 30, 'NF-12345', 'Recebido', 'Tampa dourada']
    ]
  },

  Essencias: {
    title: 'Tela: Estoque → Compras de Essências',
    headers: ['Nome', 'Fornecedor', 'Data da Compra', 'Qtd Comprada (ml)', 'Total Pago (R$)', 'Preço Ideal/ml', 'Saldo Disponível (ml)', 'Lote/NF', 'Observações'],
    example: [
      [`${EXAMPLE_MARK} Essência Wulong Cha`, 'Fragella Essências', '2026-03-15', 60, 48.83, 0.80, 60, '', '']
    ]
  },

  'Outros Insumos': {
    title: 'Tela: Estoque → Insumos (Chemical/Base/Packaging/Label)',
    headers: ['Nome', 'Tipo', 'Fornecedor', 'Unidade', 'Data da Compra', 'Quantidade Comprada', 'Total Pago (R$)', 'Preço Ideal', 'Saldo Disponível', 'Lote/NF', 'Observações'],
    example: [
      [`${EXAMPLE_MARK} Álcool 96°`, 'Chemical', 'Nordeste Quim.', 'ml', '2026-03-15', 5000, 65.00, 0.015, 5000, '', ''],
      [`${EXAMPLE_MARK} Rótulo 50ml`, 'Label', 'Mercado Livre', 'unidade', '2026-03-15', 500, 75.00, 0.15, 500, '', '']
    ]
  },

  Formulas: {
    title: 'Tela: Produção → Fórmulas',
    headers: ['Nome', 'Descrição', '% Essência', 'Projeto (opcional)', 'Ingrediente 1', '% 1', 'Ingrediente 2', '% 2', 'Ingrediente 3', '% 3', 'Ingrediente 4', '% 4', 'Ingrediente 5', '% 5'],
    example: [
      [`${EXAMPLE_MARK} Fórmula Base v1`, 'EDP/Parfum 80/16/2/2 — sem base pronta', 16, '', 'Álcool 96°', 80, 'Propilenoglicol', 2, 'Fixador Premium', 2, '', '', '', '']
    ]
  },

  Lotes: {
    title: 'Tela: Produção → Lotes (essência opcional na carga inicial)',
    headers: ['Código do Lote', 'Data de Produção', 'Fórmula', 'Projeto', 'Volume Total (ml)', 'ml Disponível', 'Status', 'Início Maceração', 'Fim Maceração', 'Essência Usada (nome)', 'Essência Usada (ml)', 'Custo Total (R$)', 'Observações'],
    example: [
      [`${EXAMPLE_MARK} LOTE-001`, '2026-03-20', 'Fórmula Base v1', 'Dragon Tea X', 187.5, 87.5, 'Pronto para envase', '2026-03-20', '2026-03-30', '', '', 150.00, 'Lote inicial sem essência vinculada'],
      [`${EXAMPLE_MARK} LOTE-002`, '2026-04-10', 'Fórmula Base v1', 'Dragon Tea X', 200, 200, 'Em maceração', '2026-04-10', '2026-04-20', 'Essência Wulong Cha', 32, 180.00, 'Lote novo com essência vinculada']
    ]
  },

  Envases: {
    title: 'Tela: Produção → Envases',
    headers: ['Código', 'Data do Envase', 'Projeto', 'Lote', 'Frasco', 'Rótulo', 'Volume (ml)', 'Qtd Produzida', 'Qtd Disponível', 'Tipo (normal/brinde)', 'Observações'],
    example: [
      [`${EXAMPLE_MARK} ENV-001`, '2026-03-25', 'Dragon Tea X', 'LOTE-001', 'Frasco Vidro 30ml', '', 30, 1, 1, 'normal', '']
    ]
  },

  Clientes: {
    title: 'Tela: Comercial → Clientes',
    headers: ['Nome', 'CPF/CNPJ', 'Telefone', 'Email', 'Endereço', 'Cidade', 'UF', 'CEP', 'Observações'],
    example: [
      [`${EXAMPLE_MARK} Maria Silva`, '123.456.789-00', '(11) 98888-7777', 'maria@email.com', 'Av. B, 200', 'São Paulo', 'SP', '01234-567', 'Cliente frequente']
    ]
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════
function normalizeKey (s) {
  if (s == null) return ''
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseExcelDate (v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') {
    const d = xlsx.SSF.parse_date_code(v)
    if (!d) return null
    const pad = n => String(n).padStart(2, '0')
    return `${d.y}-${pad(d.m)}-${pad(d.d)}`
  }
  if (typeof v === 'string') {
    const s = v.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
    if (m) {
      const [, d, mo, y] = m
      const yyyy = y.length === 2 ? '20' + y : y
      return `${yyyy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    return null
  }
  return null
}

function toNumber (v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function toString (v) {
  if (v == null) return ''
  return String(v).trim()
}

function normalizeGender (v) {
  if (!v) return 'Unissex'
  const s = String(v).trim().toLowerCase()
  if (s.startsWith('masc')) return 'Masculino'
  if (s.startsWith('fem')) return 'Feminino'
  return 'Unissex'
}

function normalizeReceiptStatus (v) {
  if (!v) return 'Recebido'
  const s = String(v).trim().toLowerCase()
  if (s.startsWith('rec') || s.startsWith('compr')) return 'Recebido'
  if (s.startsWith('pend')) return 'Pendente'
  if (s.startsWith('canc')) return 'Cancelado'
  return 'Recebido'
}

function normalizeUnit (v) {
  if (!v) return 'unidade'
  const s = String(v).trim().toLowerCase()
  if (s.startsWith('ml')) return 'ml'
  if (s === 'g' || s.startsWith('grama')) return 'g'
  return 'unidade'
}

function sheetToRows (ws) {
  const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false })
  if (raw.length < 1) return []
  // Auto-detect header row (≥2 string cells)
  let headerIdx = 0
  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    const cells = (raw[i] || []).filter(c => typeof c === 'string' && c.trim())
    if (cells.length >= 2) { headerIdx = i; break }
  }
  const headers = (raw[headerIdx] || []).map(h => normalizeKey(h))
  const rows = []
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i]
    if (!row || row.every(c => c == null || c === '')) continue
    if (toString(row[0]).startsWith(EXAMPLE_MARK)) continue
    const obj = {}
    headers.forEach((h, j) => { if (h) obj[h] = row[j] })
    obj._row = i + 1
    rows.push(obj)
  }
  return rows
}

function getCol (row, ...aliases) {
  for (const a of aliases) {
    const k = normalizeKey(a)
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]
  }
  return null
}

// ──────────────────────────────────────────────────────────────────────────────
// AUTO-LOOKUPS (criam registro mínimo quando referência não existe)
// ──────────────────────────────────────────────────────────────────────────────
const supplierCache = new Map()

async function ensureSupplier (trx, name) {
  if (!name) return null
  const key = name.toLowerCase()
  if (supplierCache.has(key)) return supplierCache.get(key)
  let s = await trx('suppliers').whereRaw('LOWER(name) = ?', key).first()
  if (!s) {
    const [inserted] = await trx('suppliers').insert({
      name, type: '', tax_id: '', contact: '', email: '', phone: '', address: '',
      notes: 'Auto-criado pela importação', active: true
    }).returning('id')
    s = { id: typeof inserted === 'object' ? inserted.id : inserted, name }
  }
  supplierCache.set(key, s)
  return s
}

async function findProduct (trx, { sku, commercialName, projectName }) {
  if (sku) {
    const p = await trx('products').where('sku', sku).first()
    if (p) return p
  }
  if (commercialName) {
    const p = await trx('products').where('commercial_name', commercialName).first()
    if (p) return p
  }
  if (projectName) {
    const p = await trx('products').where('project_name', projectName).first()
    if (p) return p
  }
  return null
}

async function findSupplyByName (trx, name, type) {
  if (!name) return null
  let q = trx('supplies').whereRaw('LOWER(name) = ?', name.toLowerCase())
  if (type) q = q.where('type', type)
  return q.orderBy('purchase_date', 'desc').first()
}

// ══════════════════════════════════════════════════════════════════════════════
// PROCESSADORES POR ABA
// ══════════════════════════════════════════════════════════════════════════════
const VALID_SUPPLIER_TYPES = ['Essence', 'Base', 'Chemical', 'Packaging', 'Bottle', 'Label', 'Multiple', 'Other']
const VALID_SUPPLY_TYPES   = ['Essence', 'Base', 'Chemical', 'Packaging', 'Bottle', 'Label']
const VALID_BATCH_STATUS   = ['Em maceração', 'Pronto para envase', 'Finalizado']
const VALID_BOTTLING_TYPES = ['normal', 'brinde']

async function processFornecedores (trx, rows, dryRun) {
  const errors = []; let ok = 0
  for (const r of rows) {
    const nome = toString(getCol(r, 'Nome'))
    if (!nome) { errors.push({ row: r._row, msg: 'Nome obrigatório' }); continue }
    let tipo = toString(getCol(r, 'Tipo'))
    if (tipo && !VALID_SUPPLIER_TYPES.includes(tipo)) {
      errors.push({ row: r._row, msg: `Tipo "${tipo}" inválido. Use: ${VALID_SUPPLIER_TYPES.join(', ')}` }); continue
    }
    if (dryRun) { ok++; continue }
    const data = {
      name: nome,
      type: tipo || '',
      tax_id: toString(getCol(r, 'CNPJ')),
      contact: toString(getCol(r, 'Contato')),
      email: toString(getCol(r, 'Email')),
      phone: toString(getCol(r, 'Telefone')),
      address: toString(getCol(r, 'Endereço', 'Endereco')),
      notes: toString(getCol(r, 'Observações', 'Observacoes')),
      active: true
    }
    const existing = await trx('suppliers').whereRaw('LOWER(name) = ?', nome.toLowerCase()).first()
    if (existing) {
      await trx('suppliers').where('id', existing.id).update(data)
      supplierCache.set(nome.toLowerCase(), { id: existing.id, name: nome })
    } else {
      const [ins] = await trx('suppliers').insert(data).returning('id')
      supplierCache.set(nome.toLowerCase(), { id: typeof ins === 'object' ? ins.id : ins, name: nome })
    }
    ok++
  }
  return { ok, errors }
}

async function processProjetos (trx, rows, dryRun) {
  const errors = []; let ok = 0
  for (const r of rows) {
    const nome = toString(getCol(r, 'Nome do Projeto'))
    if (!nome) { errors.push({ row: r._row, msg: 'Nome do Projeto obrigatório' }); continue }
    if (dryRun) { ok++; continue }
    const sku = toString(getCol(r, 'SKU')) || null
    const data = {
      project_name: nome,
      commercial_name: toString(getCol(r, 'Nome Comercial')),
      sku,
      inspiration_brand: toString(getCol(r, 'Marca Inspiração', 'Marca Inspiracao')),
      inspiration_name: toString(getCol(r, 'Nome Inspiração', 'Nome Inspiracao')),
      gender: normalizeGender(getCol(r, 'Gênero', 'Genero')),
      narrative: toString(getCol(r, 'Descrição do Conceito', 'Descricao do Conceito', 'Narrativa')),
      top_notes: toString(getCol(r, 'Notas de Saída', 'Notas de Saida')),
      heart_notes: toString(getCol(r, 'Notas de Coração', 'Notas de Coracao')),
      base_notes: toString(getCol(r, 'Notas de Fundo')),
      notes: toString(getCol(r, 'Observações', 'Observacoes')),
      active: true
    }
    // Upsert por sku ou project_name
    let existing = null
    if (sku) existing = await trx('products').where('sku', sku).first()
    if (!existing) existing = await trx('products').where('project_name', nome).first()
    if (existing) await trx('products').where('id', existing.id).update(data)
    else await trx('products').insert(data)
    ok++
  }
  return { ok, errors }
}

// Genérico para Frascos / Essencias / Outros Insumos
async function processSupply (trx, rows, dryRun, opts) {
  const errors = []; let ok = 0
  for (const r of rows) {
    const nome = toString(getCol(r, 'Nome'))
    if (!nome) { errors.push({ row: r._row, msg: 'Nome obrigatório' }); continue }
    const fornNome = toString(getCol(r, 'Fornecedor'))
    if (!fornNome) { errors.push({ row: r._row, msg: 'Fornecedor obrigatório' }); continue }

    // Quantidade pode vir de "Quantidade Comprada", "Qtd Comprada (ml)" ou "Saldo Disponível"
    const qtd = toNumber(getCol(r, 'Quantidade Comprada', 'Qtd Comprada (ml)'))
    const saldo = toNumber(getCol(r, 'Saldo Disponível', 'Saldo Disponivel', 'Saldo Disponível (ml)', 'Saldo Disponivel (ml)'))
    const qtdComprada = qtd != null ? qtd : saldo
    if (qtdComprada == null || qtdComprada <= 0) {
      errors.push({ row: r._row, msg: 'Quantidade Comprada ou Saldo Disponível inválido' }); continue
    }

    const valor = toNumber(getCol(r, 'Total Pago (R$)', 'Total Pago'))
    if (valor == null || valor < 0) { errors.push({ row: r._row, msg: 'Total Pago inválido' }); continue }

    // Tipo: para "Outros Insumos", lê da coluna Tipo
    let tipo = opts.type
    if (!tipo) {
      tipo = toString(getCol(r, 'Tipo'))
      if (!tipo || !VALID_SUPPLY_TYPES.includes(tipo)) {
        errors.push({ row: r._row, msg: `Tipo inválido. Use: ${VALID_SUPPLY_TYPES.join(', ')}` }); continue
      }
    }

    if (dryRun) { ok++; continue }

    const supplier = await ensureSupplier(trx, fornNome)
    const dataCompra = parseExcelDate(getCol(r, 'Data da Compra')) || new Date().toISOString().slice(0, 10)
    const qtdAvail = saldo != null ? saldo : qtdComprada
    const unit = opts.unit || normalizeUnit(getCol(r, 'Unidade'))

    const data = {
      name: nome,
      type: tipo,
      supplier_id: supplier.id,
      unit,
      quantity_purchased: qtdComprada,
      total_amount_paid: valor,
      quantity_available: qtdAvail,
      purchase_date: dataCompra,
      receipt_status: normalizeReceiptStatus(getCol(r, 'Status de Recebimento')),
      batch: toString(getCol(r, 'Lote/NF', 'Lote NF')),
      bottle_type: toString(getCol(r, 'Tipo de Embalagem')),
      notes: toString(getCol(r, 'Observações', 'Observacoes')),
      is_open: qtdAvail > 0,
      is_formula_ingredient: ['Essence', 'Base', 'Chemical'].includes(tipo),
      ideal_unit_price: toNumber(getCol(r, 'Preço Ideal/un', 'Preço Ideal/ml', 'Preço Ideal', 'Preco Ideal'))
    }

    const existing = await trx('supplies')
      .whereRaw('LOWER(name) = ?', nome.toLowerCase())
      .where('supplier_id', supplier.id)
      .where('purchase_date', dataCompra)
      .first()
    if (existing) await trx('supplies').where('id', existing.id).update(data)
    else await trx('supplies').insert(data)
    ok++
  }
  return { ok, errors }
}

async function processFormulas (trx, rows, dryRun) {
  const errors = []; let ok = 0
  for (const r of rows) {
    const nome = toString(getCol(r, 'Nome'))
    if (!nome) { errors.push({ row: r._row, msg: 'Nome obrigatório' }); continue }
    const essPct = toNumber(getCol(r, '% Essência', 'Essencia')) ?? 0

    if (dryRun) { ok++; continue }

    const projetoNome = toString(getCol(r, 'Projeto (opcional)', 'Projeto'))
    let productId = null
    if (projetoNome) {
      const p = await findProduct(trx, { commercialName: projetoNome, projectName: projetoNome })
      if (p) productId = p.id
    }

    const data = {
      name: nome,
      product_id: productId,
      description: toString(getCol(r, 'Descrição', 'Descricao')),
      essence_percentage: essPct,
      total_percentage: 100,
      active: true,
      validated: true
    }
    const existing = await trx('formulas').where('name', nome).first()
    let formulaId
    if (existing) {
      await trx('formulas').where('id', existing.id).update(data)
      formulaId = existing.id
    } else {
      const [ins] = await trx('formulas').insert(data).returning('id')
      formulaId = typeof ins === 'object' ? ins.id : ins
    }

    // Limpa e recria formula_items (até 5 ingredientes inline)
    await trx('formula_items').where('formula_id', formulaId).del()
    let orderIdx = 0
    for (let i = 1; i <= 5; i++) {
      const ingNome = toString(getCol(r, `Ingrediente ${i}`))
      const ingPct = toNumber(getCol(r, `% ${i}`))
      if (!ingNome || !ingPct || ingPct <= 0) continue
      const supply = await findSupplyByName(trx, ingNome)
      if (!supply) {
        errors.push({ row: r._row, msg: `Ingrediente "${ingNome}" não encontrado — fórmula criada sem este ingrediente vinculado` })
        continue
      }
      await trx('formula_items').insert({
        formula_id: formulaId,
        supply_id: supply.id,
        percentage: ingPct,
        order_index: orderIdx++,
        notes: ''
      })
    }
    ok++
  }
  return { ok, errors }
}

async function processLotes (trx, rows, dryRun) {
  const errors = []; let ok = 0
  for (const r of rows) {
    const codigo = toString(getCol(r, 'Código do Lote', 'Codigo do Lote'))
    if (!codigo) { errors.push({ row: r._row, msg: 'Código do Lote obrigatório' }); continue }
    const dataProd = parseExcelDate(getCol(r, 'Data de Produção', 'Data de Producao'))
    if (!dataProd) { errors.push({ row: r._row, msg: 'Data de Produção inválida' }); continue }
    const volTotal = toNumber(getCol(r, 'Volume Total (ml)'))
    if (volTotal == null || volTotal <= 0) { errors.push({ row: r._row, msg: 'Volume Total (ml) inválido' }); continue }

    if (dryRun) { ok++; continue }

    // Fórmula é OBRIGATÓRIA na lógica do sistema (NOT NULL)
    const formulaNome = toString(getCol(r, 'Fórmula', 'Formula'))
    if (!formulaNome) { errors.push({ row: r._row, msg: 'Fórmula obrigatória (sistema exige formula_id)' }); continue }
    const formula = await trx('formulas').where('name', formulaNome).first()
    if (!formula) { errors.push({ row: r._row, msg: `Fórmula "${formulaNome}" não encontrada — cadastre na aba Formulas primeiro` }); continue }

    // Projeto: opcional, busca por nome
    const projetoNome = toString(getCol(r, 'Projeto'))
    let productId = formula.product_id
    if (projetoNome) {
      const p = await findProduct(trx, { commercialName: projetoNome, projectName: projetoNome })
      if (p) productId = p.id
    }

    let status = toString(getCol(r, 'Status')) || 'Pronto para envase'
    if (!VALID_BATCH_STATUS.includes(status)) status = 'Pronto para envase'

    const mlDisp = toNumber(getCol(r, 'ml Disponível', 'ml Disponivel'))
    const remaining = mlDisp != null ? Math.min(mlDisp, volTotal) : volTotal

    const totalCost = toNumber(getCol(r, 'Custo Total (R$)', 'Custo Total')) ?? 0

    const data = {
      batch_code: codigo,
      formula_id: formula.id,
      product_id: productId,
      production_date: dataProd,
      quantity_ml: volTotal,
      remaining_ml: remaining,
      status,
      maceration_start: parseExcelDate(getCol(r, 'Início Maceração', 'Inicio Maceracao')),
      maceration_end: parseExcelDate(getCol(r, 'Fim Maceração', 'Fim Maceracao')),
      notes: toString(getCol(r, 'Observações', 'Observacoes')),
      active: true,
      reduced_lot_number: 1,
      total_cost: totalCost,
      cost_per_ml: volTotal > 0 ? totalCost / volTotal : 0
    }
    const existing = await trx('batches').where('batch_code', codigo).first()
    let batchId
    if (existing) {
      await trx('batches').where('id', existing.id).update(data)
      batchId = existing.id
    } else {
      const [ins] = await trx('batches').insert(data).returning('id')
      batchId = typeof ins === 'object' ? ins.id : ins
    }

    // Essência: OPCIONAL — só vincula se ambos campos preenchidos
    const essNome = toString(getCol(r, 'Essência Usada (nome)', 'Essencia Usada (nome)'))
    const essMl = toNumber(getCol(r, 'Essência Usada (ml)', 'Essencia Usada (ml)'))
    if (essNome && essMl && essMl > 0) {
      const ess = await findSupplyByName(trx, essNome, 'Essence')
      if (ess) {
        await trx('batch_essences').where('batch_id', batchId).del()
        await trx('batch_essences').insert({
          batch_id: batchId,
          supply_id: ess.id,
          quantity: essMl,
          unit: 'ml'
        })
      } else {
        errors.push({ row: r._row, msg: `Essência "${essNome}" não encontrada — lote importado sem vínculo de essência` })
      }
    }
    ok++
  }
  return { ok, errors }
}

async function processEnvases (trx, rows, dryRun) {
  const errors = []; let ok = 0
  for (const r of rows) {
    const codigo = toString(getCol(r, 'Código'))
    if (!codigo) { errors.push({ row: r._row, msg: 'Código obrigatório' }); continue }
    const dataEnv = parseExcelDate(getCol(r, 'Data do Envase'))
    if (!dataEnv) { errors.push({ row: r._row, msg: 'Data do Envase inválida' }); continue }
    const volume = toNumber(getCol(r, 'Volume (ml)'))
    if (volume == null || volume <= 0) { errors.push({ row: r._row, msg: 'Volume (ml) inválido' }); continue }
    const qtdProd = toNumber(getCol(r, 'Qtd Produzida')) ?? 1

    if (dryRun) { ok++; continue }

    const projetoNome = toString(getCol(r, 'Projeto'))
    const product = projetoNome ? await findProduct(trx, { commercialName: projetoNome, projectName: projetoNome }) : null

    const loteCod = toString(getCol(r, 'Lote'))
    let batchId = null
    if (loteCod) {
      const b = await trx('batches').where('batch_code', loteCod).first()
      if (b) batchId = b.id
      else errors.push({ row: r._row, msg: `Lote "${loteCod}" não encontrado — envase importado sem vínculo com lote` })
    }

    const frascoNome = toString(getCol(r, 'Frasco'))
    let bottleId = null
    if (frascoNome) {
      const fs = await findSupplyByName(trx, frascoNome, 'Bottle')
      if (fs) bottleId = fs.id
      else errors.push({ row: r._row, msg: `Frasco "${frascoNome}" não encontrado — envase importado sem vínculo de frasco` })
    }

    const rotuloNome = toString(getCol(r, 'Rótulo', 'Rotulo'))
    let labelId = null
    if (rotuloNome) {
      const ls = await findSupplyByName(trx, rotuloNome, 'Label')
      if (ls) labelId = ls.id
      else errors.push({ row: r._row, msg: `Rótulo "${rotuloNome}" não encontrado — envase importado sem vínculo de rótulo` })
    }

    let tipo = toString(getCol(r, 'Tipo (normal/brinde)', 'Tipo')).toLowerCase() || 'normal'
    if (!VALID_BOTTLING_TYPES.includes(tipo)) tipo = 'normal'

    const qtdAvail = toNumber(getCol(r, 'Qtd Disponível', 'Qtd Disponivel')) ?? qtdProd
    const productName = product ? (product.commercial_name || product.project_name) : (projetoNome || 'Sem nome')

    const data = {
      bottling_code: codigo,
      bottling_date: dataEnv,
      product_name: productName,
      product_ref: product ? (product.sku || '') : '',
      volume_ml: volume,
      quantity: qtdProd,
      quantity_available: qtdAvail,
      type: tipo,
      bottle_supply_id: bottleId,
      label_supply_id: labelId,
      notes: toString(getCol(r, 'Observações', 'Observacoes')),
      active: true,
      liquid_cost: 0, bottle_cost: 0, label_cost: 0, total_cost: 0, unit_cost: 0
    }
    const existing = await trx('bottlings').where('bottling_code', codigo).first()
    let bottlingId
    if (existing) {
      await trx('bottlings').where('id', existing.id).update(data)
      bottlingId = existing.id
    } else {
      const [ins] = await trx('bottlings').insert(data).returning('id')
      bottlingId = typeof ins === 'object' ? ins.id : ins
    }

    if (batchId) {
      const link = await trx('bottling_batches').where('bottling_id', bottlingId).where('batch_id', batchId).first()
      if (!link) {
        await trx('bottling_batches').insert({
          bottling_id: bottlingId, batch_id: batchId,
          ml_used: volume * qtdProd, proportional_cost: 0
        })
      }
    }
    ok++
  }
  return { ok, errors }
}

async function processClientes (trx, rows, dryRun) {
  const errors = []; let ok = 0
  for (const r of rows) {
    const nome = toString(getCol(r, 'Nome'))
    if (!nome) { errors.push({ row: r._row, msg: 'Nome obrigatório' }); continue }
    if (dryRun) { ok++; continue }
    const data = {
      name: nome,
      tax_id: toString(getCol(r, 'CPF/CNPJ', 'CPF', 'CNPJ')),
      phone: toString(getCol(r, 'Telefone')),
      email: toString(getCol(r, 'Email')),
      address: toString(getCol(r, 'Endereço', 'Endereco')),
      city: toString(getCol(r, 'Cidade')),
      state: toString(getCol(r, 'UF')),
      zip_code: toString(getCol(r, 'CEP')),
      notes: toString(getCol(r, 'Observações', 'Observacoes'))
    }
    const existing = await trx('customers').whereRaw('LOWER(name) = ?', nome.toLowerCase()).first()
    if (existing) await trx('customers').where('id', existing.id).update(data)
    else await trx('customers').insert(data)
    ok++
  }
  return { ok, errors }
}

// ══════════════════════════════════════════════════════════════════════════════
// PARSE + ORQUESTRADOR
// ══════════════════════════════════════════════════════════════════════════════
function parseWorkbook (buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false })
  const out = {}
  for (const sheetName of Object.keys(TEMPLATE)) {
    const ws = wb.Sheets[sheetName]
    out[sheetName] = ws ? sheetToRows(ws) : []
  }
  return out
}

// Mapa aba → função processadora (com opts quando necessário)
const SHEET_PROCESSORS = {
  'Fornecedores':   { fn: processFornecedores },
  'Projetos':       { fn: processProjetos },
  'Frascos':        { fn: processSupply, opts: { type: 'Bottle', unit: 'unidade' } },
  'Essencias':      { fn: processSupply, opts: { type: 'Essence', unit: 'ml' } },
  'Outros Insumos': { fn: processSupply, opts: { type: null } },
  'Formulas':       { fn: processFormulas },
  'Lotes':          { fn: processLotes },
  'Envases':        { fn: processEnvases },
  'Clientes':       { fn: processClientes }
}

// Processa todas as abas ou apenas uma (se sheetName for fornecido)
async function processAll (parsed, dryRun, sheetName = null) {
  supplierCache.clear()
  const result = {}
  const sheetsToProcess = sheetName ? [sheetName] : Object.keys(SHEET_PROCESSORS)
  await db.transaction(async (trx) => {
    for (const s of sheetsToProcess) {
      const cfg = SHEET_PROCESSORS[s]
      if (!cfg) continue
      const rows = parsed[s] || []
      result[s] = cfg.opts
        ? await cfg.fn(trx, rows, dryRun, cfg.opts)
        : await cfg.fn(trx, rows, dryRun)
    }
    if (dryRun) throw new Error('__DRY_RUN_ROLLBACK__')
  }).catch(err => {
    if (err.message !== '__DRY_RUN_ROLLBACK__') throw err
  })
  return result
}

// ══════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════
function buildTemplateBuffer (only = null) {
  const wb = xlsx.utils.book_new()
  const sheets = only ? [only] : Object.keys(TEMPLATE)
  for (const sheetName of sheets) {
    const def = TEMPLATE[sheetName]
    if (!def) continue
    const rows = [[def.title], def.headers, ...def.example]
    const ws = xlsx.utils.aoa_to_sheet(rows)
    ws['!cols'] = def.headers.map(() => ({ wch: 24 }))
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: def.headers.length - 1 } }]
    xlsx.utils.book_append_sheet(wb, ws, sheetName)
  }
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

async function generateTemplate (req, res) {
  try {
    const sheet = req.query.sheet || null
    if (sheet && !TEMPLATE[sheet]) {
      return res.status(400).json({ error: `Aba "${sheet}" desconhecida` })
    }
    const buf = buildTemplateBuffer(sheet)
    const fileName = sheet
      ? `template_${sheet.replace(/\s+/g, '_').toLowerCase()}.xlsx`
      : 'template_importacao_perfumaria.xlsx'
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`
    })
    res.send(buf)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function preview (req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo .xlsx não enviado' })
    const sheet = req.query.sheet || null
    if (sheet && !TEMPLATE[sheet]) {
      return res.status(400).json({ error: `Aba "${sheet}" desconhecida` })
    }
    const parsed = parseWorkbook(req.file.buffer)
    const result = await processAll(parsed, true, sheet)
    res.json({ dryRun: true, result })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

async function commit (req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo .xlsx não enviado' })
    const sheet = req.query.sheet || null
    if (sheet && !TEMPLATE[sheet]) {
      return res.status(400).json({ error: `Aba "${sheet}" desconhecida` })
    }
    const parsed = parseWorkbook(req.file.buffer)
    const validation = await processAll(parsed, true, sheet)
    const hardErrors = Object.values(validation).reduce((s, v) =>
      s + v.errors.filter(e => /obrigatóri|inválid/i.test(e.msg)).length, 0)
    if (hardErrors > 0) {
      return res.status(400).json({
        error: 'Erros bloqueantes na planilha. Corrija antes de confirmar.',
        result: validation
      })
    }
    const result = await processAll(parsed, false, sheet)
    res.json({ dryRun: false, result })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

module.exports = { generateTemplate, preview, commit }
