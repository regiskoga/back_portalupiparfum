const { db } = require('../models/db')
const { buildAvailability, opcoesPorVolume, validarCarrinho } = require('../services/catalogAvailability')
const { precosDoBanco } = require('../services/precosSite')

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

    // Preco do SITE por tamanho de frasco (parametro `precos_site`). Nao e o
    // `price_lists`, que e do sistema e serve a tela de Vendas — as duas
    // tabelas divergem ~20% por decisao do dono. Volume sem preco legivel sai
    // sem `preco`, e quem consome nao mexe no preco daquela variacao.
    const precoDoVolume = await precosDoBanco()

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
        volumes: d
          ? opcoesPorVolume(d, volumesDe[r.id] || []).map(v => (
            precoDoVolume[v.volume_ml] !== undefined
              ? { ...v, preco: precoDoVolume[v.volume_ml] }
              : v
          ))
          : [],
        sob_encomenda:  d ? d.sob_encomenda : null,
        envases_sem_laboratorio: d ? d.envases_sem_laboratorio : 0,
        unidades_de_outros_labs: d ? d.unidades_de_outros_labs : 0,
        // Quanto do saldo ja tem dono (pedido em aberto sem envase vinculado).
        // Vai no payload para a reserva ser auditavel no relatorio da loja: sem
        // isso, pedido antigo parado em `Confirmed` esconde estoque e ninguem
        // descobre por que o numero caiu.
        ml_comprometido: d ? d.ml_comprometido : 0,
        // O bruto acima inclui a parte absorvida por frasco pronto; este e o que
        // saiu do bolo de ml. Com frasco na prateleira os dois divergem.
        ml_descontado_do_liquido: d ? d.ml_descontado_do_liquido : 0,
        itens_comprometidos_sem_volume: d ? d.itens_comprometidos_sem_volume : 0,
      }
    })

    res.json({
      gerado_em:         new Date().toISOString(),
      completo:          !estourou,
      total_publicaveis: linhas.length,
      total_emitidos:    itens.length,
      skus_ambiguos:     ambiguos,
      // Quais tamanhos tem preco configurado. Vai no payload para a loja poder
      // dizer na tela o que ficara sem alteracao, em vez de o dono descobrir
      // pelo preco que nao mudou.
      precos_por_volume: precoDoVolume,
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

// ─── PEDIDO PAGO NA LOJA → PEDIDO CONFIRMADO AQUI ────────────────────────────
//
// A outra metade do laço. O `/stock` empurra disponibilidade para a loja; este
// endpoint recebe de volta a venda que aconteceu lá. Sem ele, o estoque que a
// loja publica nunca é baixado e a sincronização automática viraria oversell.
//
// Chamado pelo PHP da loja QUANDO O PAGAMENTO É CONFIRMADO (InfinitePay), não
// quando o carrinho é fechado. Pela regra do Rafael, pedido pago entra como
// `Confirmed`. Protegido pelo mesmo `x-sync-secret`.
//
// NÃO RECUSA POR FALTA DE ESTOQUE, de propósito: o dinheiro já entrou. Se o
// saldo não cobre, o pedido é registrado de todo jeito e a sobra sai em
// `aviso_estoque` + nas notas — é o "pagar e aguardar a maceração". Recusar
// aqui perderia a venda E o registro, com o cliente já cobrado.

// Chave de lock para a idempotência (ver abaixo). Número arbitrário e fixo,
// só precisa não colidir com o do gerador de SKU (528431).
const LOCK_PEDIDO_LOJA = 528432

// A tela de Vendas monta o campo de pagamento como um <select> de lista FIXA
// (`PAYMENT_METHODS` em vendas.js). Gravar aqui um valor fora dela — p.ex.
// "InfinitePay" — deixaria o select sem opção marcada, e o próximo salvamento
// na tela regravaria em silêncio a 1ª opção ("Pix"). Então o que vai para a
// coluna é sempre um valor que a tela conhece, e o texto cru do gateway fica
// nas notas, onde não corrompe nada.
function metodoDePagamento (cru) {
  const t = String(cru || '').toLowerCase()
  if (t.includes('pix')) return 'Pix'
  if (t.includes('debit') || t.includes('débito')) return 'Cartão de Débito'
  if (t.includes('credit') || t.includes('crédito') || t.includes('card')) return 'Cartão de Crédito'
  if (t.includes('transfer')) return 'Transferência'
  if (t.includes('dinheiro') || t.includes('cash')) return 'Dinheiro'
  return 'Outro'
}

function soDigitos (v) { return String(v || '').replace(/\D/g, '') }

/**
 * POST /api/public/catalog/store-order
 *
 * Body:
 * {
 *   "loja_order_id": 1234,              // obrigatório — é a chave da idempotência
 *   "pago_em":       "2026-11-02",      // opcional
 *   "pagamento":     "pix",             // opcional, texto cru do gateway
 *   "total_pago":    350.00,            // opcional
 *   "frete":         25.00,
 *   "desconto":      0,
 *   "cliente": { "nome", "telefone", "email", "cpf", "cep", "rua", "numero",
 *                "complemento", "bairro", "cidade", "estado" },
 *   "itens": [ { "sku", "volume_ml", "quantidade", "preco_unitario" } ],
 *   "observacoes": "..."
 * }
 */
async function storeOrder (req, res) {
  try {
    const b = req.body || {}
    const lojaId = String(b.loja_order_id || '').trim()
    if (!lojaId) return res.status(422).json({ error: 'loja_order_id e obrigatorio' })

    const cliente = b.cliente || {}
    const nome = String(cliente.nome || '').trim()
    const telefone = String(cliente.telefone || '').trim()
    if (!nome) return res.status(422).json({ error: 'cliente.nome e obrigatorio' })

    const itensBody = Array.isArray(b.itens) ? b.itens : []
    if (!itensBody.length) return res.status(422).json({ error: 'itens vazio' })

    const code = `WOO-${lojaId}`

    // Resolve os SKUs ANTES da transação. SKU desconhecido ou ambíguo é
    // RECUSADO, não adivinhado — mesmo contrato do /stock: `products.sku` não
    // tem índice único, e gravar o item no projeto errado criaria um pedido
    // para o perfume errado, com o cliente já cobrado. Recusar devolve 409 e a
    // loja repete depois; é recuperável, pedido errado não é.
    const skus = [...new Set(itensBody.map(i => String(i.sku || '').trim()).filter(Boolean))]
    if (!skus.length) return res.status(422).json({ error: 'nenhum item com sku' })

    const produtos = await db('products')
      .whereIn('sku', skus)
      .select('id', 'sku', 'project_name', 'active', 'catalog_status')

    const porSku = {}
    for (const p of produtos) {
      const k = String(p.sku).trim()
      ;(porSku[k] = porSku[k] || []).push(p)
    }

    const desconhecidos = skus.filter(s => !porSku[s])
    const ambiguos = skus.filter(s => porSku[s] && porSku[s].length > 1)
    if (desconhecidos.length || ambiguos.length) {
      return res.status(409).json({
        error: 'Nao foi possivel identificar os produtos do pedido',
        skus_desconhecidos: desconhecidos,
        skus_ambiguos: ambiguos,
      })
    }

    // Projeto inativo/fora do catálogo NÃO barra: a loja pode ter vendido antes
    // de a sincronização esconder a ficha. A venda existe e tem de ser
    // registrada; o desvio sai no aviso.
    const inativos = skus.filter(s => !porSku[s][0].active || !porSku[s][0].catalog_status)

    const resultado = await db.transaction(async trx => {
      // IDEMPOTÊNCIA. `orders.code` é `text` SEM índice único (migration
      // original: `table.text('code').defaultTo('')`), então não há como
      // delegar isso ao banco com ON CONFLICT. Dois webhooks simultâneos — e
      // gateway que repete é a regra, não a exceção — passariam os dois pelo
      // "já existe?" e criariam dois pedidos para a mesma venda.
      // O advisory lock fecha a janela: é por transação, serializa as chamadas
      // da MESMA venda e não encosta em venda diferente. Mesmo recurso que o
      // gerador de SKU usa (pg_advisory_xact_lock).
      await trx.raw('SELECT pg_advisory_xact_lock(?, hashtext(?))', [LOCK_PEDIDO_LOJA, code])

      const jaExiste = await trx('orders').where('code', code).first()
      if (jaExiste) {
        return { ja_existia: true, order_id: jaExiste.id, order_code: jaExiste.code, status: jaExiste.status }
      }

      // Cliente: casa pelo telefone normalizado, como o createOrder do catálogo.
      // Sem telefone não dá para casar — cria novo em vez de colar a venda num
      // homônimo qualquer.
      const fone = soDigitos(telefone)
      let registro = null
      if (fone) {
        registro = await trx('customers')
          .whereRaw("regexp_replace(phone, '[^0-9]', '', 'g') = ?", [fone])
          .first()
      }

      const endereco = {
        email:         String(cliente.email || '').trim() || null,
        tax_id:        String(cliente.cpf || '').trim() || null,
        zip_code:      String(cliente.cep || '').trim() || null,
        street:        String(cliente.rua || '').trim() || null,
        street_number: String(cliente.numero || '').trim() || null,
        complement:    String(cliente.complemento || '').trim() || null,
        neighborhood:  String(cliente.bairro || '').trim() || null,
        city:          String(cliente.cidade || '').trim() || null,
        state:         String(cliente.estado || '').trim() || null,
      }

      if (!registro) {
        ;[registro] = await trx('customers')
          .insert({ name: nome, phone: telefone || null, ...endereco })
          .returning('*')
      } else {
        // Cliente que já existe NÃO é sobrescrito: a loja manda o endereço de
        // UMA entrega, e o cadastro daqui pode ter dado melhor, corrigido à
        // mão. Só preenche campo que está vazio.
        const preencher = {}
        for (const [k, v] of Object.entries(endereco)) {
          if (v && !String(registro[k] || '').trim()) preencher[k] = v
        }
        if (Object.keys(preencher).length) {
          await trx('customers').where('id', registro.id).update(preencher)
        }
      }

      const cru = String(b.pagamento || '').trim()
      const notas = [
        `Pedido pago no site (loja #${lojaId}).`,
        cru ? `Forma de pagamento informada pela loja: ${cru}.` : null,
        inativos.length ? `ATENCAO: vendido com projeto fora do catalogo: ${inativos.join(', ')}.` : null,
        String(b.observacoes || '').trim() || null,
      ].filter(Boolean).join(' ')

      const [order] = await trx('orders')
        .insert({
          customer_id:  registro.id,
          code,
          // Pago = `Confirmed`, regra do cliente. Confirmar NÃO debita estoque
          // (quem debita é o vínculo de envase, na Fila de Produção) — é por
          // isso que `catalogAvailability` desconta o pendente dos pedidos em
          // aberto. As duas coisas são o mesmo laço.
          status:       'Confirmed',
          channel:      'Site',
          from_catalog: true,
          discount:     Math.max(0, parseFloat(b.desconto) || 0),
          shipping:     Math.max(0, parseFloat(b.frete) || 0),
          payment_method: metodoDePagamento(cru),
          amount_paid:  b.total_pago === undefined || b.total_pago === null
            ? null
            : Math.max(0, parseFloat(b.total_pago) || 0),
          payment_date: String(b.pago_em || '').slice(0, 10) || null,
          notes:        notas,
        })
        .returning('*')

      // PREÇO VEM DA REQUISIÇÃO, e isto é o certo: quem cobrou foi a loja, e o
      // valor cobrado é o que ela diz. Buscar em `price_lists` aqui faria o
      // pedido divergir da cobrança sempre que a tabela mudasse entre a venda e
      // o webhook, ou sempre que houver promoção no site. É seguro porque o
      // endpoint está atrás do segredo de sincronização, servidor-a-servidor.
      // Não "corrija" isto resolvendo o preço no servidor.
      const itens = itensBody
        .map(i => {
          const p = porSku[String(i.sku || '').trim()]
          if (!p) return null
          const qtd = parseFloat(i.quantidade) || 0
          if (qtd <= 0) return null
          return {
            order_id:      order.id,
            product_id:    p[0].id,
            product_name:  p[0].project_name,
            product_ref:   p[0].sku || '',
            volume_ml:     parseFloat(i.volume_ml) || 0,
            quantity:      qtd,
            unit_price:    Math.max(0, parseFloat(i.preco_unitario) || 0),
            item_discount: 0,
          }
        })
        .filter(Boolean)

      if (!itens.length) throw new Error('Nenhum item valido apos a validacao')
      await trx('order_items').insert(itens)

      return {
        ja_existia: false,
        order_id: order.id,
        order_code: order.code,
        status: order.status,
        customer_id: registro.id,
        itens: itens.length,
      }
    })

    // Checagem de cobertura DEPOIS de gravar, e só informativa. Roda fora da
    // transação para não alongar o lock, e o pedido já criado conta como
    // comprometido — então o número devolvido é o saldo que SOBROU.
    let avisoEstoque = null
    if (!resultado.ja_existia) {
      try {
        const ids = [...new Set(skus.map(s => porSku[s][0].id))]
        const disp = await buildAvailability(ids)
        const faltas = []
        for (const id of ids) {
          const d = disp[id]
          if (d && d.liquido_ml <= 0 && (!d.prontos || !d.prontos.length)) {
            faltas.push({
              sku: porSku[skus.find(s => porSku[s][0].id === id)][0].sku,
              previsao: d.sob_encomenda ? d.sob_encomenda.previsao : null,
            })
          }
        }
        if (faltas.length) avisoEstoque = { sem_saldo_livre: faltas }
      } catch (e) {
        // Falha aqui NÃO invalida o pedido: ele já está gravado e pago.
        console.error('[catalog] storeOrder aviso de estoque falhou:', e.message)
      }
    }

    res.status(resultado.ja_existia ? 200 : 201).json({
      ...resultado,
      projetos_fora_do_catalogo: inativos,
      aviso_estoque: avisoEstoque,
    })
  } catch (error) {
    console.error('[catalog] storeOrder error:', error)
    res.status(500).json({ error: 'Erro ao registrar o pedido da loja' })
  }
}

module.exports = { list, brands, createOrder, stock, validateCart, storeOrder }
