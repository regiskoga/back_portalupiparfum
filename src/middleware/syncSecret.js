// ═══════════════════════════════════════════════════════════════════════════
// Segredo compartilhado para os endpoints de sincronização com a loja
// ═══════════════════════════════════════════════════════════════════════════
//
// Contexto (02/11/2026): a loja WooCommerce (portalupiparfum.com.br) passa a
// LER a disponibilidade daqui para escrever `stock_quantity` nas variações.
// Esses endpoints expõem números de estoque e são chamados servidor-a-servidor
// pelo PHP da loja — nunca pelo navegador do comprador. Então não vão abertos
// como o catálogo: exigem um segredo no header `x-sync-secret`.
//
// DE ONDE VEM O SEGREDO, nesta ordem:
//   1. `process.env.CATALOG_SYNC_SECRET` — lugar mais seguro, fora do banco;
//   2. o parâmetro `catalog_sync_secret` (tabela `parameters`), editável na
//      tela Sistema → Parâmetros sem deploy.
//
// O parâmetro existe porque quem opera o sistema não tem acesso ao painel do
// Coolify para criar variável de ambiente. Sem ele o segredo ficaria vazio para
// sempre e a sincronização nunca sairia do 503. O ambiente continua tendo
// precedência para o dia em que estiver disponível.
//
// FALHA FECHADA: sem segredo em nenhuma das duas fontes (ou com segredo em
// branco), o endpoint responde 503 e não entrega nada. O contrário — "sem
// segredo configurado, libera" — transformaria um deploy incompleto num
// vazamento silencioso. Dead on arrival é melhor que aberto por engano.
//
// A comparação é em tempo constante (`timingSafeEqual`). Com `===` o tempo de
// resposta vaza o tamanho do prefixo correto e o segredo pode ser descoberto
// byte a byte.

const crypto = require('crypto')
const { db } = require('../models/db')

const HEADER = 'x-sync-secret'
const PARAM_KEY = 'catalog_sync_secret'

// Cache curto do valor do banco: a loja chama de 15 em 15 minutos, mas o hook
// do carrinho chama a cada checkout. Sem cache seria um SELECT por requisição.
// 30s é curto o bastante para trocar o segredo na tela e ver o efeito quase na
// hora, e longo o bastante para não pesar.
const CACHE_MS = 30 * 1000
let cache = { valor: null, expira: 0 }

async function segredoDoBanco () {
  const agora = Date.now()
  if (agora < cache.expira) return cache.valor

  let valor = null
  try {
    const linha = await db('parameters').where('key', PARAM_KEY).first()
    valor = linha && typeof linha.value === 'string' ? linha.value.trim() : null
  } catch (e) {
    // Banco fora do ar: devolve null e o middleware falha FECHADO. Não é hora
    // de liberar.
    //
    // Mas NÃO cacheia essa falha. Medido em 02/11/2026, logo após o deploy: a
    // primeira requisição depois de subir o container pegou o banco ainda
    // acordando, e o `null` cacheado fez os dois endpoints responderem 503 por
    // 30 segundos com o segredo corretamente configurado. Para o estoque isso
    // é só uma rodada perdida; para um PEDIDO PAGO chegando nessa janela é
    // dinheiro que entrou sem pedido no sistema (o plugin reagenda, mas depende
    // dele). Sem cachear o erro, a requisição seguinte já tenta de novo.
    console.error('[syncSecret] falha ao ler o parametro:', e.message)
    return null
  }

  // Ausência da linha (migration não aplicada) ou valor em branco SÃO cacheáveis:
  // é estado estável do banco, não falha transitória.
  cache = { valor, expira: agora + CACHE_MS }
  return valor
}

/** Invalida o cache — chamado quando o parâmetro é salvo pela tela. */
function invalidarCacheDoSegredo () {
  cache = { valor: null, expira: 0 }
}

function comparaSeguro (a, b) {
  const bufA = Buffer.from(String(a), 'utf8')
  const bufB = Buffer.from(String(b), 'utf8')
  // timingSafeEqual exige mesmo tamanho; comparar o tamanho antes já vaza o
  // tamanho, o que é inofensivo perto de vazar o conteúdo.
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

async function requireSyncSecret (req, res, next) {
  const doAmbiente = process.env.CATALOG_SYNC_SECRET
  const esperado = (doAmbiente && String(doAmbiente).trim())
    ? String(doAmbiente).trim()
    : await segredoDoBanco()

  if (!esperado) {
    return res.status(503).json({
      error: 'Sincronizacao desligada: defina o segredo em Sistema -> Parametros '
        + '("Segredo de sincronizacao com a loja")',
    })
  }

  const recebido = req.get(HEADER)
  if (!recebido || !comparaSeguro(recebido, esperado)) {
    return res.status(401).json({ error: 'Segredo de sincronizacao invalido' })
  }

  next()
}

module.exports = { requireSyncSecret, invalidarCacheDoSegredo, HEADER, PARAM_KEY }
