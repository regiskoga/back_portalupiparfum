// ─────────────────────────────────────────────────────────────────────────────
// Preenche `price_lists.site_price` (campo "Preço do site" da tela Tabela de
// Preços) nas linhas que estão vazias, para o dono ter todas preenchidas e ir
// ajustando à mão em vez de digitar da estaca zero.
//
// DUAS FONTES POSSÍVEIS, e a escolha muda o preço da loja:
//
//   FONTE=sugerido  copia o `price` da própria linha — o "Preço sugerido", que
//                   é o preço do SISTEMA. Em 08/11/2026 isso é
//                   37,90/57,90/87,90/137,90, ou seja ~20% ABAIXO do que a loja
//                   cobra hoje. Com `escrever_precos` ligado, a loja CAI para
//                   esses valores na próxima rodada do cron (até 15 min).
//
//   FONTE=site      copia a tabela por frasco do parâmetro `precos_site` —
//                   49,90/69,90/105,90/169,90, exatamente o que a loja cobra
//                   hoje. Deixa tudo preenchido para editar SEM mover preço
//                   nenhum. É o preenchimento neutro.
//
// Em qualquer das duas, `price` ("Preço sugerido") não é tocado: a tela de
// Vendas continua com o preço do sistema.
//
// Só mexe em linha com `site_price IS NULL`: rodar de novo não sobrescreve
// ajuste manual já feito.
//
// COMO DESFAZER: o backup JSON na raiz traz a lista de ids.
//   UPDATE price_lists SET site_price = NULL WHERE id IN (<ids do backup>);
//
//   FONTE=site node scripts/fix_site_price_inicial_2026-11-08.js           # dry-run
//   FONTE=site APPLY=1 node scripts/fix_site_price_inicial_2026-11-08.js   # aplica
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const knex = require('knex')(require('../knexfile').development)

const FONTE = (process.env.FONTE || '').toLowerCase()
const APPLY = process.env.APPLY === '1'
const HOJE  = new Date().toISOString().slice(0, 10)

// Mesmo parser liberal da tela (services/precosSite.js). Copiado para o script
// não instanciar o pool da aplicação ao importar aquele módulo.
function parsePrecos (texto) {
  const mapa = {}
  if (!texto || typeof texto !== 'string') return mapa
  for (const bruta of texto.split(/[\r\n]+/)) {
    const l = bruta.trim()
    if (!l || l.startsWith('#')) continue
    const m = l.match(/^(\d+(?:[.,]\d+)?)\s*(?:ml)?\s*(?:[=:\-]|\s)\s*R?\$?\s*(\d+(?:[.,]\d+)?)/i)
    if (!m) continue
    const vol = parseFloat(m[1].replace(',', '.'))
    const pr  = parseFloat(m[2].replace(',', '.'))
    if (vol > 0 && pr > 0) mapa[vol] = pr
  }
  return mapa
}

;(async () => {
  try {
    if (FONTE !== 'sugerido' && FONTE !== 'site') {
      console.error('Defina FONTE=sugerido ou FONTE=site. Leia o cabecalho do arquivo:')
      console.error('  FONTE=sugerido  copia o preco do SISTEMA (37,90...) -> DERRUBA o preco da loja ~20%')
      console.error('  FONTE=site      copia a tabela por frasco (49,90...) -> nao move preco nenhum')
      process.exitCode = 1
      return
    }

    console.log(`HOST: ${process.env.DB_HOST} | fonte: ${FONTE} | modo: ${APPLY ? 'APPLY (escreve)' : 'DRY-RUN'}`)

    const param  = await knex('parameters').where('key', 'precos_site').first()
    const tabela = parsePrecos(param && param.value)
    console.log(`Tabela por frasco (parametro precos_site): ${JSON.stringify(tabela)}\n`)

    // Alvo: linha sem preco de site e com preco de sistema valido. As linhas de
    // 3ml estao gravadas com price = 0 e ficam de fora — preco de site zero nao
    // e preco, e o servico as ignoraria de todo jeito.
    const alvo = await knex('price_lists as pl')
      .join('products as p', 'p.id', 'pl.product_id')
      .whereNull('pl.site_price')
      .where('pl.price', '>', 0)
      .select('pl.id', 'pl.product_id', 'p.project_name',
        knex.raw('CAST(pl.volume_ml AS float) as volume_ml'),
        knex.raw('CAST(pl.price AS float) as price'),
        'pl.valid_from', 'pl.valid_to')
      .orderBy('pl.product_id').orderBy('pl.volume_ml')

    console.log(`Linhas com "Preco do site" vazio e preco de sistema > 0: ${alvo.length}`)
    if (alvo.length === 0) {
      console.log('Nada a fazer.')
      return
    }

    const novoValor = (r) => FONTE === 'sugerido'
      ? r.price
      : (tabela[r.volume_ml] !== undefined ? tabela[r.volume_ml] : null)

    const comValor = alvo.filter(r => novoValor(r) !== null)
    const semValor = alvo.filter(r => novoValor(r) === null)

    console.log(`  serao preenchidas: ${comValor.length}`)
    console.log(`  ficam vazias (volume sem linha na tabela do site): ${semValor.length}`)

    // Quanto o preco da loja se move com esta escolha.
    let sobe = 0, desce = 0, igual = 0, soma = 0
    for (const r of comValor) {
      const hoje = tabela[r.volume_ml]
      if (hoje === undefined) continue
      const d = novoValor(r) - hoje
      if (Math.abs(d) < 0.005) igual++
      else if (d > 0) sobe++
      else desce++
      soma += d
    }
    console.log(`\nEfeito no preco da LOJA (contra os ${JSON.stringify(tabela)} de hoje):`)
    console.log(`  sobe: ${sobe}   desce: ${desce}   igual: ${igual}   variacao media: ${comValor.length ? (soma / comValor.length).toFixed(2) : '0.00'}`)
    if (desce > 0) {
      console.log(`\n  ** ATENCAO: ${desce} variacao(oes) FICAM MAIS BARATAS na loja.`)
      console.log('     Com escrever_precos ligado, o plugin grava isso em até 15 min.')
    }

    const porVolume = {}
    for (const r of comValor) {
      const k = `${r.volume_ml}ml`
      porVolume[k] = porVolume[k] || { n: 0, valor: novoValor(r) }
      porVolume[k].n++
    }
    console.log('\nPor volume:')
    for (const k of Object.keys(porVolume)) {
      console.log(`  ${k.padStart(6)}  ->  ${porVolume[k].valor.toFixed(2)}  em ${porVolume[k].n} linha(s)`)
    }

    console.log('\nAmostra (primeiras 10):')
    for (const r of comValor.slice(0, 10)) {
      console.log(`  id=${String(r.id).padStart(4)} ${String(r.project_name).slice(0, 30).padEnd(30)} ` +
        `${String(r.volume_ml).padStart(5)}ml  sistema ${r.price.toFixed(2)}  ->  site ${novoValor(r).toFixed(2)}`)
    }

    if (!APPLY) {
      console.log('\nDRY-RUN: nada foi escrito. Rode com APPLY=1 para aplicar.')
      return
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const arq = path.resolve(__dirname, '..', '..', `backup_site_price_${stamp}.json`)
    fs.writeFileSync(arq, JSON.stringify({
      script: 'fix_site_price_inicial_2026-11-08.js',
      host: process.env.DB_HOST,
      fonte: FONTE,
      tabela_por_frasco: tabela,
      criterio: 'price_lists.site_price IS NULL AND price > 0',
      desfazer: `UPDATE price_lists SET site_price = NULL WHERE id IN (${comValor.map(r => r.id).join(',')});`,
      gerado_em: new Date().toISOString(),
      total: comValor.length,
      ids: comValor.map(r => r.id),
      linhas: comValor.map(r => ({ ...r, site_price_novo: novoValor(r) })),
    }, null, 2), 'utf8')
    console.log(`\nBackup gravado: ${arq}`)

    const ESPERADO = comValor.length
    await knex.transaction(async (trx) => {
      let n = 0
      // Um UPDATE por valor distinto, nao um por linha: sao 4 comandos em vez
      // de ~290 idas ao banco.
      const grupos = {}
      for (const r of comValor) {
        const v = novoValor(r).toFixed(2)
        grupos[v] = grupos[v] || []
        grupos[v].push(r.id)
      }
      for (const valor of Object.keys(grupos)) {
        n += await trx('price_lists').whereIn('id', grupos[valor])
          .update({ site_price: parseFloat(valor), updated_at: trx.fn.now() })
      }
      console.log(`UPDATE aplicado em ${n} linha(s).`)
      if (n !== ESPERADO) throw new Error(`update afetou ${n} linhas, esperado ${ESPERADO} - rollback`)
    })

    const depois = await knex('price_lists')
      .whereNotNull('site_price')
      .select(knex.raw('CAST(volume_ml AS float) as volume_ml'), knex.raw('CAST(site_price AS float) as site_price'))
      .count('* as n')
      .groupBy('volume_ml', 'site_price')
      .orderBy('volume_ml')
    console.log('\nVerificacao pos-update (site_price por volume):')
    for (const r of depois) {
      console.log(`  ${String(r.volume_ml).padStart(6)}ml  ${r.site_price.toFixed(2).padStart(9)}  em ${r.n} linha(s)`)
    }
    const [{ n: vazias }] = await knex('price_lists').whereNull('site_price').count('* as n')
    console.log(`\nLinhas ainda sem "Preco do site" (3ml e afins): ${vazias}`)
    console.log('A loja ve a mudanca na proxima rodada do cron (ate 15 min).')
  } catch (e) {
    console.error('ERRO:', e.message)
    process.exitCode = 1
  } finally {
    await knex.destroy()
  }
})()
