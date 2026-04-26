const router = require('express').Router()
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