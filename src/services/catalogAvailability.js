/**
 * Disponibilidade do catálogo público — por projeto, por laboratório.
 *
 * Regras ditadas pelo cliente (áudios de 31/10/2026, fechadas em 02/11/2026):
 *
 * 1. O saldo vendável de um projeto é o LÍQUIDO em lote (`batches.remaining_ml`),
 *    somado — mas NÃO dá para somar lotes de laboratórios diferentes, porque o
 *    produto muda de um lab para outro. Soma por (projeto, laboratório) e publica
 *    o MAIOR desses saldos. Conforme ele vende, quando o lab que estava na frente
 *    cai abaixo de outro, o publicado passa a ser o do outro. É esperado.
 * 2. FRASCO JÁ PRONTO conta como disponível — e TAMBÉM respeita a regra do
 *    laboratório. Como frasco e líquido estão em unidades diferentes, a disputa
 *    entre labs é feita em ml-equivalente: soma(volume_ml x qtd) + líquido.
 * 3. Só lote 'Pronto para envase' conta como disponível AGORA. 'Em maceração'
 *    vira a opção "pagar e aguardar", com data real em vez dos 20 dias chapados.
 *    'Finalizado' é automático quando o ml zera, então não tem saldo.
 * 4. O que já tem dono não é disponível. Confirmar pedido NÃO debita estoque
 *    aqui (quem debita é o vínculo de envase), então o saldo publicado desconta
 *    o pendente dos pedidos em aberto — ver `comprometidoPorProjeto` abaixo.
 *    Sem isso, com a loja gravando estoque sozinha, o oversell é garantido.
 *
 * ATENÇÃO: laboratório é DERIVADO, não armazenado. É o fornecedor da 1ª essência
 * do lote (mesma definição de `batchesController`, que usa isso no `batch_code`).
 * "1ª" = menor `batch_essences.id` — a ordem precisa ser determinística, senão o
 * lab de um lote com várias essências muda entre execuções e a vitrine fica
 * piscando entre laboratórios sem ninguém ter escrito nada.
 *
 * ATENÇÃO: lote sem essência vinculada não tem laboratório derivável. Até
 * 09/11/2026 ele ficava de FORA da conta, e o preço disso foi medido em produção:
 * 76.686 ml — 68% de TODO o líquido do sistema — invisíveis em 437 lotes, com 396
 * projetos publicados que não anunciavam nada. Desde 10/11/2026 esse líquido vai
 * para o balde `SEM_LAB` e disputa a eleição normalmente.
 *
 * POR QUE ISSO NÃO QUEBRA A REGRA 1: o `SEM_LAB` é UM balde só, então não soma
 * laboratórios diferentes num mesmo saldo — ele apenas admite que não se sabe qual
 * é. Empate entre ele e um lab conhecido vai para o conhecido. Quanto do saldo
 * publicado está nessa situação volta em `ml_sem_laboratorio`, e nesse caso
 * `laboratorio_id` vem `null`.
 *
 * POR QUE NÃO FOI RECONSTRUÍDO O VÍNCULO em vez de mudar o código: medido em
 * 09/11/2026, `batch_essences.quantity` é NOT NULL com CHECK > 0 e
 * `formulas.essence_percentage` está preenchido em 1 projeto de 547 — não existe
 * fonte para a quantidade. E das 135 linhas de `batch_essences` em produção, 134
 * têm `quantity_available = quantity_purchased - consumido`, isto é, vincular
 * essência DESCONTA saldo. Um backfill inventaria 437 quantidades numa tabela de
 * estoque. Decisão do cliente em 10/11/2026: publicar com lab desconhecido vale
 * mais do que esconder o líquido.
 *
 * Frasco SEM vínculo de lote continua de FORA: ali não se sabe nem de que líquido
 * saiu, então é dívida de RASTREABILIDADE, não de laboratório (os ~1.552
 * importados por planilha, à espera de vínculo manual). Os totais excluídos voltam
 * no retorno para o tamanho do problema ficar visível:
 *   - `envases_sem_laboratorio`  = frasco sem vínculo de lote (o mutirão);
 *   - `unidades_de_outros_labs`  = frasco de um lab que perdeu a disputa.
 * O segundo é consequência normal da regra, o primeiro é dívida a quitar.
 */

const { db } = require('../models/db')

const STATUS_PRONTO    = 'Pronto para envase'
const STATUS_MACERACAO = 'Em maceração'

// Sentinela do balde "laboratório desconhecido". É string de propósito: não pode
// colidir com nenhum `supplies.supplier_id`, que é inteiro.
const SEM_LAB = 'sem-lab'

const num = v => parseFloat(v) || 0

// `maceration_end` é coluna `date`, mas o pg devolve um Date do JS: serializado
// no JSON vira "2026-11-20T03:00:00.000Z", que em outro fuso horário o navegador
// lê como 19/11. Como isso é uma PROMESSA DE PRAZO para quem está pagando, vai
// como YYYY-MM-DD e não como instante.
function soData (v) {
  if (!v) return null
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  return String(v).slice(0, 10)
}

/** Laboratório de cada lote: fornecedor da 1ª essência (menor batch_essences.id). */
async function labPorLote (batchIds) {
  if (!batchIds.length) return {}
  const linhas = await db('batch_essences as be')
    .join('supplies as s', 's.id', 'be.supply_id')
    .whereIn('be.batch_id', batchIds)
    .orderBy('be.id', 'asc')
    .select('be.batch_id', 's.supplier_id')

  const mapa = {}
  for (const l of linhas) {
    if (mapa[l.batch_id] === undefined) mapa[l.batch_id] = l.supplier_id
  }
  return mapa
}

// ─── ML COMPROMETIDO POR PEDIDO EM ABERTO ────────────────────────────────────
//
// POR QUE ISSO EXISTE: confirmar pedido NÃO debita estoque neste sistema. Quem
// debita é `linkBottling` (o gesto na tela Fila de Produção). Então um pedido
// pago do site entra como `Confirmed` e o `batches.remaining_ml` não se move —
// a vitrine continuaria anunciando líquido JÁ VENDIDO até alguém envasar. Com
// a loja gravando estoque automaticamente, isso é oversell garantido, não
// eventual. A disponibilidade publicada tem de descontar o que já tem dono.
//
// Qual parcela conta: `quantity - Σ(order_item_bottlings.quantity)` — a mesma
// conta do `pending_quantity` da Fila de Produção. O que já está VINCULADO não
// entra: aquele envase já saiu de `bottlings.quantity_available`, e descontar
// de novo tiraria o estoque duas vezes.
//
// Quais status contam (ABERTOS): o pedido tem dono e ainda não foi atendido.
//   - `Pending` fica FORA: é carrinho/orçamento não pago (pela regra do Rafael,
//     pedido pago entra como `Confirmed`). Card não pago e esquecido esconderia
//     estoque para sempre.
//   - `Shipped`/`Delivered`/`Finalizado` ficam FORA: se saiu sem vínculo, é
//     lacuna histórica de dado — reservar isso eternamente apagaria estoque real.
//   - `Cancelled`/`Lost`/`Abandoned` ficam FORA: não têm dono.
// Não é o `SOLD_STATUSES` dos relatórios: aquele inclui `Delivered`, que aqui
// não pode entrar.
const STATUS_ABERTOS = ['Confirmed', 'In Production', 'Ready']

/**
 * @returns {Promise<Object>} product_id -> { porVolume: {v: qtd}, ml: number, semVolume: number }
 */
async function comprometidoPorProjeto (ids) {
  if (!ids.length) return {}

  const itens = await db('order_items as oi')
    .join('orders as o', 'o.id', 'oi.order_id')
    .whereIn('oi.product_id', ids)
    .whereIn('o.status', STATUS_ABERTOS)
    .select(
      'oi.id',
      'oi.product_id',
      db.raw('CAST(oi.volume_ml AS float) as volume_ml'),
      db.raw('CAST(oi.quantity AS float) as quantity')
    )

  const vinculos = itens.length
    ? await db('order_item_bottlings')
      .whereIn('order_item_id', itens.map(i => i.id))
      .groupBy('order_item_id')
      .select('order_item_id')
      .sum('quantity as linked_quantity')
    : []

  const vinculadoDe = {}
  for (const v of vinculos) vinculadoDe[v.order_item_id] = parseInt(v.linked_quantity) || 0

  const mapa = {}
  for (const it of itens) {
    const m = (mapa[it.product_id] = mapa[it.product_id] || { porVolume: {}, ml: 0, semVolume: 0 })
    const pendente = Math.max(0, num(it.quantity) - (vinculadoDe[it.id] || 0))
    if (pendente <= 0) continue

    const v = num(it.volume_ml)
    // Item sem volume é o fluxo "leve" do drawer de Clientes e o do catálogo
    // antigo (`volume_ml: null`). Não dá para orçar em ml, então não desconta —
    // mas vai contado no retorno, senão some uma reserva real sem rastro.
    if (v <= 0) { m.semVolume += pendente; continue }

    m.porVolume[v] = (m.porVolume[v] || 0) + pendente
    m.ml += pendente * v
  }
  return mapa
}

function vazio () {
  return {
    laboratorio_id: null,
    liquido_ml: 0,
    prontos: [],
    sob_encomenda: null,
    envases_sem_laboratorio: 0,
    unidades_de_outros_labs: 0,
    ml_sem_laboratorio: 0,
    ml_comprometido: 0,
    ml_descontado_do_liquido: 0,
    itens_comprometidos_sem_volume: 0,
  }
}

/**
 * @param {number[]} productIds
 * @returns {Promise<Object>} mapa product_id -> disponibilidade
 */
async function buildAvailability (productIds) {
  const ids = [...new Set((productIds || []).map(n => parseInt(n)).filter(Boolean))]
  if (!ids.length) return {}

  // Lotes com saldo (pronto + maceração), direto por batches.product_id. Não
  // passar por formulas: o projeto pode ter mais de uma fórmula, e o hop
  // `formulas.where({ product_id }).first()` escolhe uma em silêncio.
  const lotes = await db('batches')
    .whereIn('product_id', ids)
    .whereIn('status', [STATUS_PRONTO, STATUS_MACERACAO])
    .where('remaining_ml', '>', 0)
    .select('id', 'product_id', 'remaining_ml', 'status', 'maceration_end')

  const labLote = await labPorLote(lotes.map(l => l.id))

  // Frascos prontos: junção canônica bottlings.product_ref = products.sku.
  // type='normal' exclui brinde, que não pode ser vendido pela vitrine.
  const frascos = await db('products as p')
    .join('bottlings as b', 'b.product_ref', 'p.sku')
    .whereIn('p.id', ids)
    .where('b.type', 'normal')
    .where('b.active', true)
    .where('b.quantity_available', '>', 0)
    .select(
      'p.id as product_id',
      'b.id as bottling_id',
      db.raw('CAST(b.volume_ml AS float) as volume_ml'),
      'b.quantity_available'
    )

  // Laboratório do frasco: via o lote de onde ele saiu (1º vínculo, por bb.id).
  const vinculos = frascos.length
    ? await db('bottling_batches')
      .whereIn('bottling_id', frascos.map(f => f.bottling_id))
      .orderBy('id', 'asc')
      .select('bottling_id', 'batch_id')
    : []

  const lotePorFrasco = {}
  for (const v of vinculos) {
    if (lotePorFrasco[v.bottling_id] === undefined) lotePorFrasco[v.bottling_id] = v.batch_id
  }

  // O lote de origem do frasco pode não estar na lista de cima (já zerado ou
  // finalizado), então o lab desses é resolvido à parte.
  const lotesDeFrascos = [...new Set(Object.values(lotePorFrasco))]
  const labExtra = await labPorLote(lotesDeFrascos.filter(id => labLote[id] === undefined))
  const labDe = { ...labLote, ...labExtra }

  // Baldes por (projeto, laboratório)
  const porProjeto = {}
  const garante = pid => {
    porProjeto[pid] = porProjeto[pid] || { labs: {}, maceracao: {}, semLab: 0 }
    return porProjeto[pid]
  }
  const bucket = (pid, lab) => {
    const p = garante(pid)
    const k = String(lab)
    p.labs[k] = p.labs[k] || { lab, liquido_ml: 0, prontos: {} }
    return p.labs[k]
  }

  for (const l of lotes) {
    // Lote sem `batch_essences` não tem laboratório derivável. Até 09/11/2026 ele
    // era DESCARTADO aqui, e isso escondia 76.686 ml — 68% de todo o líquido do
    // sistema — em 437 lotes, dos quais 396 projetos não publicavam nada. Agora
    // vai para um balde próprio e disputa a eleição como qualquer lab.
    //
    // POR QUE NÃO VIOLA A REGRA 1: o `SEM_LAB` continua sendo UM balde só, então
    // não mistura laboratórios diferentes num mesmo saldo — ele admite que não
    // sabemos qual é. Reconstruir o vínculo não era alternativa: `batch_essences`
    // exige `quantity > 0` e `formulas.essence_percentage` está preenchido em 1
    // projeto de 547, então um backfill inventaria 437 quantidades numa tabela que
    // desconta estoque. Decisão do cliente em 10/11/2026: publicar vale mais.
    const lab = labDe[l.id] === undefined ? SEM_LAB : labDe[l.id]
    if (l.status === STATUS_PRONTO) {
      bucket(l.product_id, lab).liquido_ml += num(l.remaining_ml)
    } else {
      const m = garante(l.product_id).maceracao
      const k = String(lab)
      m[k] = m[k] || { lab, ml: 0, previsao: null }
      m[k].ml += num(l.remaining_ml)
      // Data = o 1º lote daquele lab a ficar pronto: é quando o líquido COMEÇA a
      // existir, não quando todo o volume fica disponível. Simplificação assumida.
      if (l.maceration_end && (!m[k].previsao || l.maceration_end < m[k].previsao)) {
        m[k].previsao = l.maceration_end
      }
    }
  }

  for (const f of frascos) {
    const loteId = lotePorFrasco[f.bottling_id]
    // DUAS causas diferentes, que antes caíam no mesmo balde de excluídos:
    //   - frasco SEM vínculo de lote: não se sabe de que líquido saiu. Fica FORA,
    //     como antes — é o mutirão dos ~1.552 importados por planilha, e é dívida
    //     de RASTREABILIDADE, não só de laboratório.
    //   - frasco cujo lote existe mas o lote não tem essência: é exatamente o caso
    //     dos lotes acima, só falta o lab. Entra no balde `SEM_LAB`.
    if (loteId === undefined) {
      garante(f.product_id).semLab += parseInt(f.quantity_available) || 0
      continue
    }
    const lab = labDe[loteId] === undefined ? SEM_LAB : labDe[loteId]
    const b = bucket(f.product_id, lab)
    const v = num(f.volume_ml)
    b.prontos[v] = (b.prontos[v] || 0) + (parseInt(f.quantity_available) || 0)
  }

  const comprometido = await comprometidoPorProjeto(ids)

  // Elege o laboratório vencedor por ml-equivalente
  const saida = {}
  for (const pid of ids) {
    const d = porProjeto[pid]
    const comp = comprometido[pid] || { porVolume: {}, ml: 0, semVolume: 0 }
    if (!d) { saida[pid] = { ...vazio(), ml_comprometido: comp.ml, itens_comprometidos_sem_volume: comp.semVolume }; continue }

    // Elege pelo ml-equivalente BRUTO, sem olhar a reserva. Tentei descontar a
    // reserva aqui para o desempate e não serve para nada: `comp.ml` é a mesma
    // constante para todos os labs do loop, então subtrair não muda o argmax
    // (argmax(x−c) = argmax(x)). Seria código que parece fazer algo e não faz.
    //
    // CONSEQUÊNCIA ASSUMIDA: a reserva é debitada do vencedor DEPOIS de eleito
    // (logo abaixo). Então projeto cujo lab da frente está todo vendido publica
    // ZERO, mesmo que um lab perdedor tenha líquido livre. Subestima, nunca
    // vende o que não tem. Dividir a reserva entre labs exigiria saber de qual
    // lab cada pedido será atendido, e isso não está registrado em lugar nenhum
    // — o laboratório é derivado do lote, e o pedido ainda não tem lote.
    let vencedor = null
    let melhor = -1
    for (const k of Object.keys(d.labs)) {
      const b = d.labs[k]
      const equivalente = b.liquido_ml +
        Object.entries(b.prontos).reduce((a, [v, q]) => a + num(v) * q, 0)
      // Empate vai para o laboratório CONHECIDO: na dúvida, publica o que é
      // rastreável. Sem este desempate o vencedor de um empate sairia pela ordem
      // de inserção dos baldes, que depende da ordem dos lotes na query — e um
      // balde `SEM_LAB` empatado poderia tirar da vitrine frasco de lab real.
      const ganha = equivalente > melhor ||
        (equivalente === melhor && vencedor && vencedor.lab === SEM_LAB && b.lab !== SEM_LAB)
      if (ganha) { melhor = equivalente; vencedor = b }
    }

    // Debita a reserva do vencedor: frasco pronto do mesmo volume primeiro, o
    // resto do bolo de ml. Mesma ordem de alocação do `validarCarrinho`, que é
    // também a ordem real de atendimento — o envase já existe e não gasta
    // líquido. Trabalha em cópia: `d.labs` não é mutado.
    let descontadoDoLiquido = 0
    if (vencedor) {
      const prontos = { ...vencedor.prontos }
      let faltaMl = 0
      for (const [v, qtd] of Object.entries(comp.porVolume)) {
        const doEstoque = Math.min(qtd, prontos[v] || 0)
        prontos[v] = (prontos[v] || 0) - doEstoque
        faltaMl += (qtd - doEstoque) * num(v)
      }
      // O que REALMENTE saiu do bolo de ml. Difere de `comp.ml` sempre que um
      // frasco pronto absorveu parte da reserva: ali "reservado 60ml" convive
      // com o líquido intacto, e relatar só o bruto faz parecer que o líquido
      // caiu quando não caiu.
      descontadoDoLiquido = Math.min(faltaMl, vencedor.liquido_ml)
      vencedor = {
        lab: vencedor.lab,
        liquido_ml: Math.max(0, vencedor.liquido_ml - faltaMl),
        prontos: Object.fromEntries(Object.entries(prontos).filter(([, q]) => q > 0)),
      }
    }

    // Frasco de lab perdedor existe na prateleira e não vai à vitrine. Isso é a
    // regra funcionando, não defeito — mas sem contar, o número de "estoque que
    // o site não mostra" fica só com os sem-lab e engana para menos.
    let perdedores = 0
    for (const k of Object.keys(d.labs)) {
      const b = d.labs[k]
      if (vencedor && b.lab === vencedor.lab) continue
      perdedores += Object.values(b.prontos).reduce((a, q) => a + q, 0)
    }

    // Maceração é tier PRÓPRIO e não se prende ao lab vencedor do tier imediato:
    // lote em maceração de outro lab vira um frasco futuro inteiro, de um lab só,
    // e não mistura nada. Prender ao vencedor tiraria da vitrine uma opção de
    // "pagar e aguardar" que existe de verdade.
    let encomenda = null
    for (const k of Object.keys(d.maceracao)) {
      const m = d.maceracao[k]
      if (!encomenda || m.ml > encomenda.ml) encomenda = m
    }

    saida[pid] = {
      // `null` aqui significa "não há vencedor" OU "o vencedor é o balde sem
      // laboratório". Quem precisa distinguir olha `ml_sem_laboratorio`.
      laboratorio_id: vencedor && vencedor.lab !== SEM_LAB ? vencedor.lab : null,
      liquido_ml:     vencedor ? vencedor.liquido_ml : 0,
      prontos: vencedor
        ? Object.entries(vencedor.prontos)
          .map(([v, q]) => ({ volume_ml: num(v), quantidade: q }))
          .sort((a, b) => a.volume_ml - b.volume_ml)
        : [],
      sob_encomenda: encomenda
        ? { laboratorio_id: encomenda.lab, ml: encomenda.ml, previsao: soData(encomenda.previsao) }
        : null,
      envases_sem_laboratorio: d.semLab,
      unidades_de_outros_labs: perdedores,
      // Quanto do `liquido_ml` publicado vem de lote sem laboratório derivável.
      // > 0 significa: este saldo é real, mas o sistema não sabe de que lab é.
      ml_sem_laboratorio: vencedor && vencedor.lab === SEM_LAB ? vencedor.liquido_ml : 0,
      // Vão no retorno para a reserva ser AUDITÁVEL. Sem isso, pedido antigo
      // parado em `Confirmed` sem vínculo some estoque da vitrine e ninguém
      // descobre por que — o relatório da loja mostra o número e dá o rastro.
      ml_comprometido: comp.ml,
      ml_descontado_do_liquido: descontadoDoLiquido,
      itens_comprometidos_sem_volume: comp.semVolume,
    }
  }
  return saida
}

/**
 * Quantas unidades de cada volume dá para montar, dado o resultado acima.
 *
 * ATENÇÃO: `maximo` é "se o comprador levar SÓ este volume". O líquido é um
 * orçamento COMPARTILHADO entre os volumes, então somar os máximos estoura o
 * saldo. Quem monta carrinho tem de debitar `liquido_ml` a cada item — é por
 * isso que ele vai junto na resposta.
 */
function opcoesPorVolume (disp, volumes) {
  return (volumes || [])
    .map(v => parseFloat(v))
    .filter(v => v > 0)
    .sort((a, b) => a - b)
    .map(v => {
      const pronto = (disp.prontos.find(p => p.volume_ml === v) || {}).quantidade || 0
      const doLiquido = Math.floor(disp.liquido_ml / v)
      return { volume_ml: v, prontos: pronto, do_liquido: doLiquido, maximo: pronto + doLiquido }
    })
}

/**
 * Valida um carrinho inteiro contra a disponibilidade de um projeto.
 *
 * Existe porque `maximo` por volume é "se levar SÓ este volume": com 60ml o
 * 15ml mostra 4 e o 30ml mostra 2, mas levar 4+2 pede 150ml. A loja grava
 * `stock_quantity` por variação (é o que o Woo sabe fazer, e é o que esconde a
 * opção que não existe), e quem segura o orçamento COMPARTILHADO é esta função,
 * chamada do carrinho.
 *
 * Alocação: frasco pronto primeiro, por volume — ele já existe e não consome
 * líquido. O que sobrar sai do bolo de ml.
 *
 * @param {object} disp  saída de buildAvailability para UM projeto
 * @param {Array}  itens [{ volume_ml, quantidade }]
 * @returns {{ok: boolean, ml_necessario: number, ml_disponivel: number,
 *            prontos_usados: number, falta_ml: number,
 *            cobre_por_encomenda: boolean, previsao: string|null}}
 */
function validarCarrinho (disp, itens) {
  const d = disp || vazio()
  const prontos = {}
  for (const p of d.prontos) prontos[p.volume_ml] = p.quantidade

  let mlNecessario = 0
  let prontosUsados = 0

  for (const it of (itens || [])) {
    const v = num(it.volume_ml)
    const qtd = parseInt(it.quantidade) || 0
    if (v <= 0 || qtd <= 0) continue

    const doEstoque = Math.min(qtd, prontos[v] || 0)
    prontos[v] = (prontos[v] || 0) - doEstoque
    prontosUsados += doEstoque

    mlNecessario += (qtd - doEstoque) * v
  }

  const falta = Math.max(0, mlNecessario - d.liquido_ml)
  const encomenda = d.sob_encomenda

  return {
    ok: falta === 0,
    ml_necessario: mlNecessario,
    ml_disponivel: d.liquido_ml,
    prontos_usados: prontosUsados,
    falta_ml: falta,
    // Decisão do cliente: quando não fecha, o natural é VIRAR PRÉ-VENDA, não
    // recusar — o dinheiro já entrou. Isto diz se há maceração que cubra o que
    // faltou, para o carrinho escolher entre barrar e converter.
    cobre_por_encomenda: falta > 0 && !!encomenda && encomenda.ml >= falta,
    previsao: encomenda ? encomenda.previsao : null,
  }
}

module.exports = { buildAvailability, opcoesPorVolume, validarCarrinho, STATUS_ABERTOS }
