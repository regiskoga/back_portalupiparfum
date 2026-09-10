const router = require('express').Router()
const ctrl = require('../controllers/dashboardController')

router.get('/overview', ctrl.getOverview)
router.get('/financial', ctrl.getFinancialDashboard)
router.get('/production', ctrl.getProductionDashboard)
router.get('/alerts', ctrl.getAlerts)
router.get('/notifications', ctrl.getNotifications)
router.get('/sales', ctrl.getSalesDashboard)

module.exports = router