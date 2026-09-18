// ─── Apaga TODOS os dados de negócio (31 tabelas) ─────────────────────────────
//
// Por que existe: durante a fase de carga foi preciso zerar a base várias vezes
// para reimportar as planilhas do zero, preservando login, permissões e
// parâmetros. É o script mais destrutivo do repo — um TRUNCATE ... CASCADE em
// tudo que é dado de negócio.
//
// ⚠️ ATENÇÃO: `.env` deste backend aponta para o Postgres de PRODUÇÃO
// (187.77.227.96). Este script nasceu como `backend/_tmp_wipe.js`, sem guarda
// nenhuma: um `node _tmp_wipe.js` distraído apagava a base do cliente na hora,
// sem confirmação e sem backup. Daí as guardas abaixo.
//
// Segurança:
//   • Dry-run por padrão. Sem APPLY=1 o script só CONTA e mostra o alvo.
//   • Banco remoto exige confirmação digitada: WIPE_CONFIRM=<host> tem que bater
//     exatamente com o host de destino, e a recusa acontece ANTES de abrir
//     conexão. Em localhost/127.0.0.1 basta APPLY=1.
//   • Backup JSON das 31 tabelas na raiz do repo ANTES do TRUNCATE
//     (pule com SKIP_BACKUP=1 — só faz sentido em sandbox vazio).
//   • O TRUNCATE roda dentro de UMA transação: se o backup ou qualquer contagem
//     falhar, nada é apagado.
//
// Uso:
//   node scripts/wipe_dados.js                                     # dry-run: mostra alvo + contagens
//   APPLY=1 node scripts/wipe_dados.js                             # apaga (só se o host for local)
//   APPLY=1 WIPE_CONFIRM=187.77.227.96 node scripts/wipe_dados.js  # apaga em PRODUÇÃO
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })
const knex = require('knex')
const cfg = require('../knexfile')
const env = process.env.NODE_ENV || 'development'

const APPLY = process.env.APPLY === '1'
const CONFIRM = process.env.WIPE_CONFIRM || ''
const SKIP_BACKUP = process.env.SKIP_BACKUP === '1'
const RAIZ = path.join(__dirname, '..', '..')

// 31 conjuntos de DADOS a apagar. Preservados (login/config/schema) ficam de fora:
// users, sessions, user_profiles, profile_permissions, profile_screen_permissions,
// system_screens, parameters, system_rules, system_rules_history,
// system_rules_notifications, freight_types, knex_migrations, knex_migrations_lock
const WIPE = [
  'suppliers', 'supplies', 'products', 'formulas', 'formula_items',
  'batches', 'batch_essences', 'batch_formula_items', 'batch_movements', 'batch_transfers',
  'bottlings', 'bottling_batches', 'customers', 'orders', 'order_items',
  'order_gifts', 'order_item_bottlings', 'bottling_orders', 'production_orders', 'purchase_orders',
  'losses', 'donations', 'occurrences', 'customer_gifts', 'coupons',
  'kits', 'maceration_checkins', 'packaging_types', 'price_lists', 'volume_discounts',
  'activity_logs'
]

// A conexão pode vir como objeto (DB_HOST) ou como string (DATABASE_URL).
function alvo (conexao) {
  if (typeof conexao === 'string') {
    try {
      const u = new URL(conexao)
      return { host: u.hostname, database: u.pathname.replace(/^\//, '') }
    } catch { return { host: '(DATABASE_URL ilegivel)', database: '?' } }
  }
  return { host: conexao.host, database: conexao.database }
}

const LOCAIS = ['localhost', '127.0.0.1', '::1', '0.0.0.0']
const { host, database } = alvo(cfg[env].connection)
const local = LOCAIS.includes(host)

console.log('ALVO ' + (host || '(host indeterminado)') + '/' + database +
  (local ? '  (local)' : '  ⚠️ REMOTO'))

// ── Guarda 1: banco remoto exige o host digitado ──────────────────────────────
// Vem ANTES de abrir a conexão: alvo remoto sem confirmação não chega no banco.
// Host vazio (DATABASE_URL sem host) também cai aqui: sem saber o alvo, não apaga.
if (APPLY && !local && !host) {
  console.error('RECUSADO — não deu para identificar o host de destino.')
  console.error('Sem saber qual banco é, o script não apaga. Confira DB_HOST / DATABASE_URL.')
  process.exit(1)
}
if (APPLY && !local && CONFIRM !== host) {
  console.error('RECUSADO — o alvo é um banco REMOTO (' + host + '), provavelmente PRODUÇÃO.')
  console.error(CONFIRM
    ? 'WIPE_CONFIRM="' + CONFIRM + '" não bate com o host de destino.'
    : 'Falta WIPE_CONFIRM com o host exato.')
  console.error('Se é mesmo isso que você quer: APPLY=1 WIPE_CONFIRM=' + host + ' node scripts/wipe_dados.js')
  process.exit(1)
}

const db = knex(cfg[env])

async function counts () {
  const o = {}
  for (const t of WIPE) o[t] = Number((await db(t).count('* as n').first()).n)
  return o
}

;(async () => {
  try {
    const before = await counts()
    const totalBefore = Object.values(before).reduce((s, n) => s + n, 0)
    const comDados = Object.entries(before).filter(([, n]) => n > 0)
    console.log('LINHAS_HOJE ' + totalBefore + ' em ' + comDados.length + '/' + WIPE.length + ' tabelas')
    for (const [t, n] of comDados) console.log('  ' + t + ' ' + n)

    // ── Guarda 2: dry-run é o padrão ────────────────────────────────────────
    if (!APPLY) {
      console.log('')
      console.log('DRY_RUN — nada foi apagado.')
      console.log('Para apagar de verdade: APPLY=1' +
        (local ? '' : ' WIPE_CONFIRM=' + host) + ' node scripts/wipe_dados.js')
      return
    }

    // ── Guarda 3: backup antes de apagar ────────────────────────────────────
    if (!SKIP_BACKUP && totalBefore > 0) {
      const dump = {}
      for (const t of WIPE) dump[t] = await db(t).select('*')
      const arquivo = path.join(RAIZ,
        'backup_wipe_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json')
      fs.writeFileSync(arquivo, JSON.stringify(dump, null, 2), 'utf8')
      console.log('BACKUP ' + arquivo)
    }

    // ── TRUNCATE em transação: falhou no meio, não apaga nada ───────────────
    const list = WIPE.map(t => `"${t}"`).join(', ')
    await db.transaction(trx => trx.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`))

    const after = await counts()
    const stillNotEmpty = Object.entries(after).filter(([, n]) => n > 0)
    console.log('WIPE_OK')
    console.log('LINHAS_APAGADAS ' + totalBefore)
    console.log('TABELAS_ZERADAS ' + Object.values(after).filter(n => n === 0).length + '/' + WIPE.length)
    if (stillNotEmpty.length) console.log('AINDA_COM_DADOS ' + JSON.stringify(stillNotEmpty))
  } catch (e) {
    console.error('ERRO:', e.message); process.exitCode = 1
  } finally { await db.destroy() }
})()
