const router = require('express').Router()
const ctrl = require('../controllers/batchesController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const BATCH_STATUSES = ['Em maceração', 'Pronto para envase', 'Finalizado']

const batchRules = [
  body('formula_id').isInt({ min: 1 }).withMessage('Valid formula_id is required'),
  body('batch_code').optional().trim(),
  body('production_date').isISO8601().withMessage('Valid production date is required'),
  body('quantity_ml').isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0'),
  body('notes').optional().trim(),
  body('start_maceration').optional().isBoolean()
]

const updateBatchRules = [
  body('status').optional().isIn(BATCH_STATUSES).withMessage(`Status must be: ${BATCH_STATUSES.join(', ')}`),
  body('notes').optional().trim()
]

router.get('/', ctrl.list)
router.get('/stats', ctrl.stats)
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

module.exports = router