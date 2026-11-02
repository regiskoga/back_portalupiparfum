const router = require('express').Router()
const ctrl = require('../controllers/catalogController')

const { requireSyncSecret } = require('../middleware/syncSecret')

// Rotas públicas — sem middleware de autenticação
router.get('/',       ctrl.list)
router.get('/brands', ctrl.brands)
router.post('/order', ctrl.createOrder)

// Sincronização com a loja WooCommerce — NÃO são públicas: exigem o header
// x-sync-secret. Falham FECHADAS (503) se CATALOG_SYNC_SECRET não estiver no
// ambiente, para um deploy sem a variável não virar vazamento silencioso.
router.get('/stock',          requireSyncSecret, ctrl.stock)
router.post('/validate-cart', requireSyncSecret, ctrl.validateCart)

// A volta do laco: pedido PAGO na loja entra aqui como pedido `Confirmed`.
// Mesmo segredo, mesma logica de falha fechada. Idempotente pelo id do pedido
// da loja (`orders.code = WOO-<id>`), porque gateway de pagamento repete.
router.post('/store-order',   requireSyncSecret, ctrl.storeOrder)

module.exports = router
