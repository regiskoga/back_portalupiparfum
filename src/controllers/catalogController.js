const { db } = require('../models/db')
const { buildAvailability, opcoesPorVolume, validarCarrinho } = require('../services/catalogAvailability')

async function list(req, res) {
  try {
    const { marca, genero, busca, page = 1, limit = 24 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const today = new Date().toISOString().slice(0, 10)

    let query = db('products as p')
      .where('p.active', true)
      .whereNotNull('p.catalog_status')
      .select(
        'p.id',
        'p.project_name',
        'p.commercial_name',
        'p.inspiration_brand',
        'p.inspiration_name',
        'p.gender',
        'p.catalog_status',
        'p.narrative',
        'p.top_notes',
        'p.heart_notes',
        'p.base_notes',
        'p.bottle_photo_url',
        'p.original_photo_url',
        'p.main_accords',
        'p.perfumer',
        'p.launch_year',
        'p.day_night_profile'
      )
      .orderBy('p.project_name', 'asc')

    if (marca)  query = query.where('p.inspiration_brand', 'ilike', `%${marca}%`)
    if (genero) query = query.where('p.gender', genero)
    if (busca) {
      query = query.where(function () {
        this.where('p.project_name',      'ilike', `%${busca}%`)
          .orWhere('p.inspiration_name',  'ilike', `%${busca}%`)
          .orWhere('p.inspiration_brand', 'ilike', `%${busca}%`)
          .orWhere('p.commercial_name',   'ilike', `%${busca}%`)
      })
    }

    // `clearSelect()` NÃO limpa o ORDER BY: sem `clearOrder()` a contagem vira
    // `select count(p.id) ... order by p.project_name`, que o Postgres recusa com
    // 42803 ("must appear in the GROUP BY clause"). Isso derrubava o catálogo
    // público inteiro com 500, em qualquer cenário, com ou sem produto publicado.
    const [{ count }] = await query.clone().clearSelect().clearOrder().count('p.id as count')
    const produtos = await query.limit(parseInt(limit)).offset(offset)

    if (produtos.length === 0) {
      return res.json({ data: [], total: 0, page: parseInt(page), limit: parseInt(limit) })
    }

    const ids = produtos.map(p => p.id)

    // Preços vigentes (sem custo — só volume + preço + nome da embalagem)
    const prices = await db('price_lists as pl')
      .leftJoin('packaging_types as pt', 'pt.id', 'pl.packaging_type_id')
      .whereIn('pl.product_id', ids)
      .where('pl.price', '>', 0)
      .where('pl.valid_from', '<=', today)
      .where(function () {
        this.whereNull('pl.valid_to').orWhere('pl.valid_to', '>=', today)
      })
      .select('pl.product_id', db.raw('CAST(pl.volume_ml AS float) as volume_ml'), 'pl.price', 'pt.name as packaging_name')
      .orderBy('pl.volume_ml', 'asc')

    const priceMap = {}
    prices.forEach(r => {
      if (!priceMap[r.product_id]) priceMap[r.product_id] = []
      priceMap[r.product_id].push({
        volume_ml:      r.volume_ml,
        price:          parseFloat(r.price),
        packaging_name: r.packaging_name || `${r.volume_ml}ml`
      })
    })

    // Disponibilidade por projeto x laboratório (ver services/catalogAvailability).
    // A query anterior ia por bottling_batches -> batches -> formulas.product_id e
    // divergia do resto do sistema em dois sentidos: deixava de fora todo envase
    // sem vínculo de lote, e contava envase type='brinde' como vendável.
    const disponibilidade = await buildAvailability(ids)

    const data = produtos.map(p => ({
      id:               p.id,
      project_name:     p.project_name,
      commercial_name:  p.commercial_name || p.project_name,
      inspiration_brand: p.inspiration_brand,
      inspiration_name:  p.inspiration_name,
      gender:           p.gender,
      catalog_status:   p.catalog_status,
      narrative:        p.narrative,
      top_notes:        p.top_notes,
      heart_notes:      p.heart_notes,
      base_notes:       p.base_notes,
      bottle_photo_url:   p.bottle_photo_url,
      original_photo_url: p.original_photo_url,
      main_accords:     p.main_accords,
      perfumer:         p.perfumer,
      launch_year:      p.launch_year,
      day_night_profile: p.day_night_profile,
      prices:           priceMap[p.id] || [],
      // `disponivel` continua sendo o booleano "dá para comprar agora" que a
      // página /catalogo.html já lê (cat-prices / selo de indisponível).
      disponivel:       temSaldoAgora(disponibilidade[p.id]),
      disponibilidade:  montaDisponibilidade(disponibilidade[p.id], priceMap[p.id]),
    }))

    res.json({ data, total: parseInt(count), page: parseInt(page), limit: parseInt(limit) })
  } catch (error) {
    console.error('[catalog] list error:', error)
    res.status(500).json({ error: 'Erro ao carregar catálogo' })
  }
}

// Lista de marcas únicas para o filtro
async function brands(req, res) {
  try {
    const rows = await db('products')
      .where('active', true)
      .whereNotNull('catalog_status')
      .whereNotNull('inspiration_brand')
      .where('inspiration_brand', '!=', '')
      .distinct('inspiration_brand')
      .orderBy('inspiration_brand', 'asc')
      .select('inspiration_brand')

    res.json(rows.map(r => r.inspiration_brand))
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar marcas' })
  }
}

// Cria pedido a partir do catálogo público (sem JWT)
async function createOrder(req, res) {
  try {
    const { customer, items } = req.body

    if (!customer?.name?.trim() || !customer?.phone?.trim()) {
      return res.status(422).json({ error: 'Nome e telefone do cliente são obrigatórios' })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ error: 'Selecione ao menos um perfume' })
    }

    const phone = customer.phone.replace(/\D/g, '')

    // Buscar ou criar cliente pelo telefone (normalizado)
    let existingCustomer = await db('customers')
      .whereRaw("regexp_replace(phone, '[^0-9]', '', 'g') = ?", [phone])
      .first()

    if (!existingCustomer) {
      ;[existingCustomer] = await db('customers')
        .insert({
          name:  customer.name.trim(),
          phone: customer.phone.trim(),
        })
        .returning('*')
    }

    // Validar produtos — só aceita IDs existentes e com catalog_status
    const productIds = [...new Set(items.map(i => parseInt(i.product_id)).filter(Boolean))]
    const products = await db('products')
      .whereIn('id', productIds)
      .where('active', true)
      .whereNotNull('catalog_status')
      .select('id', 'project_name', 'sku')

    if (products.length === 0) {
      return res.status(422).json({ error: 'Nenhum produto válido encontrado' })
    }

    const productMap = Object.fromEntries(products.map(p => [p.id, p]))

    // Criar pedido em transação
    const result = await db.transaction(async trx => {
      const [order] = await trx('orders')
        .insert({
          customer_id:  existingCustomer.id,
          code:         `ORD-${Date.now()}`,
          status:       'Pending',
          // Veio da vitrine, não do WhatsApp. Estava fixo em 'WhatsApp', o que
          // fazia o relatório por canal creditar ao WhatsApp toda venda do site.
          // 'Site' já é valor aceito pelo CHECK `orders_channel_check`.
          channel:      'Site',
          from_catalog: true,
          discount:     0,
          shipping:     0,
          notes:        'Pedido recebido via catálogo público',
        })
        .returning('*')

      const orderItems = products.map(p => ({
        order_id:     order.id,
        product_id:   p.id,
        product_name: p.project_name,
        product_ref:  p.sku || '',
        volume_ml:    null,
        quantity:     1,
        unit_price:   0,
        item_discount: 0,
      }))

      await trx('order_items').insert(orderItems)

      return { order_id: order.id, order_code: order.code, customer_id: existingCustomer.id }
    })

    res.status(201).json(result)
  } catch (error) {
    console.error('[catalog] createOrder error:', error)
    res.status(500).json({ error: 'Erro ao registrar pedido' })
  }
}

// ─── HELPERS DE DISPONIBILIDADE ───────────────────────────────────────────────
function temSaldoAgora (disp) {
  if (!disp) return false
  return disp.liquido_ml > 0 || disp.prontos.length > 0
}

function montaDisponibilidade (disp, precos) {
  if (!disp) return null
  const volumes = (precos || []).map(pr => pr.volume_ml)
  return {
    laboratorio_id: disp.laboratorio_id,
    // Orçamento COMPARTILHADO entre os volumes — quem monta carrinho debita daqui
    // a cada item, senão vende duas vezes o mesmo líquido.
    liquido_ml:     disp.liquido_ml,
    prontos:        disp.prontos,
    opcoes:         opcoesPorVolume(disp, volumes),
    sob_encomenda:  disp.sob_encomenda,
    envases_sem_laboratorio: disp.envases_sem_laboratorio,
    unidades_de_outros_labs: disp.unidades_de_outros_labs,
  }
}

// ─── SINCRONIZAÇÃO COM A LOJA (WooCommerce) ───────────────────────────────────
// A loja LÊ daqui e escreve `stock_quantity` nas variações. Protegido por
// segredo compartilhado (middleware syncSecret) — é chamada servidor-a-servidor
// do PHP da loja, nunca do navegador do comprador.

const TETO_SYNC = 2000   // guarda de sanidade; o catálogo real tem ~516 projetos

/**
 * GET /api/public/catalog/stock
 *
 * ATENÇÃO — CONTRATO DE SEGURANÇA: AUSÊNCIA NÃO SIGNIFICA "ESGOTADO".
 * Projeto inativo ou fora do catálogo simplesmente NÃO aparece em `itens`.
 * Quem consome DEVE agir só sobre os SKUs presentes e ignorar o resto. Tratar
 * "sumiu da lista" como "zera o estoque" faz um soluço de rede zerar a loja
 * inteira. Por isso vão juntos `completo`, `total_publicaveis` e
 * `total_emitidos`: se `completo` for false, NÃO sincronize nesta rodada.
 */
async function stock (req, res) {
  try {
    const hoje = new Date().toISOString().slice(0, 10)

    const publicaveis = await db('products')
      .where('active', true)
      .whereNotNull('catalog_status')
      .whereNotNull('sku')
      .where('sku', '!=', '')
      .select('id', 'sku', 'project_name', 'catalog_status')
      .orderBy('sku', 'asc')
      .limit(TETO_SYNC + 1)

    const estourou = publicaveis.length > TETO_SYNC
    const linhas = estourou ? publicaveis.slice(0, TETO_SYNC) : publicaveis

    // `products.sku` NÃO tem índice único (migration 20260513_004 só indexa) e
    // a base tem variante fora do padrão. Se dois projetos dividem o mesmo SKU,
    // a loja gravaria o estoque de um na ficha do outro — então SKU ambíguo é
    // RECUSADO aqui, não adivinhado, e sai na lista para alguém arrumar.
    const porSku = {}
    for (const r of linhas) {
      const k = String(r.sku).trim()
      porSku[k] = porSku[k] || []
      porSku[k].push(r)
    }
    const ambiguos = Object.keys(porSku).filter(k => porSku[k].length > 1)
    const unicos = Object.keys(porSku)
      .filter(k => porSku[k].length === 1)
      .map(k => porSku[k][0])

    const disp = await buildAvailability(unicos.map(r => r.id))

    // Volumes publicáveis = os da tabela de preços vigente do projeto.
    const precos = unicos.length
      ? await db('price_lists')
        .whereIn('product_id', unicos.map(r => r.id))
        .where('price', '>', 0)
        .where('valid_from', '<=', hoje)
        .where(function () { this.whereNull('valid_to').orWhere('valid_to', '>=', hoje) })
        .select('product_id', db.raw('CAST(volume_ml AS float) as volume_ml'))
      : []

    const volumesDe = {}
    for (const p of precos) {
      volumesDe[p.product_id] = volumesDe[p.product_id] || []
      if (!volumesDe[p.product_id].includes(p.volume_ml)) volumesDe[p.product_id].push(p.volume_ml)
    }

    const itens = unicos.map(r => {
      const d = disp[r.id] || null
      return {
        sku:            String(r.sku).trim(),
        product_id:     r.id,
        projeto:        r.project_name,
        catalog_status: r.catalog_status,
        laboratorio_id: d ? d.laboratorio_id : null,
        liquido_ml:     d ? d.liquido_ml : 0,
        volumes:        d ? opcoesPorVolume(d, volumesDe[r.id] || []) : [],
        sob_encomenda:  d ? d.sob_encomenda : null,
        envases_sem_laboratorio: d ? d.envases_sem_laboratorio : 0,
        unidades_de_outros_labs: d ? d.unidades_de_outros_labs : 0,
      }
    })

    res.json({
      gerado_em:         new Date().toISOString(),
      completo:          !estourou,
      total_publicaveis: linhas.length,
      total_emitidos:    itens.length,
      skus_ambiguos:     ambiguos,
      aviso: 'Aja somente sobre os SKUs presentes em itens. Ausencia NAO significa esgotado.',
      itens,
    })
  } catch (error) {
    console.error('[catalog] stock error:', error)
    res.status(500).json({ error: 'Erro ao montar o estoque para sincronizacao' })
  }
}

/**
 * POST /api/public/catalog/validate-cart
 * Body: { itens: [{ sku, volume_ml, quantidade }] }
 *
 * O `stock_quantity` por variação não representa o orçamento COMPARTILHADO de
 * ml — com 60ml o 15ml mostra 4 e o 30ml mostra 2, mas 4+2 pede 150ml. Este
 * endpoint é o que o carrinho da loja chama para fechar essa brecha.
 */
async function validateCart (req, res) {
  try {
    const itens = Array.isArray(req.body && req.body.itens) ? req.body.itens : []
    if (!itens.length) return res.status(422).json({ error: 'Carrinho vazio' })

    const skus = [...new Set(itens.map(i => String(i.sku || '').trim()).filter(Boolean))]
    if (!skus.length) return res.status(422).json({ error: 'Nenhum SKU informado' })

    const produtos = await db('products')
      .whereIn('sku', skus)
      .where('active', true)
      .whereNotNull('catalog_status')
      .select('id', 'sku', 'project_name')

    const porSku = {}
    for (const p of produtos) {
      const k = String(p.sku).trim()
      porSku[k] = porSku[k] || []
      porSku[k].push(p)
    }

    const disp = await buildAvailability(produtos.map(p => p.id))
    const problemas = []

    for (const sku of skus) {
      const achados = porSku[sku] || []
      if (achados.length === 0) {
        problemas.push({ sku, motivo: 'sku_desconhecido' })
        continue
      }
      if (achados.length > 1) {
        // Mesmo caso do /stock: não adivinhar de qual projeto é o estoque.
        problemas.push({ sku, motivo: 'sku_ambiguo', projetos: achados.length })
        continue
      }
      const p = achados[0]
      const doSku = itens.filter(i => String(i.sku || '').trim() === sku)
      const r = validarCarrinho(disp[p.id], doSku)
      if (!r.ok) {
        problemas.push({
          sku,
          projeto:             p.project_name,
          motivo:              'orcamento_ml',
          ml_necessario:       r.ml_necessario,
          ml_disponivel:       r.ml_disponivel,
          falta_ml:            r.falta_ml,
          prontos_usados:      r.prontos_usados,
          cobre_por_encomenda: r.cobre_por_encomenda,
          previsao:            r.previsao,
        })
      }
    }

    res.json({ ok: problemas.length === 0, problemas })
  } catch (error) {
    console.error('[catalog] validateCart error:', error)
    res.status(500).json({ error: 'Erro ao validar o carrinho' })
  }
}

module.exports = { list, brands, createOrder, stock, validateCart }
