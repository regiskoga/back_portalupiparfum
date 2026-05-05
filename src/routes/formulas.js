const router = require('express').Router()
const ctrl = require('../controllers/formulasController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const formulaRules = [
  body('product_id').isInt({ min: 1 }).withMessage('Valid product_id is required'),
  body('name').trim().notEmpty().withMessage('Formula name is required'),
  body('description').optional().trim(),
  body('items').optional().isArray().withMessage('Items must be an array'),
  body('items.*.supply_id').if(body('items').exists()).isInt({ min: 1 }).withMessage('Valid supply_id is required'),
  body('items.*.percentage').if(body('items').exists()).isFloat({ gt: 0, max: 100 }).withMessage('Percentage must be between 0 and 100')
]

router.get('/', ctrl.list)
router.get('/:id', [param('id').isInt()], validate, ctrl.getOne)
router.get('/:id/items', [param('id').isInt()], validate, ctrl.getItems)
router.post('/', formulaRules, validate, ctrl.create)
router.put('/:id', [param('id').isInt(), ...formulaRules.slice(1)], validate, ctrl.update) // Remove product_id requirement for update
router.patch('/:id', [param('id').isInt(), ...formulaRules.slice(1)], validate, ctrl.update)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)
router.post('/:id/validate', [param('id').isInt()], validate, ctrl.validate)

module.exports = router