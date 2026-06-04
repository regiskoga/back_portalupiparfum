const router = require('express').Router({ mergeParams: true })
const ctrl = require('../controllers/orderGiftsController')
const { param, body } = require('express-validator')
const { validate } = require('../middleware/validate')

router.get('/',
  [param('order_id').isInt()],
  validate,
  ctrl.list
)

router.post('/',
  [
    param('order_id').isInt(),
    body('bottling_id').isInt({ min: 1 }),
    body('quantity').optional().isInt({ min: 1 }),
    body('notes').optional().trim()
  ],
  validate,
  ctrl.create
)

router.delete('/:gift_id',
  [param('order_id').isInt(), param('gift_id').isInt()],
  validate,
  ctrl.remove
)

module.exports = router
