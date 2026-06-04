const router = require('express').Router()
const ctrl = require('../controllers/macerationController')
const { param, body } = require('express-validator')
const { validate } = require('../middleware/validate')

router.get('/', ctrl.list)
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
