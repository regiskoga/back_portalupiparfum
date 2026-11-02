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
 *
 * ATENÇÃO: laboratório é DERIVADO, não armazenado. É o fornecedor da 1ª essência
 * do lote (mesma definição de `batchesController`, que usa isso no `batch_code`).
 * "1ª" = menor `batch_essences.id` — a ordem precisa ser determinística, senão o
 * lab de um lote com várias essências muda entre execuções e a vitrine fica
 * piscando entre laboratórios sem ninguém ter escrito nada.
 *
 * ATENÇÃO: envase SEM vínculo de lote não tem laboratório derivável e por isso
 * fica de FORA da conta (os ~1.552 importados por planilha, à espera de vínculo
 * manual). Excluir é a escolha conservadora: a vitrine anuncia menos do que
 * existe, em vez de criar um pseudo-lab que misturaria laboratórios — exatamente
 * o que a regra 1 existe para evitar. O total excluído volta no retorno para o
 * tamanho do problema ficar visível — em DOIS campos, porque são duas causas
 * diferentes de estoque que existe e a vitrine não mostra:
 *   - `envases_sem_laboratorio`  = frasco sem vínculo de lote (o mutirão);
 *   - `unidades_de_outros_labs`  = frasco de um lab que perdeu a disputa.
 * O segundo é consequência normal da regra, o primeiro é dívida a quitar.
 */

const { db } = require('../models/db')

const STATUS_PRONTO    = 'Pronto para envase'
const STATUS_MACERACAO = 'Em maceração'

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

function vazio () {
  return {
    laboratorio_id: null,
    liquido_ml: 0,
    prontos: [],
    sob_encomenda: null,
    envases_sem_laboratorio: 0,
    unidades_de_outros_labs: 0,
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
    const lab = labDe[l.id]
    if (lab === undefined) continue    // lote sem essência: sem lab, fica de fora
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
    const lab = loteId === undefined ? undefined : labDe[loteId]
    if (lab === undefined) {
      garante(f.product_id).semLab += parseInt(f.quantity_available) || 0
      continue
    }
    const b = bucket(f.product_id, lab)
    const v = num(f.volume_ml)
    b.prontos[v] = (b.prontos[v] || 0) + (parseInt(f.quantity_available) || 0)
  }

  // Elege o laboratório vencedor por ml-equivalente
  const saida = {}
  for (const pid of ids) {
    const d = porProjeto[pid]
    if (!d) { saida[pid] = vazio(); continue }

    let vencedor = null
    let melhor = -1
    for (const k of Object.keys(d.labs)) {
      const b = d.labs[k]
      const equivalente = b.liquido_ml +
        Object.entries(b.prontos).reduce((a, [v, q]) => a + num(v) * q, 0)
      if (equivalente > melhor) { melhor = equivalente; vencedor = b }
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
      laboratorio_id: vencedor ? vencedor.lab : null,
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

module.exports = { buildAvailability, opcoesPorVolume, validarCarrinho }
