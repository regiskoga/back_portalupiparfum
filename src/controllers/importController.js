const xlsx = require('xlsx')
const { db } = require('../models/db')

// ──────────────────────────────────────────────────────────────────────────────
// Template — abas, cabeçalhos e linhas de exemplo
// Cabeçalhos seguem EXATAMENTE o vocabulário da planilha "Precificação perfumes.xlsx"
// para que o usuário possa copiar colunas inteiras sem renomear nada.
// ──────────────────────────────────────────────────────────────────────────────
const EXAMPLE_MARK = '[EXEMPLO]'

const TEMPLATE = {
  // Aba auxiliar criada pelo sistema (não existe na planilha original).
  // É opcional — se estiver vazia, fornecedores são auto-criados a partir das
  // outras abas que citam nomes em "Fornecedor".
  Fornecedores: {
    headers: ['Nome', 'Tipo', 'CNPJ', 'Contato', 'Email', 'Telefone', 'Endereço', 'Observações'],
    example: [
      [`${EXAMPLE_MARK} Fornecedor 1`, 'Essence', '12.345.678/0001-90', 'João Silva', 'contato@forn.com.br', '(11) 99999-9999', 'Rua A, 100 — SP', 'Fornecedor principal de essências'],
      [`${EXAMPLE_MARK} Mercado Livre`, 'Other', '', '', '', '', '', 'Utensílios e investimentos']
    ]
  },

  // Aba 1 da planilha — utensílios e investimento
  'Investimento': {
    headers: ['Data', 'Nome Material', 'Valor', 'Unidade Ou Volume', 'Unidades/Volumetria', 'Valor/unidade', 'Fornecedor', 'Valor ideal para lucratividade', 'Boa compra?'],
    example: [
      [`${EXAMPLE_MARK} 2026-03-15`, 'Copos Becker (5 unidades)', 32.98, 'Unidade', 5, 6.59, 'Mercado Livre', '', '']
    ]
  },

  // Aba 3 — compras de frascos
  'Cadastro de Frascos': {
    headers: ['Data', 'Nome do Material', 'Descrição do Frasco detalhada', 'Descrição', 'Valor total', 'Unidade ou Volume', 'Unidades', 'Valor por Unidade/volume', 'Fornecedor', 'Valor ideal para lucratividade', 'Boa compra?', 'Disponiveis', 'Status', 'Recebido pelo fornecedor?', 'Entra na Contagem da Tabela Dinamica?'],
    example: [
      [`${EXAMPLE_MARK} 2026-03-15`, 'Frasco de Vidros 30ml (30 unidades)', 'Frasco 30ml com válvula spray — Lote 1', 'Frasco 30ml', 234.86, 'Unidade', 30, 7.83, 'Fornecedor 1', 7, '', 30, 'Disponivel', 'Recebido', 's']
    ]
  },

  // Aba 4 — compras de essências (alimenta também produtos via Inspiração)
  'Compras de Essencias': {
    headers: ['Data', 'Cód Fornecedor', 'Fornecedor', 'Marca da Inspiração', 'Inspiração', 'Item comprado', 'Sexo', 'Valor', 'Volume (ml)', 'Valor por ML', 'Situação de Compra', 'Catalogado', 'Utilizado'],
    example: [
      [`${EXAMPLE_MARK} 2026-03-15`, '00001', 'Fornecedor 1', 'Nishane', 'Wulong Cha X', 'Item 2', 'Compartilhavel', 48.83, 60, 0.81, 'Comprado', 'S', 30]
    ]
  },

  // Aba 5 — híbrida: cada linha gera Fórmula + Lote + batch_essences + formula_items
  'Fórmulas sem Base Pronta': {
    headers: ['Código da produção', 'Ordem de Produção', 'Data Fabricação', 'Cód Fornecedor', 'Fornecedor', 'Inspiração', 'Sexo', 'Valor', 'Volume (ml)', 'Tipo de Perfume', 'Alcool (%)', 'Essência (%)', 'Propilenoglicol (%)', 'Fixador (%)', 'Água Desmineralizada (%)', 'Nome Utilizado', 'Qtd Frasco Utilizado', 'Custo Essencia Utilizada', 'Alcool Usado (1º)', 'Essência Usada (2º)', 'Fixador Usado (3º)', 'Propilenoglicol usado (4º)', 'Agua usada (5º)', 'Custo Alcool', 'Custo Propileno', 'Custo Fixador', 'Custo Água', 'Total Produzido (ml)', 'Custo por ML', 'ML Utilizados', 'Sobra', 'Status', 'Cód do Perfume', 'Nome Comercial', 'obs', 'Etiqueta vidro Ambar', 'Álcool utilizado', 'Qual Fixador usou', '(Di)Propilenoglicol Utilizado'],
    example: [
      [`${EXAMPLE_MARK} 00005`, '20260903_00001_00005_BNP', '2026-09-03', '00001', 'Fornecedor 1', 'Wulong Cha X', 'Compartilhavel', 200, 60, 'EDP/Parfum', 80, 16, 2, 2, 0, 'Dragon Tea X', 0.5, 100, 150, 30, 3.75, 3.75, 0, 3, 0.405, 2.5, 0, 187.5, 0.5648, 100, 87.5, 'Em aberto', '1.1', 'Wulong Cha X - Dragon Tea X', '27ml de base apenas', '', 'Álcool 96°', 'Fixador Premium', 'Propilenoglicol']
    ]
  },

  // Aba 7 — envases (frascos produzidos)
  'Produção Frascos': {
    headers: ['Ordem de Produção', 'Lote', 'Cód Frasco', 'Fabricação (lote)', 'Vencimento', 'Perfume', 'Ref. Olfativa', 'Base', 'Frasco', 'Volume', 'Valor Frasco', 'Valor Volume', 'Outros Custos', 'Custo Perfume', 'Preço Sugerido de Venda', 'MACO', 'Valor Lucro Esperado por frasco', 'Qtd Produzida', 'Volume total (soma qtd prod)', 'Data do Envase', 'Status', 'Comprador', 'Valor Vendido', '% Lucro Real', 'Lucro Real', 'Cód Perfume', 'Nome Comercial', 'CHAVE'],
    example: [
      [`${EXAMPLE_MARK} 0000000001`, '20260831_00004_00001_BP', '0000000001F050', '2026-08-31', '', 'Dragon Tea X', 'Wulong Cha X', 'BP', 'Frasco de Vidro Luxo 50 ml - Lote 1', 50, 17.46, '', 4, '', 75.9, '', '', 1, 50, '2026-09-10', 'Vendido', 'Rafa (Cris)', 79.9, '', '', '', 'Wulong Cha X - Dragon Tea X', '']
    ]
  },

  // Aba 8 — descrição de perfumes (catálogo)
  'Descrição Perfumes': {
    headers: ['Cod', 'Perfume (Projeto)', 'Inspiração (Referência)', 'Gênero Olfativo', 'Narrativa (Versão 1)', 'Pronuncia', 'Personagens', 'B1', 'D110'],
    example: [
      [`${EXAMPLE_MARK} 1.1`, 'Dragon Tea X', 'Wulong Cha X', 'Compartilhavel', 'Entre o frescor cítrico e o calor do dragão…', 'Druagan tee X', 'Keanu Reeves / Mulan (Disney)', 'Wulong Cha X - Dragon Tea X', '']
    ]
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function normalizeKey (s) {
  if (s == null) return ''
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
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
  if (s.startsWith('compart') || s.startsWith('unis')) return 'Unissex'
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
  if (s.startsWith('unid')) return 'unidade'
  return 'unidade'
}

function sheetToRows (ws) {
  // Lê a aba como lista de objetos com chaves normalizadas (sem acento, sem espaço).
  // Ignora linhas vazias e linhas-exemplo (que começam com [EXEMPLO]).
  const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false })
  if (raw.length < 1) return { headers: [], rows: [] }

  // Acha a primeira linha que parece cabeçalho (>=2 células texto não-vazias)
  let headerIdx = 0
  for (let i = 0; i < Math.min(raw.length, 6); i++) {
    const textCells = (raw[i] || []).filter(c => typeof c === 'string' && c.trim().length > 0)
    if (textCells.length >= 2) { headerIdx = i; break }
  }

  const headerRow = raw[headerIdx] || []
  const headers = headerRow.map(h => normalizeKey(h))
  const rows = []
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i]
    if (!row || row.every(c => c == null || c === '')) continue
    const firstStr = toString(row[0])
    if (firstStr.startsWith(EXAMPLE_MARK)) continue
    const obj = {}
    headers.forEach((h, j) => { if (h) obj[h] = row[j] })
    obj._row = i + 1
    rows.push(obj)
  }
  return { headers, rows }
}

// Recupera valor da linha usando uma lista de aliases possíveis
function getCol (row, ...aliases) {
  for (const a of aliases) {
    const k = normalizeKey(a)
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]
  }
  return null
}

// ──────────────────────────────────────────────────────────────────────────────
// SUPPLIER LOOKUP / AUTO-CREATE
// Cria fornecedor com nome mínimo se não existir.
// ──────────────────────────────────────────────────────────────────────────────
const supplierCache = new Map()
async function ensureSupplier (trx, name) {
  if (!name) return null
  const key = name.toLowerCase()
  if (supplierCache.has(key)) return supplierCache.get(key)
  let s = await trx('suppliers').whereRaw('LOWER(name) = ?', key).first()
  if (!s) {
    const [inserted] = await trx('suppliers').insert({
      name, type: '', tax_id: '', contact: '', email: '', phone: '', address: '', notes: 'Auto-criado pela importação', active: true
    }).returning('id')
    const id = typeof inserted === 'object' ? inserted.id : inserted
    s = { id, name }
  }
  supplierCache.set(key, s)
  return s
}

// ──────────────────────────────────────────────────────────────────────────────
// PRODUCT LOOKUP / AUTO-CREATE
// Procura por commercial_name, sku, ou (inspiration_name + inspiration_brand)
// ──────────────────────────────────────────────────────────────────────────────
async function ensureProduct (trx, { sku, commercialName, projectName, inspirationName, inspirationBrand, gender }) {
  if (!sku && !commercialName && !projectName && !inspirationName) return null

  let p = null
  if (sku) p = await trx('products').where('sku', sku).first()
  if (!p && commercialName) p = await trx('products').where('commercial_name', commercialName).first()
  if (!p && projectName) p = await trx('products').where('project_name', projectName).first()
  if (!p && inspirationName) {
    p = await trx('products').where('inspiration_name', inspirationName).first()
  }

  const data = {
    sku: sku || null,
    project_name: projectName || inspirationName || commercialName || 'Sem nome',
    commercial_name: commercialName || '',
    inspiration_brand: inspirationBrand || '',
    inspiration_name: inspirationName || '',
    gender: normalizeGender(gender),
    active: true
  }

  if (p) {
    // Atualiza só campos que tem valor novo (não sobrescreve com vazio)
    const update = {}
    if (sku) update.sku = sku
    if (commercialName) update.commercial_name = commercialName
    if (projectName) update.project_name = projectName
    if (inspirationBrand) update.inspiration_brand = inspirationBrand
    if (inspirationName) update.inspiration_name = inspirationName
    if (gender) update.gender = normalizeGender(gender)
    if (Object.keys(update).length) await trx('products').where('id', p.id).update(update)
    return p
  }
  const [inserted] = await trx('products').insert(data).returning('id')
  const id = typeof inserted === 'object' ? inserted.id : inserted
  return { id, ...data }
}

// ──────────────────────────────────────────────────────────────────────────────
// SUPPLY LOOKUP por nome (case-insensitive), tipo opcional
// ──────────────────────────────────────────────────────────────────────────────
async function findSupplyByName (trx, name, opts = {}) {
  if (!name) return null
  let q = trx('supplies').whereRaw('LOWER(name) = ?', name.toLowerCase())
  if (opts.type) q = q.where('type', opts.type)
  if (opts.types) q = q.whereIn('type', opts.types)
  return q.orderBy('purchase_date', 'desc').first()
}

// ──────────────────────────────────────────────────────────────────────────────
// PROCESSADORES por aba
// ──────────────────────────────────────────────────────────────────────────────
const VALID_SUPPLIER_TYPES = ['Essence', 'Base', 'Chemical', 'Packaging', 'Bottle', 'Label', 'Multiple', 'Other']

async function processFornecedores (trx, rows, dryRun) {
  const errors = []
  let ok = 0
  for (const r of rows) {
    const nome = toString(getCol(r, 'Nome'))
    if (!nome) { errors.push({ row: r._row, msg: 'Nome obrigatório' }); continue }
    let tipo = toString(getCol(r, 'Tipo'))
    if (tipo && !VALID_SUPPLIER_TYPES.includes(tipo)) {
      errors.push({ row: r._row, msg: `Tipo "${tipo}" inválido (use: ${VALID_SUPPLIER_TYPES.join(', ')})` }); continue
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
      const [inserted] = await trx('suppliers').insert(data).returning('id')
      const id = typeof inserted === 'object' ? inserted.id : inserted
      supplierCache.set(nome.toLowerCase(), { id, name: nome })
    }
    ok++
  }
  return { ok, errors }
}

async function processDescricaoPerfumes (trx, rows, dryRun) {
  const errors = []
  let ok = 0
  for (const r of rows) {
    const projeto = toString(getCol(r, 'Perfume (Projeto)', 'Perfume', 'Projeto'))
    if (!projeto) { errors.push({ row: r._row, msg: 'Perfume (Projeto) obrigatório' }); continue }
    if (dryRun) { ok++; continue }

    const cod = toString(getCol(r, 'Cod'))
    const inspNome = toString(getCol(r, 'Inspiração (Referência)', 'Inspiração'))
    const comercial = toString(getCol(r, 'B1')) || ''
    const genero = normalizeGender(getCol(r, 'Gênero Olfativo', 'Genero Olfativo', 'Gênero'))
    const narrativa = toString(getCol(r, 'Narrativa (Versão 1)', 'Narrativa'))
    const pronuncia = toString(getCol(r, 'Pronuncia'))
    const personagens = toString(getCol(r, 'Personagens'))

    const notesParts = []
    if (pronuncia) notesParts.push(`Pronúncia: ${pronuncia}`)
    if (personagens) notesParts.push(`Personagens: ${personagens}`)
    const notes = notesParts.join(' · ')

    const data = {
      sku: cod || null,
      project_name: projeto,
      commercial_name: comercial,
      inspiration_name: inspNome,
      inspiration_brand: '',
      gender: genero,
      narrative: narrativa,
      notes,
      active: true
    }

    // Upsert por project_name OU sku
    let existing = null
    if (cod) existing = await trx('products').where('sku', cod).first()
    if (!existing) existing = await trx('products').where('project_name', projeto).first()

    if (existing) {
      await trx('products').where('id', existing.id).update(data)
    } else {
      await trx('products').insert(data)
    }
    ok++
  }
  return { ok, errors }
}

async function processInvestimento (trx, rows, dryRun) {
  return processGenericSupply(trx, rows, dryRun, {
    type: 'Packaging',
    nameCol: 'Nome Material',
    qtdCol: 'Unidades/Volumetria',
    valorCol: 'Valor',
    idealCol: 'Valor ideal para lucratividade',
    unitCol: 'Unidade Ou Volume',
    label: 'Investimento'
  })
}

async function processCadastroFrascos (trx, rows, dryRun) {
  return processGenericSupply(trx, rows, dryRun, {
    type: 'Bottle',
    nameCol: 'Nome do Material',
    qtdCol: 'Unidades',
    valorCol: 'Valor total',
    idealCol: 'Valor ideal para lucratividade',
    unitCol: 'Unidade ou Volume',
    descricaoDetalhadaCol: 'Descrição do Frasco detalhada',
    categoriaCol: 'Descrição',
    saldoCol: 'Disponiveis',
    receiptCol: 'Recebido pelo fornecedor?',
    label: 'Cadastro de Frascos'
  })
}

async function processGenericSupply (trx, rows, dryRun, opts) {
  const errors = []
  let ok = 0
  for (const r of rows) {
    const nome = toString(getCol(r, opts.nameCol))
    const fornecedorNome = toString(getCol(r, 'Fornecedor'))
    const qtd = toNumber(getCol(r, opts.qtdCol))
    const valor = toNumber(getCol(r, opts.valorCol))

    if (!nome) { errors.push({ row: r._row, msg: `${opts.nameCol} obrigatório` }); continue }
    if (!fornecedorNome) { errors.push({ row: r._row, msg: 'Fornecedor obrigatório' }); continue }
    if (qtd == null || qtd <= 0) { errors.push({ row: r._row, msg: `${opts.qtdCol} inválido` }); continue }
    if (valor == null || valor < 0) { errors.push({ row: r._row, msg: `${opts.valorCol} inválido` }); continue }

    if (dryRun) { ok++; continue }

    const supplier = await ensureSupplier(trx, fornecedorNome)
    const dataCompra = parseExcelDate(getCol(r, 'Data')) || new Date().toISOString().slice(0, 10)
    const saldo = toNumber(getCol(r, opts.saldoCol || 'Disponiveis'))
    const qtyAvailable = saldo != null ? saldo : qtd
    const unit = normalizeUnit(getCol(r, opts.unitCol))
    const descDetalhada = toString(getCol(r, opts.descricaoDetalhadaCol || 'Descrição detalhada'))
    const categoria = toString(getCol(r, opts.categoriaCol || 'Descrição'))
    const receipt = normalizeReceiptStatus(getCol(r, opts.receiptCol || 'Situação de Compra'))
    const ideal = toNumber(getCol(r, opts.idealCol))

    const data = {
      name: nome,
      type: opts.type,
      supplier_id: supplier.id,
      unit,
      quantity_purchased: qtd,
      total_amount_paid: valor,
      quantity_available: qtyAvailable,
      purchase_date: dataCompra,
      receipt_status: receipt,
      batch: '',
      bottle_type: categoria,
      notes: descDetalhada,
      is_open: qtyAvailable > 0,
      is_formula_ingredient: ['Essence', 'Base', 'Chemical'].includes(opts.type),
      ideal_unit_price: ideal
    }

    const existing = await trx('supplies')
      .whereRaw('LOWER(name) = ?', nome.toLowerCase())
      .where('supplier_id', supplier.id)
      .where('purchase_date', dataCompra)
      .first()

    if (existing) {
      await trx('supplies').where('id', existing.id).update(data)
    } else {
      await trx('supplies').insert(data)
    }
    ok++
  }
  return { ok, errors }
}

async function processComprasEssencias (trx, rows, dryRun) {
  const errors = []
  let ok = 0
  for (const r of rows) {
    const fornecedorNome = toString(getCol(r, 'Fornecedor'))
    const inspNome = toString(getCol(r, 'Inspiração'))
    const itemCod = toString(getCol(r, 'Item comprado'))
    const codForn = toString(getCol(r, 'Cód Fornecedor'))
    const valor = toNumber(getCol(r, 'Valor'))
    const volume = toNumber(getCol(r, 'Volume (ml)'))
    const utilizado = toNumber(getCol(r, 'Utilizado')) ?? 0

    if (!fornecedorNome) { errors.push({ row: r._row, msg: 'Fornecedor obrigatório' }); continue }
    if (!inspNome) { errors.push({ row: r._row, msg: 'Inspiração obrigatória' }); continue }
    if (valor == null || valor < 0) { errors.push({ row: r._row, msg: 'Valor inválido' }); continue }
    if (volume == null || volume <= 0) { errors.push({ row: r._row, msg: 'Volume (ml) inválido' }); continue }

    if (dryRun) { ok++; continue }

    const supplier = await ensureSupplier(trx, fornecedorNome)
    const marca = toString(getCol(r, 'Marca da Inspiração'))
    const sexo = getCol(r, 'Sexo')
    const dataCompra = parseExcelDate(getCol(r, 'Data')) || new Date().toISOString().slice(0, 10)

    // Cria/atualiza produto a partir da inspiração
    await ensureProduct(trx, {
      inspirationName: inspNome,
      inspirationBrand: marca,
      projectName: inspNome,
      gender: sexo
    })

    const nome = `Essência ${inspNome}`
    const qtyAvail = Math.max(0, volume - utilizado)
    const data = {
      name: nome,
      type: 'Essence',
      supplier_id: supplier.id,
      unit: 'ml',
      quantity_purchased: volume,
      total_amount_paid: valor,
      quantity_available: qtyAvail,
      purchase_date: dataCompra,
      receipt_status: normalizeReceiptStatus(getCol(r, 'Situação de Compra')),
      batch: codForn || itemCod || '',
      bottle_type: '',
      notes: itemCod ? `Item planilha: ${itemCod}` : '',
      is_open: qtyAvail > 0,
      is_formula_ingredient: true,
      ideal_unit_price: null
    }

    // Upsert: nome + supplier + data + batch
    const existing = await trx('supplies')
      .whereRaw('LOWER(name) = ?', nome.toLowerCase())
      .where('supplier_id', supplier.id)
      .where('purchase_date', dataCompra)
      .where('batch', data.batch)
      .first()

    if (existing) {
      await trx('supplies').where('id', existing.id).update(data)
    } else {
      await trx('supplies').insert(data)
    }
    ok++
  }
  return { ok, errors }
}

// ──────────────────────────────────────────────────────────────────────────────
// Fórmulas sem Base Pronta — aba híbrida
// Cada linha → 1 fórmula (upsert por nome) + 1 lote + N formula_items + 1 batch_essence
// ──────────────────────────────────────────────────────────────────────────────
async function processFormulasHibrida (trx, rows, dryRun) {
  const errors = []
  let ok = 0
  for (const r of rows) {
    const codigo = toString(getCol(r, 'Código da produção', 'Codigo da producao'))
    const dataFab = parseExcelDate(getCol(r, 'Data Fabricação', 'Data Fabricacao'))
    const nomeFormula = toString(getCol(r, 'Nome Utilizado')) || toString(getCol(r, 'Inspiração'))
    const inspNome = toString(getCol(r, 'Inspiração'))
    const totalMl = toNumber(getCol(r, 'Total Produzido (ml)'))
    const essenciaPct = toNumber(getCol(r, 'Essência (%)', 'Essencia (%)')) ?? 0

    if (!codigo) { errors.push({ row: r._row, msg: 'Código da produção obrigatório' }); continue }
    if (!dataFab) { errors.push({ row: r._row, msg: 'Data Fabricação inválida' }); continue }
    if (!nomeFormula) { errors.push({ row: r._row, msg: 'Nome Utilizado / Inspiração obrigatório' }); continue }
    if (totalMl == null || totalMl <= 0) { errors.push({ row: r._row, msg: 'Total Produzido (ml) inválido' }); continue }

    if (dryRun) { ok++; continue }

    // ─── 1. Produto (lookup pelo nome comercial / cod do perfume)
    const codPerfume = toString(getCol(r, 'Cód do Perfume'))
    const nomeComercial = toString(getCol(r, 'Nome Comercial'))
    const product = await ensureProduct(trx, {
      sku: codPerfume,
      commercialName: nomeComercial,
      projectName: nomeComercial || inspNome,
      inspirationName: inspNome,
      gender: getCol(r, 'Sexo')
    })

    // ─── 2. Fórmula (upsert por nome)
    const tipoPerfume = toString(getCol(r, 'Tipo de Perfume')) || 'EDP/Parfum'
    const obs = toString(getCol(r, 'obs'))
    const formulaData = {
      name: nomeFormula,
      product_id: product ? product.id : null,
      description: [tipoPerfume, obs].filter(Boolean).join(' — '),
      essence_percentage: essenciaPct,
      total_percentage: 100,
      active: true,
      validated: true
    }
    const existingFormula = await trx('formulas').where('name', nomeFormula).first()
    let formulaId
    if (existingFormula) {
      await trx('formulas').where('id', existingFormula.id).update(formulaData)
      formulaId = existingFormula.id
    } else {
      const [ins] = await trx('formulas').insert(formulaData).returning('id')
      formulaId = typeof ins === 'object' ? ins.id : ins
    }

    // ─── 3. formula_items (apaga + recria)
    await trx('formula_items').where('formula_id', formulaId).del()
    const itemSpecs = [
      { pct: toNumber(getCol(r, 'Alcool (%)')),       supplyName: toString(getCol(r, 'Álcool utilizado', 'Alcool utilizado')), label: 'álcool' },
      { pct: toNumber(getCol(r, 'Água Desmineralizada (%)', 'Agua Desmineralizada (%)')), supplyName: '',                       label: 'água' },
      { pct: toNumber(getCol(r, 'Propilenoglicol (%)')), supplyName: toString(getCol(r, '(Di)Propilenoglicol Utilizado')),     label: 'propileno' },
      { pct: toNumber(getCol(r, 'Fixador (%)')),        supplyName: toString(getCol(r, 'Qual Fixador usou')),                  label: 'fixador' }
    ]
    let orderIndex = 0
    for (const spec of itemSpecs) {
      if (!spec.pct || spec.pct <= 0) continue
      if (!spec.supplyName) continue
      const supply = await findSupplyByName(trx, spec.supplyName, { types: ['Chemical', 'Base', 'Essence', 'Packaging'] })
      if (!supply) {
        errors.push({ row: r._row, msg: `Supply "${spec.supplyName}" (${spec.label}) não encontrado — ingrediente não vinculado` })
        continue
      }
      await trx('formula_items').insert({
        formula_id: formulaId,
        supply_id: supply.id,
        percentage: spec.pct,
        order_index: orderIndex++,
        notes: ''
      })
    }

    // ─── 4. Lote (batches) — upsert por código
    const sobra = toNumber(getCol(r, 'Sobra'))
    const remaining = sobra != null ? Math.min(sobra, totalMl) : totalMl
    const statusRaw = toString(getCol(r, 'Status'))
    let batchStatus = 'Pronto para envase'
    if (/maceracao|maceração/i.test(statusRaw)) batchStatus = 'Em maceração'
    else if (/finaliz/i.test(statusRaw)) batchStatus = 'Finalizado'

    const custoEss = toNumber(getCol(r, 'Custo Essencia Utilizada')) ?? 0
    const custoAl = toNumber(getCol(r, 'Custo Alcool')) ?? 0
    const custoProp = toNumber(getCol(r, 'Custo Propileno')) ?? 0
    const custoFix = toNumber(getCol(r, 'Custo Fixador')) ?? 0
    const custoAg = toNumber(getCol(r, 'Custo Água', 'Custo Agua')) ?? 0
    const totalCost = custoEss + custoAl + custoProp + custoFix + custoAg
    const costPerMlPlanilha = toNumber(getCol(r, 'Custo por ML'))
    const costPerMl = costPerMlPlanilha != null ? costPerMlPlanilha : (totalMl > 0 ? totalCost / totalMl : 0)

    const ordemProd = toString(getCol(r, 'Ordem de Produção'))
    const notesParts = []
    if (ordemProd) notesParts.push(`Ordem: ${ordemProd}`)
    if (obs) notesParts.push(obs)

    const batchData = {
      batch_code: codigo,
      formula_id: formulaId,
      product_id: product ? product.id : null,
      production_date: dataFab,
      quantity_ml: totalMl,
      remaining_ml: remaining,
      status: batchStatus,
      maceration_start: null,
      maceration_end: null,
      notes: notesParts.join(' — '),
      active: true,
      reduced_lot_number: 1,
      total_cost: totalCost,
      cost_per_ml: costPerMl
    }
    const existingBatch = await trx('batches').where('batch_code', codigo).first()
    let batchId
    if (existingBatch) {
      await trx('batches').where('id', existingBatch.id).update(batchData)
      batchId = existingBatch.id
    } else {
      const [ins] = await trx('batches').insert(batchData).returning('id')
      batchId = typeof ins === 'object' ? ins.id : ins
    }

    // ─── 5. batch_essences (apaga + recria)
    const essenciaMl = toNumber(getCol(r, 'Essência Usada (2º)', 'Essencia Usada (2º)', 'Essencia Usada'))
    if (essenciaMl != null && essenciaMl > 0) {
      const fornEss = toString(getCol(r, 'Fornecedor'))
      const supplierEss = fornEss ? await ensureSupplier(trx, fornEss) : null
      // Acha essência pelo nome "Essência {inspNome}" do mesmo fornecedor (mais recente)
      let essSupply = null
      if (supplierEss) {
        essSupply = await trx('supplies')
          .whereRaw('LOWER(name) = ?', `essência ${inspNome}`.toLowerCase())
          .where('supplier_id', supplierEss.id)
          .where('type', 'Essence')
          .orderBy('purchase_date', 'desc')
          .first()
      }
      if (!essSupply) {
        // Fallback: qualquer essência com esse nome
        essSupply = await findSupplyByName(trx, `Essência ${inspNome}`, { type: 'Essence' })
      }

      await trx('batch_essences').where('batch_id', batchId).del()
      if (essSupply) {
        await trx('batch_essences').insert({
          batch_id: batchId,
          supply_id: essSupply.id,
          quantity: essenciaMl,
          unit: 'ml'
        })
      } else {
        errors.push({ row: r._row, msg: `Essência "${inspNome}" não encontrada — lote criado sem rastreabilidade da essência` })
      }
    }

    ok++
  }
  return { ok, errors }
}

// ──────────────────────────────────────────────────────────────────────────────
// Produção Frascos → bottlings + (se vendido) customers + orders + order_items
// ──────────────────────────────────────────────────────────────────────────────
async function processProducaoFrascos (trx, rows, dryRun) {
  const errors = []
  let ok = 0
  for (const r of rows) {
    const codigo = toString(getCol(r, 'Cód Frasco'))
    const dataEnv = parseExcelDate(getCol(r, 'Data do Envase'))
    const volumeMl = toNumber(getCol(r, 'Volume'))
    const qtdProd = toNumber(getCol(r, 'Qtd Produzida')) ?? 1

    if (!codigo) { errors.push({ row: r._row, msg: 'Cód Frasco obrigatório' }); continue }
    if (!dataEnv) { errors.push({ row: r._row, msg: 'Data do Envase inválida' }); continue }
    if (volumeMl == null || volumeMl <= 0) { errors.push({ row: r._row, msg: 'Volume inválido' }); continue }

    if (dryRun) { ok++; continue }

    // Produto: tenta por Cód Perfume, depois Nome Comercial, depois Perfume
    const codPerf = toString(getCol(r, 'Cód Perfume'))
    const nomeCom = toString(getCol(r, 'Nome Comercial'))
    const perfume = toString(getCol(r, 'Perfume'))
    const refOlf = toString(getCol(r, 'Ref. Olfativa'))
    const product = await ensureProduct(trx, {
      sku: codPerf,
      commercialName: nomeCom,
      projectName: perfume || nomeCom || refOlf,
      inspirationName: refOlf
    })

    // Lote (lookup)
    const loteCod = toString(getCol(r, 'Lote'))
    let batchId = null
    if (loteCod) {
      const b = await trx('batches').where('batch_code', loteCod).first()
      if (b) batchId = b.id
    }

    // Frasco (supply Bottle por nome)
    const frascoNome = toString(getCol(r, 'Frasco'))
    let bottleSupplyId = null
    if (frascoNome) {
      const fs = await findSupplyByName(trx, frascoNome, { type: 'Bottle' })
      if (fs) bottleSupplyId = fs.id
    }

    const statusRaw = toString(getCol(r, 'Status'))
    const isSold = /vend/i.test(statusRaw)
    const isBrinde = /brinde/i.test(statusRaw)
    const isTester = /tester/i.test(statusRaw)
    const qtdAvail = isSold || isTester ? 0 : qtdProd

    const productName = nomeCom || perfume || refOlf || 'Sem nome'
    const envaseData = {
      bottling_code: codigo,
      bottling_date: dataEnv,
      product_name: productName,
      product_ref: codPerf || '',
      volume_ml: volumeMl,
      quantity: qtdProd,
      quantity_available: qtdAvail,
      type: isBrinde ? 'brinde' : 'normal',
      bottle_supply_id: bottleSupplyId,
      label_supply_id: null,
      notes: '',
      active: true,
      liquid_cost: 0,
      bottle_cost: 0,
      label_cost: 0,
      total_cost: 0,
      unit_cost: toNumber(getCol(r, 'Custo Perfume')) ?? 0
    }

    const existing = await trx('bottlings').where('bottling_code', codigo).first()
    let bottlingId
    if (existing) {
      await trx('bottlings').where('id', existing.id).update(envaseData)
      bottlingId = existing.id
    } else {
      const [ins] = await trx('bottlings').insert(envaseData).returning('id')
      bottlingId = typeof ins === 'object' ? ins.id : ins
    }

    // Liga ao lote
    if (batchId) {
      const link = await trx('bottling_batches').where('bottling_id', bottlingId).where('batch_id', batchId).first()
      if (!link) {
        await trx('bottling_batches').insert({
          bottling_id: bottlingId,
          batch_id: batchId,
          ml_used: volumeMl * qtdProd,
          proportional_cost: 0
        })
      }
    }

    // Cria pedido se foi vendido
    if (isSold) {
      const comprador = toString(getCol(r, 'Comprador')) || 'Importado da planilha'
      const valor = toNumber(getCol(r, 'Valor Vendido')) ?? 0

      let customer = await trx('customers').whereRaw('LOWER(name) = ?', comprador.toLowerCase()).first()
      if (!customer) {
        const [ins] = await trx('customers').insert({ name: comprador, phone: '' }).returning('id')
        const id = typeof ins === 'object' ? ins.id : ins
        customer = { id }
      }

      const orderExisting = await trx('orders as o')
        .join('order_items as oi', 'oi.order_id', 'o.id')
        .where('oi.bottling_id', bottlingId)
        .where('o.customer_id', customer.id)
        .select('o.id')
        .first()

      if (!orderExisting) {
        const [ordIns] = await trx('orders').insert({
          customer_id: customer.id,
          channel: 'Outro',
          status: 'Delivered',
          discount: 0,
          shipping: 0,
          notes: 'Importado da planilha',
          from_catalog: false
        }).returning('id')
        const orderId = typeof ordIns === 'object' ? ordIns.id : ordIns

        await trx('order_items').insert({
          order_id: orderId,
          product_name: productName,
          product_ref: codPerf || '',
          quantity: qtdProd,
          unit_price: qtdProd > 0 ? valor / qtdProd : 0,
          bottling_id: bottlingId
        })
      }
    }

    ok++
  }
  return { ok, errors }
}

// ──────────────────────────────────────────────────────────────────────────────
// PARSE WORKBOOK
// ──────────────────────────────────────────────────────────────────────────────
function parseWorkbook (buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false })
  const out = {}
  for (const sheetName of Object.keys(TEMPLATE)) {
    const ws = wb.Sheets[sheetName]
    out[sheetName] = ws ? sheetToRows(ws).rows : []
  }
  return out
}

// ──────────────────────────────────────────────────────────────────────────────
// PROCESS ALL — orquestrador (ordem das dependências)
// ──────────────────────────────────────────────────────────────────────────────
async function processAll (parsed, dryRun) {
  supplierCache.clear()
  const result = {}
  await db.transaction(async (trx) => {
    result['Fornecedores']            = await processFornecedores(trx, parsed.Fornecedores || [], dryRun)
    result['Descrição Perfumes']      = await processDescricaoPerfumes(trx, parsed['Descrição Perfumes'] || [], dryRun)
    result['Investimento']            = await processInvestimento(trx, parsed.Investimento || [], dryRun)
    result['Cadastro de Frascos']     = await processCadastroFrascos(trx, parsed['Cadastro de Frascos'] || [], dryRun)
    result['Compras de Essencias']    = await processComprasEssencias(trx, parsed['Compras de Essencias'] || [], dryRun)
    result['Fórmulas sem Base Pronta'] = await processFormulasHibrida(trx, parsed['Fórmulas sem Base Pronta'] || [], dryRun)
    result['Produção Frascos']        = await processProducaoFrascos(trx, parsed['Produção Frascos'] || [], dryRun)

    if (dryRun) throw new Error('__DRY_RUN_ROLLBACK__')
  }).catch(err => {
    if (err.message !== '__DRY_RUN_ROLLBACK__') throw err
  })
  return result
}

// ──────────────────────────────────────────────────────────────────────────────
// CONTROLLER ENDPOINTS
// ──────────────────────────────────────────────────────────────────────────────
async function generateTemplate (req, res) {
  try {
    const wb = xlsx.utils.book_new()
    for (const [sheetName, def] of Object.entries(TEMPLATE)) {
      const rows = [def.headers, ...def.example]
      const ws = xlsx.utils.aoa_to_sheet(rows)
      ws['!cols'] = def.headers.map(() => ({ wch: 24 }))
      xlsx.utils.book_append_sheet(wb, ws, sheetName)
    }
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template_importacao_perfumaria.xlsx"'
    })
    res.send(buf)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function preview (req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo .xlsx não enviado' })
    const parsed = parseWorkbook(req.file.buffer)
    const result = await processAll(parsed, true)
    res.json({ dryRun: true, result })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

async function commit (req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arquivo .xlsx não enviado' })
    const parsed = parseWorkbook(req.file.buffer)
    const validation = await processAll(parsed, true)
    const totalErrors = Object.values(validation).reduce((s, v) => s + v.errors.filter(e => /obrigatóri|inválid/i.test(e.msg)).length, 0)
    if (totalErrors > 0) {
      return res.status(400).json({ error: 'Validação falhou. Corrija a planilha antes de confirmar.', result: validation })
    }
    const result = await processAll(parsed, false)
    res.json({ dryRun: false, result })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

module.exports = { generateTemplate, preview, commit }
