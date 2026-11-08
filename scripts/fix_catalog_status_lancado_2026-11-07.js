// ─────────────────────────────────────────────────────────────────────────────
// Publica no catálogo TODO projeto ativo que está em "Não publicado":
// `products.catalog_status IS NULL` → `'Lançado'`, onde `active = true`.
//
// Por quê (07/11/2026): a loja e a vitrine só mostravam 50 perfumes. Não era
// limite de paginação — `GET /api/public/catalog` e `/api/public/catalog/stock`
// filtram por `catalog_status IS NOT NULL`, e só 50 projetos tinham o campo
// preenchido (conferido ao vivo: `total: 50`, todos `Lançado`). O campo nasce
// null e a importação por planilha nunca o preencheu, então todo o resto do
// catálogo ficou fora da vitrine por omissão, não por decisão.
//
// Projeto INATIVO não entra: `active = false` é decisão explícita de alguém.
//
// EFEITO IMEDIATO, leia antes de aplicar:
//   1. `/catalogo.html` (página PÚBLICA) passa a listar todos eles. Projeto sem
//      foto, sem narrativa ou sem preço vigente aparece do mesmo jeito — hoje
//      nenhum dos 50 publicados está nesse estado, então é comportamento novo.
//   2. Quem tiver `sku` preenchido entra no payload do `/stock`, que o plugin
//      da loja lê de 15 em 15 minutos. O plugin só age sobre SKU que já existe
//      no Woo — ele NÃO cria produto —, então para a loja o efeito é só nas
//      fichas que já estão lá. SKU duplicado é recusado pelo `/stock` e sai em
//      `skus_ambiguos`: o relatório mostra abaixo quais seriam.
//
// COMO DESFAZER: o backup JSON na raiz traz a lista de ids tocados.
//   UPDATE products SET catalog_status = NULL WHERE id IN (<ids do backup>);
//
// Contrato dos scripts one-off do repo: dry-run por padrão, APPLY=1 para valer,
// backup JSON na raiz antes de escrever.
//
//   node scripts/fix_catalog_status_lancado_2026-11-07.js           # dry-run
//   APPLY=1 node scripts/fix_catalog_status_lancado_2026-11-07.js   # aplica
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const knex = require('knex')(require('../knexfile').development)

const PARA  = 'Lançado'   // um dos 3 valores do enum (migration 20260619_001)
const APPLY = process.env.APPLY === '1'
const HOJE  = new Date().toISOString().slice(0, 10)

// O alvo, num só lugar: é esta cláusula que o UPDATE tem de repetir.
const alvoQuery = (q) => q.where('active', true).whereNull('catalog_status')

;(async () => {
  try {
    console.log(`HOST: ${process.env.DB_HOST} | modo: ${APPLY ? 'APPLY (escreve)' : 'DRY-RUN'}`)
    console.log(`Alvo: products WHERE active = true AND catalog_status IS NULL  →  '${PARA}'\n`)

    // ── Panorama, para o número fazer sentido antes de mexer ──────────────────
    const [{ n: ativos }]     = await knex('products').where('active', true).count('* as n')
    const [{ n: inativos }]   = await knex('products').where('active', false).count('* as n')
    const porStatus           = await knex('products').where('active', true)
      .select('catalog_status').count('* as n').groupBy('catalog_status').orderBy('n', 'desc')

    console.log(`Projetos ativos: ${ativos}   |   inativos (NÃO serão tocados): ${inativos}`)
    console.log('Ativos por catalog_status:')
    for (const r of porStatus) {
      console.log(`  ${String(r.catalog_status || '(null) = Não publicado').padEnd(28)} ${r.n}`)
    }

    const alvo = await alvoQuery(knex('products'))
      .select('id', 'project_name', 'commercial_name', 'sku', 'inspiration_brand')
      .orderBy('id')

    console.log(`\nSeriam publicados agora: ${alvo.length} projeto(s)`)
    if (alvo.length === 0) {
      console.log('Nada a fazer — nenhum projeto ativo está em "Não publicado".')
      return
    }

    // ── O que cada um leva para a vitrine / para a loja ───────────────────────
    const ids    = alvo.map(r => r.id)
    const comSku = alvo.filter(r => r.sku && String(r.sku).trim() !== '')

    const comPreco = await knex('price_lists')
      .whereIn('product_id', ids)
      .where('price', '>', 0)
      .where('valid_from', '<=', HOJE)
      .where(function () { this.whereNull('valid_to').orWhere('valid_to', '>=', HOJE) })
      .distinct('product_id')
    const idsComPreco = new Set(comPreco.map(r => r.product_id))

    console.log(`  com SKU preenchido (entram no /stock da loja): ${comSku.length}`)
    console.log(`  sem SKU (só na vitrine, invisíveis para a loja): ${alvo.length - comSku.length}`)
    console.log(`  com preço vigente hoje: ${idsComPreco.size}`)
    console.log(`  SEM preço vigente (aparecem na vitrine sem preço): ${alvo.length - idsComPreco.size}`)

    // SKU duplicado é recusado pelo /stock, não adivinhado: o par novo+antigo
    // sairia silenciosamente de `itens`. Então sai aqui, antes de aplicar.
    const skusAlvo = comSku.map(r => String(r.sku).trim())
    const colisoes = skusAlvo.length
      ? await knex('products')
        .whereIn(knex.raw('btrim(sku)'), skusAlvo)
        .select(knex.raw('btrim(sku) as sku'))
        .count('* as n')
        .groupBy(knex.raw('btrim(sku)'))
        .having(knex.raw('count(*)'), '>', 1)
      : []
    if (colisoes.length) {
      console.log(`\n⚠ ${colisoes.length} SKU(s) duplicado(s) entre os que entram — o /stock RECUSA`)
      console.log('  esses e os lista em `skus_ambiguos`. Publicar não quebra nada, mas eles')
      console.log('  não vão sincronizar com a loja até alguém desduplicar:')
      for (const c of colisoes.slice(0, 20)) console.log(`    ${c.sku} (${c.n}x)`)
      if (colisoes.length > 20) console.log(`    ... e outros ${colisoes.length - 20}`)
    } else {
      console.log('\nNenhum SKU duplicado entre os que entram.')
    }

    console.log('\nAmostra (primeiros 15):')
    for (const r of alvo.slice(0, 15)) {
      const sku   = r.sku && String(r.sku).trim() ? String(r.sku).trim() : '— sem SKU —'
      const preco = idsComPreco.has(r.id) ? '' : '  [sem preço]'
      console.log(`  id=${String(r.id).padStart(4)} ${sku.padEnd(14)} ${String(r.project_name).slice(0, 44).padEnd(44)}${preco}`)
    }
    if (alvo.length > 15) console.log(`  ... e outros ${alvo.length - 15}`)

    if (!APPLY) {
      console.log('\nDRY-RUN: nada foi escrito. Rode com APPLY=1 para aplicar.')
      return
    }

    // ── Backup na raiz do repo, ANTES de escrever ────────────────────────────
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const arq = path.resolve(__dirname, '..', '..', `backup_catalog_status_${stamp}.json`)
    fs.writeFileSync(arq, JSON.stringify({
      script: 'fix_catalog_status_lancado_2026-11-07.js',
      host: process.env.DB_HOST,
      de: null, para: PARA,
      criterio: 'active = true AND catalog_status IS NULL',
      desfazer: `UPDATE products SET catalog_status = NULL WHERE id IN (${ids.join(',')});`,
      gerado_em: new Date().toISOString(),
      total: alvo.length,
      ids,
      linhas: alvo,
    }, null, 2), 'utf8')
    console.log(`\nBackup gravado: ${arq}`)

    // Sem contagem esperada fixa: o invariante é o UPDATE casar com o dry-run
    // que acabou de ser impresso, na MESMA cláusula. Divergência = alguém mexeu
    // no meio do caminho, e aí a transação volta atrás.
    const ESPERADO = alvo.length
    await knex.transaction(async (trx) => {
      const n = await alvoQuery(trx('products')).update({ catalog_status: PARA })
      console.log(`UPDATE aplicado em ${n} linha(s).`)
      if (n !== ESPERADO) throw new Error(`update afetou ${n} linhas, esperado ${ESPERADO} — rollback`)
    })

    // ── Verificação depois ───────────────────────────────────────────────────
    const depois = await knex('products').where('active', true)
      .select('catalog_status').count('* as n').groupBy('catalog_status').orderBy('n', 'desc')
    console.log('\nVerificação pós-update (ativos por catalog_status):')
    for (const r of depois) {
      console.log(`  ${String(r.catalog_status || '(null) = Não publicado').padEnd(28)} ${r.n}`)
    }

    const [{ n: sobrou }] = await alvoQuery(knex('products')).count('* as n')
    console.log(`\nAtivos ainda em "Não publicado" (esperado 0): ${sobrou}`)

    const [{ n: naVitrine }] = await knex('products')
      .where('active', true).whereNotNull('catalog_status').count('* as n')
    const [{ n: noStock }] = await knex('products')
      .where('active', true).whereNotNull('catalog_status')
      .whereNotNull('sku').where('sku', '!=', '').count('* as n')
    console.log(`A vitrine /catalogo.html passa a listar: ${naVitrine}`)
    console.log(`O payload /stock passa a emitir (antes de tirar SKU ambíguo): ${noStock}`)
    console.log('\nA loja só vê a mudança na próxima rodada do cron (até 15 min).')
  } catch (e) {
    console.error('ERRO:', e.message)
    process.exitCode = 1
  } finally {
    await knex.destroy()
  }
})()
