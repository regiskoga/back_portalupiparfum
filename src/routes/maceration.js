const router = require('express').Router()
const { authenticate } = require('../middleware/auth')
router.use(authenticate) // Fase 2 (30/10/2026): exige sessao valida - fecha API aberta (G4)
const ctrl = require('../controllers/macerationController')
const { param, body } = require('express-validator')
const { validate } = require('../middleware/validate')

router.get('/', ctrl.list)
router.get('/:batch_id',
  [param('batch_id').isInt()],
  validate,
  ctrl.getOne
)
router.post('/:batch_id/checkin/:day',
  [param('batch_id').isInt(), param('day').isInt({ min: 1 }), body('notes').optional().trim(), body('operator').optional().trim()],
  validate,
  ctrl.checkin
)
router.delete('/:batch_id/checkin/:day',
  [param('batch_id').isInt(), param('day').isInt({ min: 1 })],
  validate,
  ctrl.uncheckin
)

module.exports = router
