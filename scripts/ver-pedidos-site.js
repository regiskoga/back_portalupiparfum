/**
 * SOMENTE LEITURA. Mostra os pedidos vindos da loja (`orders.code = WOO-<id>`)
 * com itens, descontos e a comissao de parceiro — para conferir o que a loja
 * mandou contra o que o sistema registrou.
 *
 * Uso:  node scripts/ver-pedidos-site.js
 */
require('dotenv').config()

const knex = require('knex')({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false,
  },
})

;(async () => {
  const pedidos = await knex('orders')
    .leftJoin('customers', 'orders.customer_id', 'customers.id')
    .leftJoin('coupons', 'orders.coupon_id', 'coupons.id')
    .where('orders.code', 'like', 'WOO-%')
    .select(
      'orders.id', 'orders.code', 'orders.status', 'orders.discount',
      'orders.coupon_id', 'orders.coupon_discount', 'orders.pix_discount',
      'orders.shipping', 'orders.amount_paid', 'orders.payment_method',
      'orders.payment_date', 'orders.created_at',
      'customers.name as cliente', 'coupons.code as cupom',
    )
    .orderBy('orders.id')

  for (const p of pedidos) {
    const itens = await knex('order_items').where({ order_id: p.id })
      .select('product_name', 'volume_ml', 'quantity', 'unit_price', 'item_discount')
    const sub = itens.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0)
    const total = sub - Number(p.discount || 0) - Number(p.coupon_discount || 0) + Number(p.shipping || 0)
    const com = await knex('partner_commissions')
      .leftJoin('partners', 'partner_commissions.partner_id', 'partners.id')
      .where('order_id', p.id)
      .select('partner_commissions.*', 'partners.name as parceiro').first()

    console.log(`\n── ${p.code}  (order_id ${p.id})  ${p.status}  ${String(p.created_at).slice(0, 10)}`)
    console.log(`   cliente: ${p.cliente} | pagamento: ${p.payment_method} | pago em: ${p.payment_date}`)
    console.log(`   subtotal ${sub.toFixed(2)} − desconto ${Number(p.discount || 0).toFixed(2)}`
      + ` − cupom ${Number(p.coupon_discount || 0).toFixed(2)} + frete ${Number(p.shipping || 0).toFixed(2)}`
      + ` = ${total.toFixed(2)}   (amount_paid ${p.amount_paid})`)
    console.log(`   cupom: ${p.cupom || '—'} (coupon_id ${p.coupon_id}) | pix_discount ${p.pix_discount}`)
    console.log(`   comissao: ${com ? `${com.parceiro} R$ ${com.amount} (${com.rate}% de ${com.base_amount}) ${com.status} comp.${com.competence}` : 'NENHUMA'}`)
    for (const i of itens) {
      console.log(`     · ${i.product_name} ${i.volume_ml}ml ×${i.quantity} a ${i.unit_price}`)
    }
  }

  console.log(`\n${pedidos.length} pedido(s) da loja.`)
  await knex.destroy()
})().catch(e => { console.error('ERRO', e.message); process.exit(1) })
