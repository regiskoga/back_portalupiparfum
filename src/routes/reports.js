const router = require('express').Router()
const ctrl = require('../controllers/reportsController')

// Relatórios de consulta (somente leitura). `start`/`end` em YYYY-MM-DD.
router.get('/top-products',   ctrl.topProducts)
router.get('/top-customers',  ctrl.topCustomers)
router.get('/stock-overview', ctrl.stockOverview)

module.exports = router
