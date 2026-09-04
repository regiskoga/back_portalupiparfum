const router = require('express').Router()
const ctrl = require('../controllers/batchesController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')
const { authenticate } = require('../middleware/auth')

const BATCH_STATUSES = ['Em maceração', 'Pronto para envase', 'Finalizado']

const batchRules = [
  body('product_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Valid product_id is required'),
  body('formula_id').isInt({ min: 1 }).withMessage('Valid formula_id is required'),
  body('batch_code').optional().trim(),
  body('production_date').isISO8601().withMessage('Valid production date is required'),
  body('quantity_ml').optional({ nullable: true }).isFloat({ gt: 0 }),
  body('essences').optional().isArray(),
  body('essences.*.supply_id').optional().isInt({ min: 1 }),
  body('essences.*.quantity').optional().isFloat({ gt: 0 }),
  body('essences.*.unit').optional().trim(),
  body('notes').optional().trim(),
  body('start_maceration').optional().isBoolean()
]

const updateBatchRules = [
  body('status').optional().isIn(BATCH_STATUSES).withMessage(`Status must be: ${BATCH_STATUSES.join(', ')}`),
  body('notes').optional().trim()
]

router.get('/', ctrl.list)
router.get('/stats', ctrl.stats)
router.get('/next-code', ctrl.nextCode)
router.get('/stock-summary', ctrl.stockSummary)
router.get('/formula-info/:formula_id', [param('formula_id').isInt()], validate, ctrl.formulaInfo)
router.post('/merge', ctrl.mergeBatches)
router.post('/update-maceration-status', ctrl.updateMacerationStatus)
router.get('/:id', [param('id').isInt()], validate, ctrl.getOne)
router.get('/:id/can-bottle', [param('id').isInt()], validate, ctrl.canBeBottled)
router.post('/', batchRules, validate, ctrl.create)
router.put('/:id', [param('id').isInt(), ...updateBatchRules], validate, ctrl.update)
router.patch('/:id', [param('id').isInt(), ...updateBatchRules], validate, ctrl.update)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)
router.post('/:id/start-maceration', [param('id').isInt()], validate, ctrl.startMaceration)
router.patch('/:id/adjust-stock', authenticate, [
  param('id').isInt(),
  body('remaining_ml').isFloat({ min: 0 }).withMessage('remaining_ml deve ser >= 0'),
  body('reason').trim().notEmpty().withMessage('Informe o motivo do ajuste')
], validate, ctrl.adjustStock)

module.exports = router