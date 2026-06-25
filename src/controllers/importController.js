const xlsx = require('xlsx')
const { db } = require('../models/db')

// ──────────────────────────────────────────────────────────────────────────────
// Definição das abas do template e suas colunas.
// O cabeçalho da planilha é o "header" — o backend usa esse texto como chave.
// ──────────────────────────────────────────────────────────────────────────────
// Prefixo usado em todas as linhas de exemplo — o parser ignora qualquer linha
// cuja primeira célula textual comece com este marcador.
const EXAMPLE_MARK = '[EXEMPLO]'

const TEMPLATE = {
  Fornecedores: {
    headers: ['nome', 'contato', 'cnpj', 'observacoes'],
    example: [
      [`${EXAMPLE_MARK} Fragella Essências`, '(11) 99999-9999', '12.345.678/0001-90', 'Fornecedor principal'],
      [`${EXAMPLE_MARK} Mercado Livre`, '', '', 'Utensílios e investimento']
    ]
  },
  Produtos: {
    headers: ['cod', 'nome_projeto', 'nome_comercial', 'inspiracao_marca', 'inspiracao_nome', 'genero', 'narrativa', 'observacoes'],
    example: [
      [`${EXAMPLE_MARK} 001`, 'Dragon Tea X', 'Wulong Cha X - Dragon Tea X', 'Nishane', 'Wulong Cha', 'Unissex', 'Notas cítricas com chá verde — fragrância luminosa e mística.', '']
    ]
  },
  Frascos: {
    headers: ['data_compra', 'nome', 'descricao', 'fornecedor', 'qtd_comprada', 'valor_total', 'tipo_frasco', 'saldo_disponivel', 'status_recebimento'],
    example: [
      [`${EXAMPLE_MARK} 2026-03-15`, 'Frasco Vidro 30ml', 'Frasco 30ml válvula spray', 'Fragella Essências', 30, 234.86, 'Frasco 30ml', 30, 'Recebido']
    ]
  },
  Essencias: {
    headers: ['data_compra', 'nome', 'fornecedor', 'marca_inspiracao', 'nome_inspiracao', 'genero', 'valor', 'volume_ml', 'codigo_fornecedor', 'saldo_disponivel'],
    example: [
      [`${EXAMPLE_MARK} 2026-03-15`, 'Essência Wulong Cha', 'Fragella Essências', 'Nishane', 'Wulong Cha', 'Unissex', 48.83, 60, '00001', 60]
    ]
  },
  Investimento: {
    headers: ['data_compra', 'nome', 'valor', 'fornecedor', 'qtd', 'observacoes'],
    example: [
      [`${EXAMPLE_MARK} 2026-03-15`, 'Copos Becker (5 unidades)', 32.98, 'Mercado Livre', 5, 'Utensílio de laboratório']
    ]
  },
  Formulas: {
    headers: ['nome', 'produto_nome_comercial', 'alcool_pct', 'essencia_pct', 'propileno_pct', 'fixador_pct', 'agua_pct', 'tipo_perfume', 'alcool_supply_nome', 'agua_supply_nome', 'propileno_supply_nome', 'fixador_supply_nome', 'observacoes'],
    example: [
      [`${EXAMPLE_MARK} Dragon Tea X`, 'Wulong Cha X - Dragon Tea X', 80, 16, 2, 2, 0, 'EDP/Parfum', 'Álcool 96°', 'Água Desmineralizada', 'Propilenoglicol', 'Fixador Premium', '']
    ]
  },
  Lotes: {
    headers: ['codigo', 'data_producao', 'formula_nome', 'ml_total', 'ml_disponivel', 'status', 'maceracao_inicio', 'maceracao_fim', 'essencia_nome', 'essencia_ml_usado', 'custo_total', 'observacoes'],
    example: [
      [`${EXAMPLE_MARK} LOTE-001`, '2026-03-20', 'Dragon Tea X', 187.5, 87.5, 'Pronto para envase', '2026-03-20', '2026-03-30', 'Essência Wulong Cha', 30, 150.00, '']
    ]
  },
  Envases: {
    headers: ['codigo', 'data_envase', 'lote_codigo', 'produto_nome', 'frasco_tipo', 'volume_ml', 'qtd_produzida', 'qtd_disponivel', 'status', 'comprador', 'valor_vendido'],
    example: [
      [`${EXAMPLE_MARK} ENV-001`, '2026-03-25', 'LOTE-001', 'Wulong Cha X - Dragon Tea X', 'Frasco 50ml', 50, 1, 1, 'Disponivel', '', 0]
    ]
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function parseExcelDate (v) {
  if (v == null || v === '') return null
  // Excel serial date (number) → Date
  if (typeof v === 'number') {
    const d = xlsx.SSF.parse_date_code(v)
    if (!d) return null
    const pad = n => String(n).padStart(2, '0')
    return `${d.y}-${pad(d.m)}-${pad(d.d)}`
  }
  // String — tenta vários formatos
  if (typeof v === 'string') {
    const s = v.trim()
    // já em YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    // dd/mm/yyyy ou dd-mm-yyyy
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
  if (s.startsWith('rec')) return 'Recebido'
  if (s.startsWith('pend')) return 'Pendente'
  if (s.startsWith('canc')) return 'Cancelado'
  return 'Recebido'
}

function sheetToRows (ws) {
  // Converte planilha para array de objetos baseado no header da linha 1.
  // Ignora linhas vazias e linhas-exemplo marcadas com EXAMPLE_MARK.
  const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false })
  if (raw.length < 2) return []
  const headers = raw[0].map(h => toString(h).toLowerCase())
  const dataRows = []
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i]
    const allEmpty = row.every(c => c == null || c === '')
    if (allEmpty) continue
    // Pula linha marcada como exemplo — usuário pode deixar lá sem importar.
    const firstStr = toString(row[0])
    if (firstStr.startsWith(EXAMPLE_MARK)) continue
    const obj = {}
    headers.forEach((h, j) => { obj[h] = row[j] })
    obj._row = i + 1 // 1-based, p/ relatório de erro
    dataRows.push(obj)
  }
  return dataRows
}

// ──────────────────────────────────────────────────────────────────────────────
// GENERATE TEMPLATE
// ──────────────────────────────────────────────────────────────────────────────
async function generateTemplate (req, res) {
  try {
    const wb = xlsx.utils.book_new()

    for (const [sheetName, def] of Object.entries(TEMPLATE)) {
      // Linha 1: cabeçalhos. Linhas 2+: exemplos marcados com [EXEMPLO].
      const rows = [def.headers, ...def.example]
      const ws = xlsx.utils.aoa_to_sheet(rows)
      // Largura mínima das colunas
      ws['!cols'] = def.headers.map(() => ({ wch: 22 }))
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

// ──────────────────────────────────────────────────────────────────────────────
// PARSE WORKBOOK do upload → estrutura intermediária
// ──────────────────────────────────────────────────────────────────────────────
function parseWorkbook (buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false })
  const out = {}
  for (const sheetName of Object.keys(TEMPLATE)) {
    const ws = wb.Sheets[sheetName]
    out[sheetName] = ws ? sheetToRows(ws) : []
  }
  return out
}

// ──────────────────────────────────────────────────────────────────────────────
// PROCESSADORES por entidade.
// Cada um devolve { ok: N, errors: [{ row, msg }] } e (em commit) executa upsert.
// ──────────────────────────────────────────────────────────────────────────────
async function processFornecedores (trx, rows, dryRun) {
  const errors = []
  let ok = 0
  for (const r of rows) {
    const nome = toString(r.nome)
    if (!nome) { errors.push({ row: r._row, msg: 'nome obrigatório' }); continue }
    if (dryRun) { ok++; continue }
    const existing = await trx('suppliers').where('name', nome).first()
    const data = {
      name: nome,
      contact: toString(r.contato) || null,
      tax_id: toString(r.cnpj) || null,
      notes: toString(r.observacoes) || null,
      active: true
    }
    if (existing) {
      await trx('suppliers').where('id', existing.id).update(data)
    } else {
      await trx('suppliers').insert(data)
    }
    ok++
  }
  return { ok, errors }
}

async function processProdutos (trx, rows, dryRun) {
  const errors = []
  let ok = 0
  for (const r of rows) {
    const projectName = toString(r.nome_projeto)
    const commercialName = toString(r.nome_comercial) || projectName
    if (!projectName) { errors.push({ row: r._row, msg: 'nome_projeto obrigatório' }); continue }
    if (dryRun) { ok++; continue }
    const sku = toString(r.cod) || null
    // Upsert por commercial_name (fallback project_name)
    const existing = await trx('products').where('commercial_name', commercialName).first()
    const data = {
      sku,
      project_name: projectName,
      commercial_name: commercialName,
      inspiration_brand: toString(r.inspiracao_marca) || null,
      inspiration_name: toString(r.inspiracao_nome) || null,
      gender: normalizeGender(r.genero),
      narrative: toString(r.narrativa) || null,
      notes: toString(r.observacoes) || null,
      active: true
    }
    if (existing) {
      await trx('products').where('id', existing.id).update(data)
    } else {
      await trx('products').insert(data)
    }
    ok++
  }
  return { ok, errors }
}

async function processSupply (trx, rows, dryRun, opts) {
  // opts: { type, unit, useSaldo, errorLabel }
  const errors = []
  let ok = 0
  for (const r of rows) {
    const nome = toString(r.nome)
    const fornecedor = toString(r.fornecedor)
    const qtd = toNumber(r.qtd_comprada) ?? toNumber(r.volume_ml) ?? toNumber(r.qtd)
    const valor = toNumber(r.valor_total) ?? toNumber(r.valor)
    if (!nome) { errors.push({ row: r._row, msg: 'nome obrigatório' }); continue }
    if (!fornecedor) { errors.push({ row: r._row, msg: 'fornecedor obrigatório' }); continue }
    if (qtd == null || qtd <= 0) { errors.push({ row: r._row, msg: 'quantidade inválida' }); continue }
    if (valor == null || valor < 0) { errors.push({ row: r._row, msg: 'valor inválido' }); continue }

    if (dryRun) {
      // Verifica se fornecedor existe (na pré-importação, conta também os a serem criados)
      const supplier = await trx('suppliers').where('name', fornecedor).first()
      if (!supplier) errors.push({ row: r._row, msg: `fornecedor "${fornecedor}" não encontrado (cadastre na aba Fornecedores)` })
      else ok++
      continue
    }

    const supplier = await trx('suppliers').where('name', fornecedor).first()
    if (!supplier) {
      errors.push({ row: r._row, msg: `fornecedor "${fornecedor}" não encontrado` })
      continue
    }

    const dataCompra = parseExcelDate(r.data_compra) || new Date().toISOString().slice(0, 10)
    const saldo = toNumber(r.saldo_disponivel)
    const quantityAvailable = saldo != null ? saldo : qtd

    // Chave natural de upsert: nome + supplier + purchase_date + batch
    const batchField = toString(r.codigo_fornecedor) || ''
    const existing = await trx('supplies')
      .where('name', nome)
      .where('supplier_id', supplier.id)
      .where('purchase_date', dataCompra)
      .where('batch', batchField)
      .first()

    const data = {
      name: nome,
      type: opts.type,
      supplier_id: supplier.id,
      unit: opts.unit,
      quantity_purchased: qtd,
      total_amount_paid: valor,
      quantity_available: quantityAvailable,
      purchase_date: dataCompra,
      receipt_status: normalizeReceiptStatus(r.status_recebimento || r.situacao),
      batch: batchField,
      bottle_type: toString(r.tipo_frasco) || '',
      notes: toString(r.observacoes) || '',
      is_open: quantityAvailable > 0,
      is_formula_ingredient: opts.type === 'Essence'
    }
    if (existing) {
      await trx('supplies').where('id', existing.id).update(data)
    } else {
      await trx('supplies').insert(data)
    }
    ok++
  }
  return { ok, errors }
}

async function processFormulas (trx, rows, dryRun) {
  const errors = []
  let ok = 0
  for (const r of rows) {
    const nome = toString(r.nome)
    if (!nome) { errors.push({ row: r._row, msg: 'nome obrigatório' }); continue }
    const essencePct = toNumber(r.essencia_pct)
    if (essencePct == null || essencePct < 0 || essencePct > 100) {
      errors.push({ row: r._row, msg: 'essencia_pct obrigatório (0-100)' }); continue
    }

    if (dryRun) { ok++; continue }

    const produtoNome = toString(r.produto_nome_comercial)
    let productId = null
    if (produtoNome) {
      const p = await trx('products').where('commercial_name', produtoNome).first()
      if (p) productId = p.id
    }

    const tipoPerfume = toString(r.tipo_perfume) || 'EDP/Parfum'
    const obs = toString(r.observacoes) || ''
    const description = [tipoPerfume, obs].filter(Boolean).join(' — ')

    const data = {
      name: nome,
      product_id: productId,
      description,
      essence_percentage: essencePct,
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
      const [inserted] = await trx('formulas').insert(data).returning('id')
      formulaId = typeof inserted === 'object' ? inserted.id : inserted
    }

    // ── formula_items: cria entradas pra cada ingrediente não-essência com pct > 0
    // Mapeia nome da coluna pct → coluna com nome do supply
    const itemSpecs = [
      { pct: toNumber(r.alcool_pct),    supplyName: toString(r.alcool_supply_nome),    label: 'álcool' },
      { pct: toNumber(r.agua_pct),      supplyName: toString(r.agua_supply_nome),      label: 'água' },
      { pct: toNumber(r.propileno_pct), supplyName: toString(r.propileno_supply_nome), label: 'propileno' },
      { pct: toNumber(r.fixador_pct),   supplyName: toString(r.fixador_supply_nome),   label: 'fixador' }
    ]

    // Limpa items existentes pra idempotência (overwrite)
    await trx('formula_items').where('formula_id', formulaId).del()

    let orderIndex = 0
    for (const spec of itemSpecs) {
      if (!spec.pct || spec.pct <= 0) continue
      if (!spec.supplyName) {
        // Sem supply informado: pula silenciosamente (fórmula é criada sem esse ingrediente vinculado)
        continue
      }
      // Procura supply pelo nome — mais recente primeiro
      const supply = await trx('supplies')
        .where('name', spec.supplyName)
        .whereIn('type', ['Chemical', 'Base'])
        .orderBy('purchase_date', 'desc')
        .first()
      if (!supply) {
        errors.push({ row: r._row, msg: `supply "${spec.supplyName}" (${spec.label}) não encontrado — ingrediente não vinculado` })
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
    ok++
  }
  return { ok, errors }
}

async function processLotes (trx, rows, dryRun) {
  const errors = []
  let ok = 0
  for (const r of rows) {
    const codigo = toString(r.codigo)
    if (!codigo) { errors.push({ row: r._row, msg: 'codigo obrigatório' }); continue }
    const dataProd = parseExcelDate(r.data_producao)
    if (!dataProd) { errors.push({ row: r._row, msg: 'data_producao inválida' }); continue }
    const mlTotal = toNumber(r.ml_total)
    if (mlTotal == null || mlTotal <= 0) { errors.push({ row: r._row, msg: 'ml_total inválido' }); continue }

    if (dryRun) { ok++; continue }

    const formulaNome = toString(r.formula_nome)
    const formula = formulaNome ? await trx('formulas').where('name', formulaNome).first() : null
    if (!formula) {
      errors.push({ row: r._row, msg: `formula "${formulaNome}" não encontrada` }); continue
    }

    const VALID_BATCH_STATUS = ['Em maceração', 'Pronto para envase', 'Finalizado']
    let status = toString(r.status) || 'Pronto para envase'
    if (!VALID_BATCH_STATUS.includes(status)) status = 'Pronto para envase'
    const remaining = Math.min(toNumber(r.ml_disponivel) ?? mlTotal, mlTotal)

    // ── Custo: prioriza custo_total informado; senão, calcula a partir da essência + itens da fórmula
    const custoInformado = toNumber(r.custo_total)
    const essenciaNome = toString(r.essencia_nome)
    const essenciaMl = toNumber(r.essencia_ml_usado) ?? (mlTotal * Number(formula.essence_percentage || 0) / 100)

    let essence = null
    if (essenciaNome) {
      essence = await trx('supplies as s')
        .where('s.name', essenciaNome).where('s.type', 'Essence')
        .orderBy('s.purchase_date', 'desc')
        .first()
    }

    let totalCost = 0
    if (custoInformado != null && custoInformado >= 0) {
      totalCost = custoInformado
    } else if (essence) {
      totalCost = Number(essence.unit_cost || 0) * essenciaMl
      // Soma o custo dos demais ingredientes da fórmula
      const items = await trx('formula_items as fi')
        .join('supplies as s', 's.id', 'fi.supply_id')
        .where('fi.formula_id', formula.id)
        .select('fi.percentage', 's.unit_cost')
      for (const it of items) {
        const itQty = mlTotal * Number(it.percentage || 0) / 100
        totalCost += Number(it.unit_cost || 0) * itQty
      }
    }
    const costPerMl = mlTotal > 0 ? totalCost / mlTotal : 0

    const data = {
      batch_code: codigo,
      formula_id: formula.id,
      product_id: formula.product_id,
      production_date: dataProd,
      quantity_ml: mlTotal,
      remaining_ml: remaining,
      status,
      maceration_start: parseExcelDate(r.maceracao_inicio),
      maceration_end: parseExcelDate(r.maceracao_fim),
      notes: toString(r.observacoes) || '',
      active: true,
      reduced_lot_number: 1,
      total_cost: totalCost,
      cost_per_ml: costPerMl
    }
    const existing = await trx('batches').where('batch_code', codigo).first()
    let batchId
    if (existing) {
      await trx('batches').where('id', existing.id).update(data)
      batchId = existing.id
    } else {
      const [inserted] = await trx('batches').insert(data).returning('id')
      batchId = typeof inserted === 'object' ? inserted.id : inserted
    }

    // ── batch_essences: registra essência consumida (apaga e recria pra idempotência)
    if (essence && essenciaMl > 0) {
      await trx('batch_essences').where('batch_id', batchId).del()
      await trx('batch_essences').insert({
        batch_id: batchId,
        supply_id: essence.id,
        quantity: essenciaMl,
        unit: 'ml'
      })
    } else if (essenciaNome) {
      // Avisa que a essência não foi encontrada, mas não trava a importação
      errors.push({ row: r._row, msg: `essência "${essenciaNome}" não encontrada — lote criado sem rastreabilidade da essência` })
    }

    ok++
  }
  return { ok, errors }
}

async function processEnvases (trx, rows, dryRun) {
  const errors = []
  let ok = 0
  for (const r of rows) {
    const codigo = toString(r.codigo)
    if (!codigo) { errors.push({ row: r._row, msg: 'codigo obrigatório' }); continue }
    const dataEnv = parseExcelDate(r.data_envase)
    if (!dataEnv) { errors.push({ row: r._row, msg: 'data_envase inválida' }); continue }
    const volumeMl = toNumber(r.volume_ml)
    if (volumeMl == null || volumeMl <= 0) { errors.push({ row: r._row, msg: 'volume_ml inválido' }); continue }
    const qtdProd = toNumber(r.qtd_produzida) ?? 1

    if (dryRun) { ok++; continue }

    const loteCod = toString(r.lote_codigo)
    let batchId = null
    if (loteCod) {
      const b = await trx('batches').where('batch_code', loteCod).first()
      if (b) batchId = b.id
    }

    const statusRaw = toString(r.status) || 'Disponivel'
    const isSold = /vend/i.test(statusRaw)
    const qtdAvail = toNumber(r.qtd_disponivel) ?? (isSold ? 0 : qtdProd)

    const envaseData = {
      bottling_code: codigo,
      bottling_date: dataEnv,
      product_name: toString(r.produto_nome) || 'Sem nome',
      product_ref: '',
      volume_ml: volumeMl,
      quantity: qtdProd,
      quantity_available: qtdAvail,
      type: 'normal',
      notes: '',
      active: true,
      liquid_cost: 0,
      bottle_cost: 0,
      label_cost: 0,
      total_cost: 0,
      unit_cost: 0
    }

    const existing = await trx('bottlings').where('bottling_code', codigo).first()
    let bottlingId
    if (existing) {
      await trx('bottlings').where('id', existing.id).update(envaseData)
      bottlingId = existing.id
    } else {
      const [inserted] = await trx('bottlings').insert(envaseData).returning('id')
      bottlingId = typeof inserted === 'object' ? inserted.id : inserted
    }

    // Liga ao lote (bottling_batches)
    if (batchId) {
      const existingLink = await trx('bottling_batches')
        .where('bottling_id', bottlingId).where('batch_id', batchId).first()
      if (!existingLink) {
        await trx('bottling_batches').insert({
          bottling_id: bottlingId,
          batch_id: batchId,
          ml_used: volumeMl * qtdProd,
          proportional_cost: 0
        })
      }
    }

    // Se vendido → cria pedido associado
    if (isSold) {
      const comprador = toString(r.comprador) || 'Importado da planilha'
      const valor = toNumber(r.valor_vendido) ?? 0

      // Cliente: upsert por nome
      let customer = await trx('customers').where('name', comprador).first()
      if (!customer) {
        const [inserted] = await trx('customers').insert({
          name: comprador,
          phone: ''
        }).returning('id')
        const newId = typeof inserted === 'object' ? inserted.id : inserted
        customer = { id: newId }
      }

      // Pedido — chave natural composta (cliente + bottling) para idempotência
      const orderExisting = await trx('orders as o')
        .join('order_items as oi', 'oi.order_id', 'o.id')
        .where('oi.bottling_id', bottlingId)
        .where('o.customer_id', customer.id)
        .select('o.id')
        .first()

      if (!orderExisting) {
        const [orderInserted] = await trx('orders').insert({
          customer_id: customer.id,
          channel: 'Outro',
          status: 'Delivered',
          discount: 0,
          shipping: 0,
          notes: 'Importado da planilha',
          from_catalog: false
        }).returning('id')
        const orderId = typeof orderInserted === 'object' ? orderInserted.id : orderInserted

        await trx('order_items').insert({
          order_id: orderId,
          product_name: envaseData.product_name,
          product_ref: '',
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
// PROCESS ALL (orquestrador)
// ──────────────────────────────────────────────────────────────────────────────
async function processAll (parsed, dryRun) {
  const result = {}
  await db.transaction(async (trx) => {
    result.Fornecedores = await processFornecedores(trx, parsed.Fornecedores, dryRun)
    result.Produtos     = await processProdutos(trx, parsed.Produtos, dryRun)
    result.Frascos      = await processSupply(trx, parsed.Frascos, dryRun, { type: 'Bottle', unit: 'unidade' })
    result.Essencias    = await processSupply(trx, parsed.Essencias, dryRun, { type: 'Essence', unit: 'ml' })
    result.Investimento = await processSupply(trx, parsed.Investimento, dryRun, { type: 'Packaging', unit: 'unidade' })
    result.Formulas     = await processFormulas(trx, parsed.Formulas, dryRun)
    result.Lotes        = await processLotes(trx, parsed.Lotes, dryRun)
    result.Envases      = await processEnvases(trx, parsed.Envases, dryRun)

    if (dryRun) {
      // Em dry-run, força rollback para não persistir nada
      throw new Error('__DRY_RUN_ROLLBACK__')
    }
  }).catch(err => {
    if (err.message !== '__DRY_RUN_ROLLBACK__') throw err
  })
  return result
}

// ──────────────────────────────────────────────────────────────────────────────
// PREVIEW (dry-run) e COMMIT
// ──────────────────────────────────────────────────────────────────────────────
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

    // Primeiro roda dry-run pra validar; se tiver erros, aborta sem persistir
    const validation = await processAll(parsed, true)
    const totalErrors = Object.values(validation).reduce((s, v) => s + v.errors.length, 0)
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
