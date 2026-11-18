// ─────────────────────────────────────────────────────────────────────────────
// Conserta o estoque acabado "fantasma" dos pedidos que nasceram Confirmados
// sem `stock_decremented`.
//
// O QUE ACONTECEU: o pedido pago no site é inserido direto como `Confirmed`
// (catalogController.receberPedidoPago), sem passar por `updateStatus` — que é
// quem liga `orders.stock_decremented`. Com o flag em false, `addBottling`
// (POST /orders/:id/items/:itemId/bottlings, o vínculo da tela Fila de Produção)
// cai no `if (order.stock_decremented)` e NÃO abate `bottlings.quantity_available`.
// Resultado: o envase já tem dono, já saiu do lote (`remaining_ml` foi debitado
// no create do envase), mas continua listado no Estoque Acabado — e continua
// sendo oferecido como "pronto" na vitrine e vinculável a um SEGUNDO pedido.
// Relato do cliente em 18/11/2026. A causa foi corrigida no controller; este
// script arruma as linhas que já estão no banco.
//
// O QUE FAZ, por pedido afetado, na MESMA transação:
//   1. abate de cada envase vinculado o que o vínculo diz (GREATEST(0, ...));
//   2. liga `stock_decremented = true`.
// As duas coisas juntas ou nenhuma: só o flag faria um cancelamento futuro
// CREDITAR estoque que nunca foi debitado; só o abate deixaria o cancelamento
// sem como devolver.
//
// QUEM ENTRA: pedido com `stock_decremented = false`, com pelo menos um vínculo
// em `order_item_bottlings`, e status VIVO (`Confirmed`, `In Production`,
// `Ready`, `Shipped`, `Delivered`, `Finalizado`). Fica de fora:
//   - `Pending`: carrinho, o vínculo nem é aceito nesse status;
//   - `Cancelled`/`Abandoned`: `updateStatus` já trata o par como não-debitado,
//     e debitar agora tiraria estoque de mercadoria que voltou pra prateleira;
//   - `Lost`: a mercadoria se perdeu e o `updateStatus` mantém o flag como está;
//     debitar aqui é defensável, mas é decisão de negócio — fica fora, e o
//     dry-run lista esses casos à parte para o dono decidir.
//
// Idempotente: depois de rodar, o pedido tem o flag true e sai do filtro.
//
// COMO DESFAZER: o backup JSON na raiz guarda, por envase, o
// `quantity_available` ANTES, e a lista de pedidos cujo flag foi ligado.
//
//   node scripts/fix_stock_decremented_pedidos_site_2026-11-18.js          # dry-run
//   APPLY=1 node scripts/fix_stock_decremented_pedidos_site_2026-11-18.js  # aplica
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const knex = require('knex')(require('../knexfile').development)

const APPLY = process.env.APPLY === '1'

const VIVOS = ['Confirmed', 'In Production', 'Ready', 'Shipped', 'Delivered', 'Finalizado']

;(async () => {
  try {
    // ── Panorama: todo pedido com vínculo e flag desligado, qualquer status ──
    const todos = await knex('orders as o')
      .join('order_items as oi', 'oi.order_id', 'o.id')
      .join('order_item_bottlings as oib', 'oib.order_item_id', 'oi.id')
      .where('o.stock_decremented', false)
      .groupBy('o.id')
      .select(
        'o.id', 'o.code', 'o.status', 'o.channel', 'o.from_catalog',
        knex.raw('COUNT(oib.id)::int as vinculos'),
        knex.raw('COALESCE(SUM(oib.quantity), 0)::int as un_vinculadas')
      )
      .orderBy('o.id', 'desc')

    const alvo = todos.filter(o => VIVOS.includes(o.status))
    const fora = todos.filter(o => !VIVOS.includes(o.status))

    console.log(`\nPedidos com vínculo de envase e stock_decremented=false: ${todos.length}`)
    console.log(`  → entram no conserto (status vivo): ${alvo.length}`)
    console.log(`  → ficam de fora (${[...new Set(fora.map(o => o.status))].join(', ') || 'nenhum'}): ${fora.length}`)
    if (fora.length) {
      console.log('\n  FORA — confira se algum merece decisão manual:')
      for (const o of fora) {
        console.log(`    #${o.id} ${o.code} [${o.status}] · ${o.un_vinculadas} un. vinculadas`)
      }
    }

    if (!alvo.length) {
      console.log('\nNada a consertar.')
      return
    }

    // ── Detalhe por pedido: envases e o que vai ser abatido ──
    const ids = alvo.map(o => o.id)
    const links = await knex('order_item_bottlings as oib')
      .join('order_items as oi', 'oi.id', 'oib.order_item_id')
      .join('bottlings as b', 'b.id', 'oib.bottling_id')
      .whereIn('oi.order_id', ids)
      // ATENÇÃO aos aliases: `oib.quantity` (unidades VINCULADAS) e `b.quantity`
      // (unidades PRODUZIDAS) têm o mesmo nome. Sem alias, o pg monta o objeto na
      // ordem do select e o segundo sobrescreve o primeiro — o abate viraria a
      // quantidade produzida, debitando mais do que o pedido levou.
      .select(
        'oi.order_id', 'oib.id as link_id', 'oib.quantity as link_qty',
        'b.id as bottling_id', 'b.bottling_code', 'b.product_name',
        'b.volume_ml', 'b.quantity as produzido', 'b.quantity_available'
      )
      .orderBy('oi.order_id', 'desc')

    // Um envase pode estar vinculado a mais de um item/pedido: soma tudo antes
    // de abater, para o GREATEST não ser aplicado parcela por parcela.
    const porEnvase = {}
    for (const l of links) {
      const e = porEnvase[l.bottling_id] = porEnvase[l.bottling_id] || {
        bottling_id: l.bottling_id,
        bottling_code: l.bottling_code,
        product_name: l.product_name,
        volume_ml: l.volume_ml,
        antes: parseInt(l.quantity_available),
        abater: 0,
      }
      e.abater += parseInt(l.link_qty)
    }

    const envases = Object.values(porEnvase)
    console.log('\n--- Envases que vão sair do Estoque Acabado ---')
    for (const e of envases) {
      const depois = Math.max(0, e.antes - e.abater)
      console.log(
        `  envase #${e.bottling_id} ${e.bottling_code || '(sem código)'} · ` +
        `${e.product_name} ${e.volume_ml}ml · disponível ${e.antes} → ${depois} (abate ${e.abater})` +
        (e.antes < e.abater ? '  ⚠ já estava abaixo do vinculado (abate trava em 0)' : '')
      )
    }

    console.log('\n--- Pedidos que vão ganhar stock_decremented=true ---')
    for (const o of alvo) {
      console.log(`  #${o.id} ${o.code} [${o.status}]${o.from_catalog ? ' (site)' : ''} · ${o.un_vinculadas} un.`)
    }

    // Trava de sanidade: o total abatido tem de ser exatamente o total vinculado
    // pelos pedidos alvo. Divergência = coluna trocada na query (ver o aviso dos
    // aliases acima) ou vínculo contado duas vezes.
    const totalAbate = envases.reduce((s, e) => s + e.abater, 0)
    const totalVinc  = alvo.reduce((s, o) => s + o.un_vinculadas, 0)
    console.log(`\nConfere: abate total ${totalAbate} vs. vinculado total ${totalVinc}` +
      (totalAbate === totalVinc ? ' ✓' : '  ⛔ DIVERGE — não aplique, investigue a query'))
    if (totalAbate !== totalVinc) return

    // ── Informativo: vínculo LEGADO 1:1 (`order_items.bottling_id`) ──
    // Esse é o caminho do PATCH .../items/:id/bottling (linkBottling), que grava
    // na coluna do item, não na junction. Também é gateado por stock_decremented,
    // então pode haver fantasma por aqui — mas o conserto é outro (a coluna pode
    // conviver com a junction e somar abate em dobro). Só lista, não toca.
    const legado = await knex('order_items as oi')
      .join('orders as o', 'o.id', 'oi.order_id')
      .join('bottlings as b', 'b.id', 'oi.bottling_id')
      .leftJoin('order_item_bottlings as oib', 'oib.order_item_id', 'oi.id')
      .where('o.stock_decremented', false)
      .whereIn('o.status', VIVOS)
      .whereNull('oib.id')
      .select('o.id as order_id', 'o.code', 'o.status', 'oi.id as item_id',
              'oi.quantity as item_qty', 'b.id as bottling_id', 'b.bottling_code',
              'b.quantity_available')
    if (legado.length) {
      console.log(`\n⚠ ${legado.length} item(ns) com vínculo LEGADO 1:1 e sem linha na junction — NÃO tratados aqui:`)
      for (const l of legado) {
        console.log(`    pedido ${l.code} [${l.status}] item #${l.item_id} (${l.item_qty} un.) → envase #${l.bottling_id} ${l.bottling_code || ''} · disponível ${l.quantity_available}`)
      }
    }

    if (!APPLY) {
      console.log('\nDRY-RUN. Para aplicar: APPLY=1 node scripts/fix_stock_decremented_pedidos_site_2026-11-18.js\n')
      return
    }

    // ── Backup antes de escrever ──
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const arquivo = path.resolve(__dirname, '..', '..', `backup_stock_decremented_${stamp}.json`)
    fs.writeFileSync(arquivo, JSON.stringify({
      gerado_em: new Date().toISOString(),
      pedidos: alvo,
      envases_antes: envases,
    }, null, 2))
    console.log(`\nBackup: ${arquivo}`)

    await knex.transaction(async trx => {
      for (const e of envases) {
        await trx.raw(
          'UPDATE bottlings SET quantity_available = GREATEST(0, quantity_available - ?) WHERE id = ?',
          [e.abater, e.bottling_id]
        )
      }
      await trx('orders').whereIn('id', ids).update({ stock_decremented: true })
    })

    console.log(`\nAplicado: ${envases.length} envase(s) abatido(s), ${ids.length} pedido(s) marcado(s).`)

    // ── Conferência ──
    const sobrou = await knex('bottlings as b')
      .join('order_item_bottlings as oib', 'oib.bottling_id', 'b.id')
      .join('order_items as oi', 'oi.id', 'oib.order_item_id')
      .join('orders as o', 'o.id', 'oi.order_id')
      .where('b.active', true).where('b.type', 'normal')
      .where('b.quantity_available', '>', 0)
      .whereIn('o.status', VIVOS)
      .groupBy('b.id')
      .select('b.id', 'b.bottling_code', 'b.product_name', 'b.quantity_available')
    console.log(`\nEnvases ainda em Estoque Acabado com vínculo vivo: ${sobrou.length}`)
    for (const s of sobrou) {
      console.log(`  #${s.id} ${s.bottling_code || ''} ${s.product_name} · ${s.quantity_available} un.`)
    }
    console.log('  (um resto aqui é envase com quantidade produzida MAIOR que a vendida — isso é correto)\n')
  } catch (e) {
    console.error('ERRO:', e.message)
    process.exitCode = 1
  } finally {
    await knex.destroy()
  }
})()
