const router = require('express').Router()
const ctrl = require('../controllers/batchTransfersController')
const { body, param, query } = require('express-validator')
const { validate } = require('../middleware/validate')

const transferRules = [
  body('source_batch_id').isInt({ min: 1 }).withMessage('Valid source batch ID required'),
  body('destination_batch_id').isInt({ min: 1 }).withMessage('Valid destination batch ID required'),
  body('quantity_ml').isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0'),
  body('reason').optional().trim(),
  body('notes').optional().trim(),
  body('operator').optional().trim().notEmpty()
]

router.get('/', ctrl.list)
router.get('/stats', ctrl.stats)
router.get('/batch/:batch_id', 
  [param('batch_id').isInt()], 
  validate, 
  ctrl.getByBatch
)
router.get('/:id', 
  [param('id').isInt()], 
  validate, 
  ctrl.getOne
)
router.post('/', transferRules, validate, ctrl.create)

module.exports = router
