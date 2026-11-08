// QA da precedência de preço do site (08/11/2026): exercita o caminho real de
// services/precosSite.js contra os dados de produção e simula o que `list` e
// `/stock` passariam a devolver.
//
//   node scripts/qa_preco_do_site.js
//
// CT3 grava de verdade numa linha de `price_lists` e a restaura no `finally` —
// o serviço usa o `db` global, então não dá para isolar numa transação. É uma
// linha só, e o teste confere a restauração no fim.
//
// `process.exit` no fim de propósito: o pool de src/models/db não é controlado
// por este script, e sem o exit o processo imprime tudo e nunca termina.
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })
const { db } = require('../src/models/db')
const { montarPrecosDoSite } = require('../src/services/precosSite')
const { buildAvailability, opcoesPorVolume } = require('../src/services/catalogAvailability')

let falhas = 0
const ok = (c, m) => { if (!c) falhas++; console.log(`${c ? '  OK  ' : ' FALHA'}  ${m}`) }

;(async () => {
  try {
    // ── CT1: a coluna existe e nasceu toda nula ──────────────────────────────
    const [{ n: total }]   = await db('price_lists').count('* as n')
    const [{ n: comSite }] = await db('price_lists').whereNotNull('site_price').count('* as n')
    console.log(`\nCT1 - coluna site_price: ${total} linhas, ${comSite} com valor`)
    ok(Number(comSite) === 0, 'nenhuma linha tem site_price ainda (a migration nao moveu preco)')

    // ── CT2: sem exceção, o preço vem da tabela por frasco ───────────────────
    const amostra = await db('products')
      .where('active', true).whereNotNull('catalog_status')
      .select('id', 'project_name').orderBy('id').limit(3)
    const precos = await montarPrecosDoSite(amostra.map(p => p.id))
    console.log(`\nCT2 - tabela base lida do parametro: ${JSON.stringify(precos.tabela)}`)
    console.log(`      volumes base: [${precos.volumesBase.join(', ')}]`)
    for (const p of amostra) {
      const linha = precos.volumesDe(p.id).map(v => `${v}ml=${precos.precoDe(p.id, v)}`).join('  ')
      console.log(`      ${String(p.project_name).slice(0, 28).padEnd(28)} ${linha}`)
    }
    ok(precos.volumesBase.length === 4, 'os 4 tamanhos de frasco viraram volumes vendaveis')
    ok(precos.precoDe(amostra[0].id, 15) === 49.9, 'projeto sem excecao pega 49,90 no 15ml (tabela)')
    ok(precos.precoDe(amostra[0].id, 7) === null, 'volume fora da tabela e sem excecao devolve null (falha fechada)')

    // ── CT3: exceção por projeto ganha da tabela ─────────────────────────────
    const hojeQA = new Date().toISOString().slice(0, 10)
    const linha = await db('price_lists')
      .where('volume_ml', 15)
      .where('valid_from', '<=', hojeQA)
      .where(function () { this.whereNull('valid_to').orWhere('valid_to', '>=', hojeQA) })
      .first()

    if (!linha) {
      console.log('\nCT3 - PULADO: nenhuma linha de 15ml vigente no banco')
    } else {
      try {
        await db('price_lists').where('id', linha.id).update({ site_price: 199.9 })
        const proj = await db('products').where('id', linha.product_id).first()
        const pe = await montarPrecosDoSite([linha.product_id])
        console.log(`\nCT3 - excecao de 199,90 no 15ml de "${proj.project_name}" (linha ${linha.id}):`)
        console.log(`      ${pe.volumesDe(linha.product_id).map(v => `${v}ml=${pe.precoDe(linha.product_id, v)}`).join('  ')}`)
        ok(pe.precoDe(linha.product_id, 15) === 199.9, 'o 15ml passou a valer 199,90 - a excecao ganhou da tabela')
        ok(pe.precoDe(linha.product_id, 30) === 69.9, 'o 30ml, sem excecao, seguiu em 69,90 (tabela)')

        const recarregada = await db('price_lists').where('id', linha.id).first()
        ok(Number(recarregada.price) === Number(linha.price), 'o "Preco sugerido" (price) ficou intocado')

        // Exceção fora da tabela base tem de virar volume vendável novo.
        await db('price_lists').where('id', linha.id).update({ volume_ml: 7, site_price: 29.9 })
        const p7 = await montarPrecosDoSite([linha.product_id])
        ok(p7.volumesDe(linha.product_id).includes(7), 'volume 7ml, que so existe como excecao, entrou na lista')
        ok(p7.precoDe(linha.product_id, 7) === 29.9, 'e saiu com o preco proprio de 29,90')

        // Preço zerado ou negativo não é exceção: cai de volta na tabela.
        await db('price_lists').where('id', linha.id).update({ volume_ml: 15, site_price: 0 })
        const p0 = await montarPrecosDoSite([linha.product_id])
        ok(p0.precoDe(linha.product_id, 15) === 49.9, 'site_price = 0 e ignorado e volta a valer a tabela (49,90)')
      } finally {
        await db('price_lists').where('id', linha.id)
          .update({ site_price: linha.site_price === undefined ? null : linha.site_price, volume_ml: linha.volume_ml })
        const volta = await db('price_lists').where('id', linha.id).first()
        ok(volta.site_price === null && Number(volta.volume_ml) === Number(linha.volume_ml),
          `linha ${linha.id} restaurada (site_price nulo, volume ${Number(linha.volume_ml)}ml)`)
      }
    }

    const [{ n: sobrou }] = await db('price_lists').whereNotNull('site_price').count('* as n')
    ok(Number(sobrou) === 0, 'o banco segue sem nenhuma excecao gravada')

    // ── CT4: o que o /stock passaria a emitir ────────────────────────────────
    const publicaveis = await db('products')
      .where('active', true).whereNotNull('catalog_status')
      .whereNotNull('sku').where('sku', '!=', '')
      .select('id', 'sku', 'project_name')
    const ids = publicaveis.map(r => r.id)
    const pAll = await montarPrecosDoSite(ids)
    const disp = await buildAvailability(ids)

    let comVolumes = 0, semVolumes = 0, comPreco = 0, semPreco = 0, comSaldo = 0
    for (const r of publicaveis) {
      const d = disp[r.id] || null
      const vols = d ? opcoesPorVolume(d, pAll.volumesDe(r.id)) : []
      if (vols.length) comVolumes++
      else semVolumes++
      for (const v of vols) {
        if (pAll.precoDe(r.id, v.volume_ml) === null) semPreco++
        else comPreco++
        if (v.maximo > 0) comSaldo++
      }
    }
    console.log(`\nCT4 - simulacao do /stock sobre ${publicaveis.length} projetos publicaveis:`)
    console.log(`      projetos com volumes no payload: ${comVolumes}   sem volumes: ${semVolumes}`)
    console.log(`      variacoes com preco: ${comPreco}   sem preco (saem sem \`preco\`): ${semPreco}`)
    console.log(`      variacoes com estoque > 0: ${comSaldo}`)
    ok(semVolumes === 0, 'todo projeto publicavel agora sai com volumes (antes so os com price_lists)')
    ok(semPreco === 0, 'toda variacao sai com preco (a tabela cobre os 4 tamanhos)')

    // ── CT5: a vitrine passa a mostrar o preço do site, não o do sistema ─────
    const embalagens = await db('packaging_types')
      .select('name', db.raw('CAST(volume_ml AS float) as volume_ml')).orderBy('id')
    const nomeDoVolume = {}
    for (const e of embalagens) {
      if (nomeDoVolume[e.volume_ml] === undefined) nomeDoVolume[e.volume_ml] = e.name
    }

    const umComPreco = await db('price_lists as pl')
      .join('products as p', 'p.id', 'pl.product_id')
      .where('p.active', true).whereNotNull('p.catalog_status')
      .where('pl.price', '>', 0).where('pl.volume_ml', 15)
      .select('p.id', 'p.project_name').first()
    const pv = await montarPrecosDoSite([umComPreco.id])
    const chips = pv.volumesDe(umComPreco.id)
      .map(v => ({ volume_ml: v, price: pv.precoDe(umComPreco.id, v), packaging_name: nomeDoVolume[v] || `${v}ml` }))
      .filter(x => x.price !== null)
    const sistema = await db('price_lists').where('product_id', umComPreco.id).where('volume_ml', 15).first()
    console.log(`\nCT5 - vitrine para "${umComPreco.project_name}":`)
    console.log(`      ${chips.map(c => `${c.packaging_name} ${c.price.toFixed(2)}`).join('  |  ')}`)
    console.log(`      (o "Preco sugerido" do 15ml no sistema segue ${Number(sistema.price).toFixed(2)})`)
    ok(chips.length === 4, 'os 4 chips de preco aparecem')
    ok(chips[0].price === 49.9, 'o chip do 15ml mostra 49,90 (preco da loja), nao 37,90')
    ok(chips[0].packaging_name === 'Frasco 15ml', 'o nome da embalagem foi resolvido pelo volume')

    console.log(`\n${falhas === 0 ? 'TODOS OS CT PASSARAM' : `${falhas} ASSERCAO(OES) FALHOU/FALHARAM`}`)
  } catch (e) {
    console.error('ERRO:', e.message, '\n', e.stack)
    falhas++
  } finally {
    await db.destroy()
    process.exit(falhas === 0 ? 0 : 1)
  }
})()
