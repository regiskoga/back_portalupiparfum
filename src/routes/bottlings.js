const router = require('express').Router()
const ctrl = require('../controllers/bottlingsController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')
const { authenticate } = require('../middleware/auth')

const bottlingRules = [
  body('bottling_code').optional().trim(),
  body('bottling_date').isISO8601().withMessage('Valid bottling date is required'),
  body('product_name').trim().notEmpty().withMessage('Product name is required'),
  body('product_ref').optional().trim(),
  body('volume_ml').isFloat({ gt: 0 }).withMessage('Volume must be greater than 0'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('bottle_supply_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Valid bottle supply ID required'),
  body('label_supply_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Valid label supply ID required'),
  body('batches').isArray({ min: 1 }).withMessage('At least one batch is required'),
  body('batches.*.batch_id').isInt({ min: 1 }).withMessage('Valid batch ID required'),
  body('batches.*.ml_used').isFloat({ gt: 0 }).withMessage('ML used must be greater than 0'),
  body('notes').optional().trim(),
  body('type').optional().isIn(['normal', 'brinde']).withMessage("type deve ser 'normal' ou 'brinde'")
]

const updateBottlingRules = [
  body('product_name').optional().trim().notEmpty(),
  body('product_ref').optional().trim(),
  body('notes').optional().trim()
]

router.get('/', ctrl.list)
router.get('/stats', ctrl.stats)
router.get('/stock-summary', ctrl.stockSummary)
router.get('/available-batches', ctrl.getAvailableBatches)
router.get('/in-maceration', ctrl.getBatchesInMaceration)
router.get('/gifts-available', ctrl.getAvailableGifts)
router.get('/ready-by-volume', ctrl.readyByVolume)
router.get('/:id/orders', [param('id').isInt()], validate, ctrl.getOrdersConsumingBottling)
// Vínculo lote↔envase (reconciliação histórica, sem abate) — Fase 2
router.get('/:id/candidate-batches', [param('id').isInt()], validate, ctrl.getCandidateBatches)
router.post('/:id/candidate-batches', authenticate, [param('id').isInt(), body('batch_id').isInt({ min: 1 })], validate, ctrl.linkBatch)
router.delete('/:id/candidate-batches/:batchId', authenticate, [param('id').isInt(), param('batchId').isInt()], validate, ctrl.unlinkBatch)
router.get('/:id', [param('id').isInt()], validate, ctrl.getOne)
// Rotas de ESCRITA — exigem autenticação
router.post('/', authenticate, bottlingRules, validate, ctrl.create)
router.patch('/:id', authenticate, [param('id').isInt(), ...updateBottlingRules], validate, ctrl.update)
router.delete('/:id', authenticate, [param('id').isInt()], validate, ctrl.remove)

module.exports = router