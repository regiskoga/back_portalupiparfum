const router = require('express').Router()
const { authenticate } = require('../middleware/auth')
router.use(authenticate) // Fase 2 (30/10/2026): exige sessao valida - fecha API aberta (G4)
const ctrl = require('../controllers/activityLogsController')
const { param, query } = require('express-validator')
const { validate } = require('../middleware/validate')

router.get('/', ctrl.listLogs)
router.get('/stats', ctrl.getActivityStats)
router.get('/by-date', ctrl.getLogsByDateRange)
router.get('/entity/:entityType/:entityId', 
  [
    param('entityType').trim().notEmpty(),
    param('entityId').isInt()
  ], 
  validate, 
  ctrl.getEntityLogs
)
router.get('/activity/:activityType', 
  [param('activityType').trim().notEmpty()], 
  validate, 
  ctrl.getActivityLogs
)
router.get('/trace/product/:bottlingId', 
  [param('bottlingId').isInt()], 
  validate, 
  ctrl.traceProductOrigin
)
router.get('/trace/supply/:supplyId', 
  [param('supplyId').isInt()], 
  validate, 
  ctrl.traceSupplyUsage
)

module.exports = router