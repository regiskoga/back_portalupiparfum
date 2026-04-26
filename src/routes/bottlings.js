const router = require('express').Router()
const ctrl = require('../controllers/bottlingsController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const bottlingRules = [
  body('bottling_code').trim().notEmpty().withMessage('Bottling code is required'),
  body('bottling_date').isISO8601().withMessage('Valid bottling date is required'),
  body('product_name').trim().notEmpty().withMessage('Product name is required'),
  body('product_ref').optional().trim(),
  body('volume_ml').isFloat({ gt: 0 }).withMessage('Volume must be greater than 0'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('bottle_supply_id').optional().isInt({ min: 1 }).withMessage('Valid bottle supply ID required'),
  body('label_supply_id').optional().isInt({ min: 1 }).withMessage('Valid label supply ID required'),
  body('batches').isArray({ min: 1 }).withMessage('At least one batch is required'),
  body('batches.*.batch_id').isInt({ min: 1 }).withMessage('Valid batch ID required'),
  body('batches.*.ml_used').isFloat({ gt: 0 }).withMessage('ML used must be greater than 0'),
  body('notes').optional().trim()
]

const updateBottlingRules = [
  body('product_name').optional().trim().notEmpty(),
  body('product_ref').optional().trim(),
  body('notes').optional().trim()
]

router.get('/', ctrl.list)
router.get('/stats', ctrl.stats)
router.get('/available-batches', ctrl.getAvailableBatches)
router.get('/in-maceration', ctrl.getBatchesInMaceration)
router.get('/:id', [param('id').isInt()], validate, ctrl.getOne)
router.post('/', bottlingRules, validate, ctrl.create)
router.put('/:id', [param('id').isInt(), ...updateBottlingRules], validate, ctrl.update)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)

module.exports = router