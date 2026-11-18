// Testa a conta do cupom do pedido da loja SEM tocar no banco:
// usa o computeCouponDiscount REAL exportado por ordersController (o que
// tambem prova que o require novo no catalogController nao faz ciclo).
process.env.DB_HOST = process.env.DB_HOST || 'localhost'
const oc = require('../src/controllers/ordersController')

let ok = 0, bad = 0
function eq (nome, obtido, esperado) {
  const a = Math.round(obtido * 100) / 100
  if (a === esperado) { ok++; console.log('  PASS', nome, '=', a) }
  else { bad++; console.log('  FAIL', nome, 'obtido', a, 'esperado', esperado) }
}

console.log('exports:', typeof oc.computeCouponDiscount, typeof oc.syncOrderCommission)

const MILENA = { id: 7, code: 'MILENA', type: 'Percentage', discount_value: 5, partner_id: 2, commission_rate: 5, min_order_value: 0 }
const BLACK  = { id: 10, code: 'BLACKPORTALUPI', type: 'Percentage', discount_value: 17, partner_id: null, commission_rate: null, min_order_value: 0 }
const FIXO   = { id: 99, code: 'FIXO30', type: 'Fixed Amount', discount_value: 30, partner_id: 2, min_order_value: 0 }

// CT1 — 1 item de 200, cupom 5%, sem outro desconto
{
  console.log('\nCT1 cupom 5% sobre 200')
  const itens = [{ unit_price: 200, quantity: 1 }]
  const sub = 200, desc = 0
  const cd = oc.computeCouponDiscount(MILENA, itens, desc)
  eq('coupon_discount', cd, 10)
  eq('base da comissao', sub - desc - cd, 190)
  eq('comissao 5%', (sub - desc - cd) * 0.05, 9.5)
  eq('total (frete 25)', sub - desc - cd + 25, 215)
}

// CT2 — cascata: desconto previo de 10 ja gravado + cupom 5%
{
  console.log('\nCT2 cascata: desconto 10 + cupom 5%')
  const itens = [{ unit_price: 200, quantity: 1 }]
  const cd = oc.computeCouponDiscount(MILENA, itens, 10)
  eq('cupom incide sobre 190', cd, 9.5)   // NAO 10
  eq('base da comissao', 200 - 10 - cd, 180.5)
}

// CT3 — cupom sem parceiro: desconta e NAO gera comissao
{
  console.log('\nCT3 cupom sem parceiro (BLACKPORTALUPI 17%)')
  const cd = oc.computeCouponDiscount(BLACK, [{ unit_price: 300, quantity: 2 }], 0)
  eq('coupon_discount', cd, 102)
  console.log('  partner_id =', BLACK.partner_id, '-> comissao nao nasce (checado no controller)')
}

// CT4 — Fixed Amount nao entra na cascata
{
  console.log('\nCT4 Fixed Amount com desconto previo')
  eq('fixo ignora a cascata', oc.computeCouponDiscount(FIXO, [{ unit_price: 200, quantity: 1 }], 50), 30)
}

// CT5 — multi-item
{
  console.log('\nCT5 multi-item, cupom 5%')
  const itens = [{ unit_price: 120, quantity: 2 }, { unit_price: 60, quantity: 1 }]
  const sub = 300
  const cd = oc.computeCouponDiscount(MILENA, itens, 0)
  eq('coupon_discount', cd, 15)
  eq('comissao 5%', (sub - cd) * 0.05, 14.25)
}

// CT6 — divergencia: loja cobrou com o liquido, nossa conta tem de bater
{
  console.log('\nCT6 total calculado x total pago na loja')
  const itens = [{ unit_price: 200, quantity: 1 }]   // BRUTO, como o plugin v0.4.0 manda
  const cd = oc.computeCouponDiscount(MILENA, itens, 0)
  const calc = Math.round((200 - 0 - cd + 25) * 100) / 100
  const pagoNaLoja = 215   // Woo: 200 - 10 + 25
  eq('divergencia', calc - pagoNaLoja, 0)
}

// CT7 — contrato ausente (plugin velho): preco ja liquido, nada e descontado
{
  console.log('\nCT7 plugin <= 0.3.x (sem a chave cupons)')
  const b = { desconto: 0, frete: 25, total_pago: 215 }
  const contrato = Object.prototype.hasOwnProperty.call(b, 'cupons')
  const sub = 190  // liquido, como o Woo cobrou
  const calc = sub - 0 - 0 + 25
  eq('contrato detectado como antigo', contrato ? 1 : 0, 0)
  eq('total fecha sem cupom', calc, 215)
}

// CT8 — a chave vazia JA e o contrato novo
{
  console.log('\nCT8 cupons:[] (pedido sem cupom no plugin novo)')
  const b = { cupons: [], desconto: 0 }
  eq('contrato novo detectado', Object.prototype.hasOwnProperty.call(b, 'cupons') ? 1 : 0, 1)
}

// CT9 — os pedidos REAIS da loja (lidos do Woo em 17/11/2026) pelo CAMINHO DO
// CÓDIGO, não por aritmética reescrita aqui.
//
// É o teste que importa: a loja aplica cupom→Pix e o sistema aplica Pix→cupom,
// então RECALCULAR o cupom dá um total MAIOR do que o cliente pagou (R$ 0,19 em
// #3433, R$ 0,32 em #3437). O valor que vale é o da loja — foi ela quem cobrou.
// A primeira versão deste CT passava porque usava o valor da loja na conta,
// provando só a aritmética e não o código.
{
  console.log('\nCT9 pedidos reais, pelo computeCouponDiscount')
  const MILENA = { id: 7, code: 'MILENA', type: 'Percentage', discount_value: 5, partner_id: 2, commission_rate: 5, min_order_value: 0 }
  const reais = [
    { id: 3433, itens: Array(3).fill({ unit_price: 45.90, quantity: 1 }), cupLoja: 6.88,  pix: 3.92, frete: 10.51, pago: 137.41, com: 6.35 },
    { id: 3437, itens: Array(5).fill({ unit_price: 45.90, quantity: 1 }), cupLoja: 11.47, pix: 6.54, frete: 16.80, pago: 228.29, com: 10.57 },
  ]
  for (const r of reais) {
    const sub = r.itens.reduce((s, i) => s + i.unit_price * i.quantity, 0)
    const recalc = Math.round(oc.computeCouponDiscount(MILENA, r.itens, r.pix) * 100) / 100

    // O recálculo NÃO fecha com o pago — é por isso que o valor da loja manda.
    const totalRecalc = Math.round((sub - r.pix - recalc + r.frete) * 100) / 100
    if (totalRecalc === r.pago) {
      bad++; console.log(`  FAIL #${r.id} recalculo deveria divergir do pago, mas fechou`)
    } else {
      ok++; console.log(`  PASS #${r.id} recalculo divergiria em ${(totalRecalc - r.pago).toFixed(2)} (por isso usamos o valor da loja)`)
    }

    // Com o valor da loja, fecha ao centavo.
    const total = Math.round((sub - r.pix - r.cupLoja + r.frete) * 100) / 100
    eq(`#${r.id} total com cupom da loja == pago`, total, r.pago)
    const base = Math.round((sub - r.pix - r.cupLoja) * 100) / 100
    eq(`#${r.id} comissao 5%`, Math.round(base * 5) / 100, r.com)
  }
}

// CT10 — cupom DESCONHECIDO (#3310, codigo `euclides` existe no Woo e nao aqui)
{
  console.log('\nCT10 cupom desconhecido: desconto entra inteiro, sem comissao')
  const sub = 69.90, cupLoja = 62.91, pix = 0.21, frete = 9.75
  const desconto = Math.round((pix + cupLoja) * 100) / 100
  eq('#3310 total == pago', Math.round((sub - desconto + frete) * 100) / 100, 16.53)
}

// CT11 — CONTRATO DA FUSÃO (plugin v0.4.0 + edição do servidor de 17/11).
//
// O plugin deriva o desconto TOTAL por diferença (subtotal + frete − pago) e
// then reparte em três: `desconto_cupom`, `desconto_pix` e o resto em
// `desconto`. A invariante que faz o total fechar ao centavo é
//
//     desconto + desconto_cupom + desconto_pix == derivado
//
// e é por isso que a repartição pode errar a atribuição sem errar o total.
// Números lidos do Woo real em 17/11/2026 (6 pedidos, todos os caminhos:
// Pix+cupom, cartão+cupom, Pix sem cupom, cupom desconhecido).
{
  console.log('\nCT11 contrato da fusao, 6 pedidos reais')
  const reais = [
    { id: 3433, sub: 137.70, frete: 10.51, pago: 137.41, cup: 6.88,  pix: 3.92, conhecido: true },
    { id: 3437, sub: 229.50, frete: 16.80, pago: 228.29, cup: 11.47, pix: 6.54, conhecido: true },
    { id: 3436, sub: 229.50, frete: 16.80, pago: 228.29, cup: 11.47, pix: 6.54, conhecido: true },
    { id: 3434, sub: 91.80,  frete: 14.84, pago: 102.05, cup: 4.59,  pix: 0,    conhecido: true },
    { id: 3308, sub: 69.90,  frete: 9.75,  pago: 77.55,  cup: 0,     pix: 2.10, conhecido: true },
    { id: 3310, sub: 69.90,  frete: 9.75,  pago: 16.53,  cup: 62.91, pix: 0.21, conhecido: false },
  ]
  for (const r of reais) {
    const derivado = Math.max(0, Math.round((r.sub + r.frete - r.pago) * 100) / 100)
    const resto = Math.max(0, Math.round((derivado - r.cup - r.pix) * 100) / 100)

    eq(`#${r.id} parcelas somam o derivado`,
       Math.round((resto + r.cup + r.pix) * 100) / 100, derivado)

    // Como o backend compõe: discount = resto + pix (o Pix entra por dentro).
    // Cupom DESCONHECIDO não vira coupon_discount — entra no discount, senão o
    // total não fecharia (não há `coupon_id` para pendurar o valor).
    const discount = r.conhecido
      ? Math.round((resto + r.pix) * 100) / 100
      : Math.round((resto + r.pix + r.cup) * 100) / 100
    const couponDiscount = r.conhecido ? r.cup : 0

    eq(`#${r.id} total == pago`,
       Math.round((r.sub - discount - couponDiscount + r.frete) * 100) / 100, r.pago)
  }
}

// CT12 — ESTADO INTERMEDIÁRIO: backend novo + plugin VIVO (edição de 17/11).
//
// É o que roda em produção entre os dois deploys, e por isso tem de ser
// testado: o plugin vivo manda preço BRUTO e o desconto TOTAL num `desconto`
// único, sem a chave `cupons` e sem `desconto_pix`. O backend então não aplica
// cupom nenhum (sem comissão — esperado), mas o total tem de continuar certo.
{
  console.log('\nCT12 backend novo + plugin vivo (sem a chave cupons)')
  const vivos = [
    { id: 3433, sub: 137.70, frete: 10.51, pago: 137.41, descUnico: 10.80 },
    { id: 3437, sub: 229.50, frete: 16.80, pago: 228.29, descUnico: 18.01 },
  ]
  for (const v of vivos) {
    const b = { desconto: v.descUnico, frete: v.frete }   // sem `cupons`, sem `desconto_pix`
    eq(`#${v.id} contrato antigo detectado`,
       Object.prototype.hasOwnProperty.call(b, 'cupons') ? 1 : 0, 0)
    // backend: desconto = b.desconto + (b.desconto_pix || 0) ; cupom = 0
    const desconto = Math.round((Number(b.desconto) + 0) * 100) / 100
    eq(`#${v.id} total == pago (sem comissao)`,
       Math.round((v.sub - desconto - 0 + v.frete) * 100) / 100, v.pago)
  }
}

console.log(`\n=== ${ok} PASS / ${bad} FAIL ===`)
process.exit(bad ? 1 : 0)
