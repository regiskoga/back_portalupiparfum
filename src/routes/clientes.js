const router = require('express').Router()
const ctrl   = require('../controllers/clientesController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const customerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
]

const orderRules = [
  body('status').optional().isIn(['Pending','Confirmed','In Production','Shipped','Delivered','Cancelled'])
    .withMessage('Invalid status'),
  body('items').optional().isArray({ min: 1 }).withMessage('Items must be an array with at least 1 item'),
  body('items.*.product_name').optional().notEmpty().withMessage('Product name is required'),
  body('items.*.quantity').optional().isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0'),
  body('items.*.unit_price').optional().isFloat({ min: 0 }).withMessage('Invalid price'),
]

// ─── Customers ────────────────────────────────────────────────────────────────
router.get   ('/stats',  ctrl.stats)
router.get   ('/',       ctrl.list)
router.get   ('/:id',    [param('id').isInt()], validate, ctrl.getOne)
router.post  ('/',       customerRules, validate, ctrl.create)
router.patch ('/:id',    [param('id').isInt(), ...customerRules.map(r => r.optional())], validate, ctrl.update)
router.delete('/:id',    [param('id').isInt()], validate, ctrl.remove)

// ─── Orders (nested under customer) ───────────────────────────────────────────
router.get   ('/:id/orders',            [param('id').isInt()], validate, ctrl.listOrders)
router.post  ('/:id/orders',            [param('id').isInt(), ...orderRules], validate, ctrl.createOrder)
router.get   ('/:id/orders/:orderId',   [param('id').isInt(), param('orderId').isInt()], validate, ctrl.getOrder)
router.patch ('/:id/orders/:orderId',   [param('id').isInt(), param('orderId').isInt(), ...orderRules], validate, ctrl.updateOrder)
router.delete('/:id/orders/:orderId',   [param('id').isInt(), param('orderId').isInt()], validate, ctrl.deleteOrder)

module.exports = router
