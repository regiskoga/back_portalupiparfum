// ═══════════════════════════════════════════════════════════════════════════
// Preço de venda no site, por tamanho de frasco
// ═══════════════════════════════════════════════════════════════════════════
//
// POR QUE É UM PARÂMETRO E NÃO `price_lists`: são duas coisas diferentes, e
// confundi-las já custou caro aqui.
//
//   - `price_lists` é o preço do SISTEMA, por projeto, com vigência. É ele que
//     a tela de Vendas carrega para montar pedido (vendas.js: GET
//     /price-lists?status=VIGENTE). Em 02/11/2026 vale 37,90 / 57,90 / 87,90 /
//     137,90.
//   - Este parâmetro é o preço do SITE. Em 02/11/2026 a loja cobra 45,90 /
//     69,90 / 105,90 / 169,90 — cerca de 20% acima, e por decisão do dono é
//     assim que fica.
//
// Fundir os dois faria um dos canais mudar de preço sozinho. Então o site tem
// a tabela dele, editável em Sistema → Parâmetros, sem deploy.
//
// É por TAMANHO, não por projeto: hoje todos os 50 projetos têm o mesmo preço
// em cada volume. Quando um projeto precisar de preço próprio (os "Extrait"
// são o caso óbvio), isto vira a tabela base e a exceção entra por cima — mas
// enquanto não existe exceção, uma tabela de 4 linhas é o que descreve a
// realidade, e qualquer coisa maior seria estrutura sem conteúdo.
//
// FALHA FECHADA: volume sem preço legível simplesmente NÃO sai no payload, e
// quem consome não mexe no preço daquela variação. Publicar 0,00 por causa de
// uma vírgula trocada seria vender perfume de graça.

const { db } = require('../models/db')

const PARAM_KEY = 'precos_site'

// Mesmo cache curto do segredo de sincronização: a loja chama de 15 em 15
// minutos, mas o hook do carrinho chama a cada checkout. 30s deixa a edição na
// tela aparecer quase na hora sem um SELECT por requisição.
const CACHE_MS = 30 * 1000
let cache = { valor: null, expira: 0 }

/**
 * Lê "15 = 45,90" (uma linha por volume) e devolve { 15: 45.9, ... }.
 *
 * Deliberadamente liberal no formato: quem edita isto é o dono da marca numa
 * textarea, não um programador. Aceita `=`, `:`, `-` ou só espaço como
 * separador, vírgula ou ponto como decimal, "ml" junto do número, linha em
 * branco e comentário começando com #. O que não casar é ignorado em silêncio
 * — e o volume fica sem preço, que é a falha fechada.
 */
function parsePrecos (texto) {
  const mapa = {}
  if (!texto || typeof texto !== 'string') return mapa

  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.trim()
    if (!linha || linha.startsWith('#')) continue

    // 1º número = volume, 2º número = preço.
    const m = linha.match(/^(\d+(?:[.,]\d+)?)\s*(?:ml)?\s*(?:[=:\-]|\s)\s*R?\$?\s*(\d+(?:[.,]\d+)?)/i)
    if (!m) continue

    const volume = parseFloat(m[1].replace(',', '.'))
    const preco = parseFloat(m[2].replace(',', '.'))
    if (!(volume > 0) || !(preco > 0)) continue

    mapa[volume] = preco
  }
  return mapa
}

async function precosDoBanco () {
  const agora = Date.now()
  if (agora < cache.expira) return cache.valor

  let texto = null
  try {
    const linha = await db('parameters').where('key', PARAM_KEY).first()
    texto = linha && typeof linha.value === 'string' ? linha.value : null
  } catch (e) {
    // Banco fora do ar: devolve vazio e NÃO cacheia o erro — mesma lição do
    // syncSecret, onde um `null` cacheado numa requisição que pegou o banco
    // acordando fechou os endpoints por 30 segundos.
    console.error('[precosSite] falha ao ler o parametro:', e.message)
    return {}
  }

  const mapa = parsePrecos(texto)
  cache = { valor: mapa, expira: agora + CACHE_MS }
  return mapa
}

/** Invalida o cache — chamado quando o parâmetro é salvo pela tela. */
function invalidarCacheDePrecos () {
  cache = { valor: null, expira: 0 }
}

module.exports = { precosDoBanco, parsePrecos, invalidarCacheDePrecos, PARAM_KEY }
