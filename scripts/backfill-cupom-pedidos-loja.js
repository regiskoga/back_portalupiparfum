/**
 * BACKFILL — cupom e comissão de parceiro nos pedidos que a loja já mandou
 * ANTES do contrato de cupom existir (plugin <= 0.3.x).
 *
 * Esses pedidos entraram com `preco_unitario` LÍQUIDO (já com o cupom abatido),
 * `discount = 0` e sem `coupon_id` — então nenhuma comissão nasceu e o parceiro
 * ficou sem receber. Este script reescreve cada um no formato que o contrato
 * novo produz, para que editar um item depois não desconte duas vezes:
 *
 *   unit_price      → BRUTO (como a loja cobra antes do cupom)
 *   coupon_id       → o cupom da loja, casado por código
 *   coupon_discount → o que a loja abateu de cupom
 *   discount        → o desconto Pix da LOJA (fee negativa "Desconto no Pix")
 *   pix_discount    → o mesmo valor, para o resumo discriminar a linha E para
 *                     `ajustaDescontoPix` saber o que já está aplicado
 *
 * O total continua sendo exatamente o que o cliente pagou: o script só
 * COMMITA se `Σ(preço×qtd) − discount − cupom + frete == amount_paid`.
 *
 * ⚠️ A ordem da cascata difere da loja: lá o cupom vem antes do Pix, aqui o Pix
 * vem antes do cupom (decisão de 14/11/2026). Os dois chegam ao mesmo lugar a
 * menos de centavos, e este script grava os valores da LOJA, não os recalcula —
 * é o que foi cobrado. Uma edição de item futura passa a usar a conta do
 * sistema, e a diferença é de centavos.
 *
 * Uso:
 *   node scripts/backfill-cupom-pedidos-loja.js            (simula, nada grava)
 *   node scripts/backfill-cupom-pedidos-loja.js --aplicar  (grava)
 *
 * Idempotente: pedido que já tem `coupon_id` é pulado.
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')

// A conexão do PRÓPRIO sistema, não uma segunda: `ordersController` já carrega
// `models/db`, e abrir outro pool ao lado fazia o script pendurar sem imprimir
// nada. Usando a mesma, o `syncOrderCommission` recebe a transação certa.
const { db: knex } = require('../src/models/db')
const { syncOrderCommission } = require('../src/controllers/ordersController')

const APLICAR = process.argv.includes('--aplicar')

/**
 * Lido da loja em 17/11/2026 via Novamira (`wc_get_order`), não adivinhado:
 *
 *   #3433  cupom milena · subtotal 137.70 · cupom 6.88  · frete 10.51 · fee Pix -3.92 · total 137.41
 *   #3437  cupom milena · subtotal 229.50 · cupom 11.47 · frete 16.80 · fee Pix -6.54 · total 228.29
 *
 * `preco_bruto_unitario` é o `subtotal` da linha do Woo (todas as linhas dos
 * dois pedidos são 15 ml a 45,90). A conferência de subtotal abaixo é o que
 * impede isso de passar errado se algum item tiver outro preço.
 */
const PEDIDOS = [
  {
    code: 'WOO-3433',
    cupom: 'milena',
    subtotal_bruto: 137.70,
    preco_bruto_unitario: 45.90,
    desconto_cupom: 6.88,
    desconto_pix: 3.92,
    frete: 10.51,
    total_pago: 137.41,
  },
  {
    code: 'WOO-3437',
    cupom: 'milena',
    subtotal_bruto: 229.50,
    preco_bruto_unitario: 45.90,
    desconto_cupom: 11.47,
    desconto_pix: 6.54,
    frete: 16.80,
    total_pago: 228.29,
  },
]

const c2 = (v) => Math.round(Number(v) * 100) / 100

;(async () => {
  console.log(APLICAR ? '=== APLICANDO ===' : '=== SIMULACAO (use --aplicar para gravar) ===')

  const backup = []
  const planos = []

  for (const alvo of PEDIDOS) {
    const order = await knex('orders').where({ code: alvo.code }).first()
    if (!order) { console.log(`\n${alvo.code}: NAO ENCONTRADO — pulado`); continue }
    if (order.coupon_id) {
      console.log(`\n${alvo.code}: ja tem coupon_id ${order.coupon_id} — pulado (idempotente)`)
      continue
    }

    const cupom = await knex('coupons')
      .whereIn(knex.raw('UPPER(TRIM(code))'), [alvo.cupom.trim().toUpperCase()]).first()
    if (!cupom) { console.log(`\n${alvo.code}: cupom "${alvo.cupom}" nao cadastrado — pulado`); continue }

    const itens = await knex('order_items').where({ order_id: order.id })
    const subtotalAtual = itens.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0)
    const qtdTotal = itens.reduce((s, i) => s + Number(i.quantity), 0)
    const subtotalNovo = c2(alvo.preco_bruto_unitario * qtdTotal)

    // GUARDA: o preço bruto declarado tem de reconstruir o subtotal da loja.
    // Sem isto, um item com preço diferente passaria escalado errado.
    if (subtotalNovo !== c2(alvo.subtotal_bruto)) {
      console.log(`\n${alvo.code}: ABORTA — ${qtdTotal} un a ${alvo.preco_bruto_unitario}`
        + ` = ${subtotalNovo}, mas a loja diz subtotal ${alvo.subtotal_bruto}.`
        + ' Itens com preços diferentes: declare linha por linha.')
      continue
    }

    const desconto = c2(alvo.desconto_pix)
    const cupomDesc = c2(alvo.desconto_cupom)
    const total = c2(subtotalNovo - desconto - cupomDesc + c2(alvo.frete))
    if (total !== c2(alvo.total_pago)) {
      console.log(`\n${alvo.code}: ABORTA — total ${total} != pago na loja ${alvo.total_pago}`)
      continue
    }

    const base = c2(subtotalNovo - desconto - cupomDesc)
    const rate = cupom.commission_rate != null ? Number(cupom.commission_rate) : null
    const parceiro = cupom.partner_id
      ? await knex('partners').where({ id: cupom.partner_id }).first() : null
    const rateEfetiva = rate != null ? rate : Number(parceiro?.default_commission_rate || 0)
    const comissao = Math.round(base * rateEfetiva) / 100

    console.log(`\n${alvo.code} (order_id ${order.id}, ${order.status})`)
    console.log(`  itens: ${qtdTotal} un · unit_price ${itens[0] && itens[0].unit_price} -> ${alvo.preco_bruto_unitario}`)
    console.log(`  subtotal ${c2(subtotalAtual)} -> ${subtotalNovo}`)
    console.log(`  discount 0 -> ${desconto} (Pix da loja) · coupon_discount 0 -> ${cupomDesc} (${cupom.code})`)
    console.log(`  total ${total} == pago ${alvo.total_pago} OK`)
    console.log(`  comissao: ${parceiro ? parceiro.name : 'SEM PARCEIRO'} `
      + `${rateEfetiva}% de ${base} = R$ ${comissao.toFixed(2)}`)

    backup.push({
      code: alvo.code,
      order: {
        id: order.id, discount: order.discount, pix_discount: order.pix_discount,
        coupon_id: order.coupon_id, coupon_discount: order.coupon_discount, notes: order.notes,
      },
      itens: itens.map(i => ({ id: i.id, unit_price: i.unit_price })),
      coupon: { id: cupom.id, current_uses: cupom.current_uses },
    })
    planos.push({ order, cupom, alvo, itens, subtotalNovo, desconto, cupomDesc })
  }

  if (!planos.length) { console.log('\nNada a fazer.'); await knex.destroy(); return }

  if (!APLICAR) {
    console.log(`\n${planos.length} pedido(s) seriam corrigidos. Nada foi gravado.`)
    await knex.destroy(); return
  }

  const arq = path.join(__dirname, '..', '..',
    `backup_cupom_pedidos_loja_${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(arq, JSON.stringify(backup, null, 2))
  console.log(`\nbackup: ${arq}`)

  for (const p of planos) {
    await knex.transaction(async trx => {
      await trx('order_items').where({ order_id: p.order.id })
        .update({ unit_price: p.alvo.preco_bruto_unitario })

      const nota = [p.order.notes, `Cupom ${p.cupom.code} da loja lancado em ${new Date().toISOString().slice(0, 10)}`
        + ` (backfill): preco por item passou a bruto, cupom R$ ${p.cupomDesc.toFixed(2)}`
        + ` e desconto Pix da loja R$ ${p.desconto.toFixed(2)} separados. Total inalterado.`]
        .filter(Boolean).join(' ')

      const [atualizado] = await trx('orders').where({ id: p.order.id }).update({
        coupon_id: p.cupom.id,
        coupon_discount: p.cupomDesc,
        discount: p.desconto,
        pix_discount: p.desconto,
        notes: nota,
        updated_at: trx.fn.now(),
      }).returning('*')

      await trx('coupons').where({ id: p.cupom.id }).increment('current_uses', 1)
      // Mesmo helper do pedido da tela: a comissão nasce igual, inclusive a
      // competência e o UNIQUE(order_id) que impede creditar duas vezes.
      await syncOrderCommission(atualizado, p.cupom, p.subtotalNovo, p.cupomDesc, trx)
    })
    console.log(`  ${p.alvo.code} aplicado.`)
  }

  await knex.destroy()
})().catch(e => { console.error('ERRO', e.message); process.exit(1) })
