// Diagnóstico (08/11/2026): comparar o preço do SITE (parâmetro `precos_site`,
// por tamanho de frasco) com o preço do SISTEMA (`price_lists`, por projeto)
// nos projetos que têm preço vigente. Serve para medir o impacto de inverter a
// precedência — "preço do perfume ganha, tabela por frasco é o fallback".
// Só LÊ.
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })
const knex = require('knex')(require('../knexfile').development)
// `parsePrecos` copiado de src/services/precosSite.js de propósito: importar
// aquele módulo instancia o pool de knex da aplicação (ele faz
// `require('../models/db')` no topo), e o `knex.destroy()` daqui não o alcança
// — o script imprime tudo e nunca sai.
function parsePrecos (texto) {
  const mapa = {}
  if (!texto || typeof texto !== 'string') return mapa
  for (const linhaBruta of texto.split(/[\r\n]+/)) {
    const linha = linhaBruta.trim()
    if (!linha || linha.startsWith('#')) continue
    const m = linha.match(/^(\d+(?:[.,]\d+)?)\s*(?:ml)?\s*(?:[=:\-]|\s)\s*R?\$?\s*(\d+(?:[.,]\d+)?)/i)
    if (!m) continue
    const volume = parseFloat(m[1].replace(',', '.'))
    const preco = parseFloat(m[2].replace(',', '.'))
    if (!(volume > 0) || !(preco > 0)) continue
    mapa[volume] = preco
  }
  return mapa
}

const HOJE = new Date().toISOString().slice(0, 10)

;(async () => {
  try {
    const param = await knex('parameters').where('key', 'precos_site').first()
    const tabela = parsePrecos(param && param.value)
    console.log('Parâmetro `precos_site` (preço do SITE por frasco):')
    console.log(Object.keys(tabela).length ? tabela : '  (VAZIO / ilegível)')

    const vig = await knex('price_lists as pl')
      .join('products as p', 'p.id', 'pl.product_id')
      .where('p.active', true)
      .where('pl.price', '>', 0)
      .where('pl.valid_from', '<=', HOJE)
      .where(function () { this.whereNull('pl.valid_to').orWhere('pl.valid_to', '>=', HOJE) })
      .select('pl.product_id', 'p.project_name',
        knex.raw('CAST(pl.volume_ml AS float) as volume_ml'),
        knex.raw('CAST(pl.price AS float) as price'))
      .orderBy('pl.product_id').orderBy('pl.volume_ml')

    const projetos = new Set(vig.map(r => r.product_id))
    console.log(`\n`.trim())
    console.log(`\nprice_lists VIGENTE: ${vig.length} linha(s) em ${projetos.size} projeto(s) ativo(s)`)

    // Quantos preços distintos existem por volume, no sistema
    const porVol = {}
    for (const r of vig) {
      porVol[r.volume_ml] = porVol[r.volume_ml] || {}
      porVol[r.volume_ml][r.price] = (porVol[r.volume_ml][r.price] || 0) + 1
    }
    console.log('\nPreço do SISTEMA por volume (preço → nº de projetos)  vs  preço do SITE:')
    for (const vol of Object.keys(porVol).sort((a, b) => a - b)) {
      const site = tabela[vol] !== undefined ? tabela[vol].toFixed(2) : '— sem linha —'
      const sis = Object.entries(porVol[vol])
        .sort((a, b) => b[1] - a[1])
        .map(([p, n]) => `${Number(p).toFixed(2)} (${n})`).join('  ')
      console.log(`  ${String(vol).padStart(5)}ml   site: ${String(site).padStart(12)}   sistema: ${sis}`)
    }

    // Se a precedência virar "perfume ganha", de quanto muda o preço na loja?
    let sobe = 0, desce = 0, igual = 0, semLinha = 0
    let somaDelta = 0
    const piores = []
    for (const r of vig) {
      const site = tabela[r.volume_ml]
      if (site === undefined) { semLinha++; continue }
      const d = r.price - site
      if (Math.abs(d) < 0.005) igual++
      else if (d > 0) sobe++
      else desce++
      somaDelta += d
      piores.push({ ...r, site, delta: d })
    }
    console.log(`\nSe o preço do perfume passar a MANDAR na loja, nas ${vig.length} variações vigentes:`)
    console.log(`  preço SOBE:  ${sobe}`)
    console.log(`  preço DESCE: ${desce}`)
    console.log(`  igual:       ${igual}`)
    console.log(`  volume sem linha na tabela do site (nada a comparar): ${semLinha}`)
    if (piores.length) {
      console.log(`  variação média: ${(somaDelta / piores.length).toFixed(2)}`)
      piores.sort((a, b) => a.delta - b.delta)
      console.log('\n  As 10 maiores QUEDAS de preço na loja:')
      for (const r of piores.slice(0, 10)) {
        console.log(`    ${String(r.volume_ml).padStart(4)}ml  ${String(r.project_name).slice(0, 34).padEnd(34)} site ${r.site.toFixed(2)} → ${r.price.toFixed(2)}  (${r.delta.toFixed(2)})`)
      }
    }
  } catch (e) {
    console.error('ERRO:', e.message)
    process.exitCode = 1
  } finally {
    await knex.destroy()
  }
})()
