const router = require('express').Router()
const ctrl = require('../controllers/reportsController')

// Relatórios de consulta (somente leitura). `start`/`end` em YYYY-MM-DD.
router.get('/top-products',   ctrl.topProducts)
router.get('/top-customers',  ctrl.topCustomers)
router.get('/stock-overview', ctrl.stockOverview)
// Balancete mensal: `month` em YYYY-MM. `include_legacy=false` tira os antigos.
router.get('/balancete',      ctrl.balancete)

module.exports = router
