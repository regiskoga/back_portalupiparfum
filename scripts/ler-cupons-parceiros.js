/**
 * SOMENTE LEITURA. Lista cupons, parceiros e pedidos do site para avaliar a
 * atribuicao de comissao dos pedidos vindos da loja WordPress.
 *
 * Uso:  node scripts/ler-cupons-parceiros.js
 * Nao escreve nada — nenhum insert/update/migration.
 */
require('dotenv').config()

const knex = require('knex')({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: false,
  },
})

;(async () => {
  const cupons = await knex('coupons')
    .select('id', 'code', 'type', 'discount_value', 'active',
            'partner_id', 'commission_rate', 'current_uses', 'max_uses')
    .orderBy('id')
  console.log('\n=== CUPONS no sistema:', cupons.length, '===')
  console.table(cupons)

  const parceiros = await knex('partners')
    .select('id', 'name', 'default_commission_rate', 'active')
    .orderBy('id')
  console.log('\n=== PARCEIROS:', parceiros.length, '===')
  console.table(parceiros)

  const com = await knex('partner_commissions').count('* as n').first()
  console.log('\ncomissoes gravadas:', com.n)

  const site = await knex('orders').where('channel', 'Site').count('* as n').first()
  const woo  = await knex('orders').where('code', 'like', 'WOO-%').count('* as n').first()
  const wooComCupom = await knex('orders')
    .where('code', 'like', 'WOO-%').whereNotNull('coupon_id').count('* as n').first()
  console.log('pedidos channel=Site:', site.n, '| code WOO-%:', woo.n,
              '| WOO com coupon_id:', wooComCupom.n)

  // A query que o `storeOrder` usa para casar o codigo do cupom vindo da loja
  // (o Woo guarda em minusculas; aqui o cadastro e em maiusculas). Se ela
  // estourar, o endpoint devolve 500, o plugin reenvia com backoff e desiste —
  // e o pedido PAGO nao chega ao sistema. Por isso e conferida aqui.
  // O controller normaliza em JS ANTES de consultar (trim + toUpperCase), que é
  // o que o Woo entrega em minúsculas. O alvo aqui tem de chegar igual, senão o
  // teste compara 'milena' com UPPER(code)='MILENA' e acusa um bug que não
  // existe — foi o que aconteceu na primeira versão deste script.
  const alvo = ['milena', 'NAOEXISTE'].map(c => c.trim().toUpperCase())
  const formas = {
    'whereIn + raw (suspeita)': () => knex('coupons').whereIn(knex.raw('UPPER(TRIM(code))'), alvo),
    'whereRaw = ANY(?)':        () => knex('coupons').whereRaw('UPPER(TRIM(code)) = ANY(?)', [alvo]),
    'whereRaw = ANY(??)':       () => knex('coupons').whereRaw('UPPER(TRIM(code)) = ANY(?::text[])', [alvo]),
    'whereRaw IN placeholders': () => knex('coupons')
      .whereRaw(`UPPER(TRIM(code)) IN (${alvo.map(() => '?').join(',')})`, alvo),
    'whereIn simples (code)':   () => knex('coupons').whereIn('code', alvo.map(c => c.toUpperCase())),
  }
  console.log('\n--- lookup do codigo do cupom (esperado: so MILENA) ---')
  for (const [nome, fn] of Object.entries(formas)) {
    try {
      const r = await fn()
      const codes = r.map(c => c.code)
      const ok = r.length === 1 && codes[0] === 'MILENA'
      console.log(` ${ok ? 'OK  ' : 'RUIM'} ${nome.padEnd(26)} ->`, codes)
    } catch (e) {
      console.log(` ERRO ${nome.padEnd(26)} ->`, e.message.slice(0, 90))
    }
  }

  // Desconto Pix: se estiver ligado, editar um item de pedido do site dispara
  // `ajustaDescontoPix` e injeta um desconto que a loja nunca deu.
  const pix = await knex('parameters').where('key', 'pix_discount_pct').first().catch(() => null)
  console.log('pix_discount_pct:', pix ? pix.value : '(parametro nao encontrado)')

  await knex.destroy()
})().catch(e => { console.error('ERRO', e.message); process.exit(1) })
