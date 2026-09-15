// ─── Apaga a carga de PEDIDOS ANTIGOS (is_legacy = true) ──────────────────────
//
// Por que existe: a primeira carga do histórico subiu com o preço unitário em
// branco (fórmula quebrada na planilha) e 702 dos 1.014 pedidos ficaram com valor
// zero. Não existe endpoint de DELETE de pedido no sistema — reimportar por cima
// só corrige quem mantém o mesmo "Código do Pedido", então limpar exige script.
//
// Segurança:
//   • NÃO toca em pedido do sistema: o filtro é `is_legacy = true`, e a carga
//     nunca sobrescreve pedido real (o import recusa código que já existe fora do
//     histórico).
//   • Dry-run por padrão. Só apaga com APPLY=1.
//   • Sempre grava backup JSON na raiz do repo ANTES de apagar — inclusive no
//     dry-run, para dar para conferir o que sairia.
//   • Clientes criados pela importação NÃO são apagados (podem já ter pedido de
//     verdade). O script só informa quantos são.
//
// FKs conferidas em produção: order_items → CASCADE; order_item_bottlings,
// order_gifts, partner_commissions e occurrences não têm nenhuma linha ligada a
// pedido legado (o import não cria vínculo de envase, brinde nem comissão).
//
// Uso:
//   node scripts/wipe_pedidos_legado.js            # dry-run + backup
//   APPLY=1 node scripts/wipe_pedidos_legado.js    # apaga de verdade
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const path = require('path')
const fs   = require('fs')
const knex = require('knex')(require('../knexfile').development)

const APPLY = process.env.APPLY === '1'
const RAIZ  = path.join(__dirname, '..', '..')

;(async () => {
  try {
    const pedidos = await knex('orders').where('is_legacy', true)
      .select('*').orderBy('id', 'asc')

    if (pedidos.length === 0) {
      console.log('Nenhum pedido legado encontrado — nada a fazer.')
      return
    }

    const ids   = pedidos.map(p => p.id)
    const itens = await knex('order_items').whereIn('order_id', ids)
      .select('*').orderBy('id', 'asc')

    // Nenhuma destas pode ter linha ligada a pedido legado; se tiver, é sinal de
    // que alguém usou um pedido do histórico como se fosse pedido vivo — aí o
    // script para em vez de apagar junto.
    // Toda tabela com FK para orders/order_items entra aqui, inclusive as de
    // CASCADE: justamente por serem CASCADE elas sumiriam CALADAS junto com o
    // pedido. Se qualquer uma tiver linha, o script aborta em vez de apagar.
    const bloqueios = []
    const itemIds = itens.map(i => i.id)
    for (const [tabela, coluna] of [
      ['order_gifts', 'order_id'],
      ['partner_commissions', 'order_id'],
      ['occurrences', 'order_id'],
      ['bottling_orders', 'order_id'],
      ['production_orders', 'order_id'],
      ['purchase_orders', 'order_id'],
      ['customer_gifts', 'order_id'],
      ['order_item_bottlings', 'order_item_id'],
    ]) {
      const alvo = coluna === 'order_item_id' ? itemIds : ids
      const [{ count }] = await knex(tabela).whereIn(coluna, alvo).count('* as count')
      if (Number(count) > 0) bloqueios.push(`${tabela}.${coluna}: ${count} linha(s)`)
    }

    const zerados = pedidos.filter(p =>
      itens.filter(i => i.order_id === p.id)
           .reduce((s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 0), 0) === 0)

    const [{ count: clientesImport }] = await knex('customers')
      .where('notes', 'Criado pela importação de pedidos antigos').count('* as count')

    console.log('─'.repeat(70))
    console.log(`Pedidos legados (is_legacy = true): ${pedidos.length}`)
    console.log(`  destes, com valor total zerado:   ${zerados.length}`)
    console.log(`Itens vinculados:                   ${itens.length}`)
    console.log(`Clientes criados pela importação:   ${clientesImport}  (NÃO serão apagados)`)
    // created_at vem como Date; formatar direto com String() daria "Tue Oct 07".
    const dia = d => new Date(d).toISOString().slice(0, 10)
    const datas = pedidos.map(p => p.created_at).filter(Boolean).map(d => new Date(d).getTime())
    console.log(`Período: ${dia(Math.min(...datas))} → ${dia(Math.max(...datas))}`)
    console.log('─'.repeat(70))

    const arquivo = path.join(RAIZ,
      `backup_pedidos_legado_${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(arquivo, JSON.stringify({
      gerado_em: new Date().toISOString(),
      criterio: 'orders.is_legacy = true',
      total_pedidos: pedidos.length,
      total_itens: itens.length,
      orders: pedidos,
      order_items: itens,
    }, null, 2))
    console.log(`Backup gravado: ${path.basename(arquivo)}`)

    if (bloqueios.length > 0) {
      console.log('\n⛔ ABORTADO — existe operação viva pendurada em pedido legado:')
      bloqueios.forEach(b => console.log(`   • ${b}`))
      console.log('   Resolva esses vínculos antes de apagar.')
      return
    }

    if (!APPLY) {
      console.log('\n[DRY-RUN] Nada foi apagado.')
      console.log('Para apagar de verdade: APPLY=1 node scripts/wipe_pedidos_legado.js')
      return
    }

    // order_items cai por CASCADE, mas apagar explicitamente deixa a contagem
    // visível no log e não depende do FK estar como esperado.
    const resultado = await knex.transaction(async trx => {
      const itensApagados   = await trx('order_items').whereIn('order_id', ids).del()
      const pedidosApagados = await trx('orders').whereIn('id', ids).del()
      return { itensApagados, pedidosApagados }
    })

    console.log(`\n✅ APAGADO: ${resultado.pedidosApagados} pedido(s) e ${resultado.itensApagados} item(ns).`)
    const [{ count: restou }] = await knex('orders').where('is_legacy', true).count('* as count')
    console.log(`Conferência: pedidos legados restantes = ${restou}`)
    console.log(`Backup para desfazer: ${path.basename(arquivo)}`)
  } catch (e) {
    console.error('ERRO:', e.message)
    process.exitCode = 1
  } finally {
    await knex.destroy()
  }
})()
