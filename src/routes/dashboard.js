const router = require('express').Router()
const { authenticate } = require('../middleware/auth')
router.use(authenticate) // Fase 2 (30/10/2026): exige sessao valida - fecha API aberta (G4)
const ctrl = require('../controllers/dashboardController')

router.get('/overview', ctrl.getOverview)
router.get('/financial', ctrl.getFinancialDashboard)
router.get('/production', ctrl.getProductionDashboard)
router.get('/alerts', ctrl.getAlerts)
router.get('/notifications', ctrl.getNotifications)
router.get('/sales', ctrl.getSalesDashboard)

module.exports = router