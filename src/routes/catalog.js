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

module.exports = router
