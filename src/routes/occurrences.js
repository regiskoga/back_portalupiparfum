const router = require('express').Router()
const ctrl = require('../controllers/occurrencesController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const occurrenceRules = [
  body('order_id').isInt({ min: 1 }).withMessage('Valid order ID required'),
  body('type').isIn(['Missing Item', 'Wrong Item', 'Damaged Item', 'Quality Issue', 'Other'])
    .withMessage('Valid type required'),
  body('product_id').optional().isInt({ min: 1 }),
  body('product_name').optional().trim(),
  body('bottling_id').optional().isInt({ min: 1 }),
  body('quantity').optional().isInt({ min: 1 }),
  body('action').optional().isIn(['Resend', 'Credit', 'Partial Refund', 'Full Refund', 'Replacement', 'None']),
  body('credit_amount').optional().isFloat({ min: 0 }),
  body('credit_expiry').optional().isISO8601(),
  body('description').optional().trim(),
  body('notes').optional().trim(),
  body('operator').optional().trim().notEmpty()
]

const updateStatusRules = [
  body('status').isIn(['Open', 'In Progress', 'Resolved', 'Cancelled'])
    .withMessage('Valid status required'),
  body('notes').optional().trim()
]

router.get('/', ctrl.list)
router.get('/stats', ctrl.stats)
router.get('/order/:order_id', 
  [param('order_id').isInt()], 
  validate, 
  ctrl.getByOrder
)
router.get('/:id', 
  [param('id').isInt()], 
  validate, 
  ctrl.getOne
)
router.post('/', occurrenceRules, validate, ctrl.create)
router.patch('/:id', 
  [param('id').isInt()], 
  validate, 
  ctrl.update
)
router.patch('/:id/status', 
  [param('id').isInt(), ...updateStatusRules], 
  validate, 
  ctrl.updateStatus
)
router.post('/:id/use-credit', 
  [param('id').isInt()], 
  validate, 
  ctrl.useCredit
)

module.exports = router
