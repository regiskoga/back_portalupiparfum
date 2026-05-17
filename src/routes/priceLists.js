const router = require('express').Router()
const ctrl   = require('../controllers/priceListsController')
const { body, param } = require('express-validator')
const { validate }    = require('../middleware/validate')

const createRules = [
  body('product_id').isInt({ min: 1 }).withMessage('Projeto inválido'),
  body('packaging_type_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('volume_ml').optional({ nullable: true }).isFloat({ gt: 0 }).withMessage('Volume deve ser maior que zero'),
  body('price').isFloat({ min: 0 }).withMessage('Preço inválido'),
  body('valid_from').isISO8601().withMessage('Data de início inválida'),
  body('valid_to').optional({ nullable: true }).isISO8601().withMessage('Data de fim inválida'),
  body('notes').optional().trim()
]

const updateRules = [
  body('packaging_type_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('volume_ml').optional().isFloat({ gt: 0 }),
  body('price').optional().isFloat({ min: 0 }),
  body('valid_from').optional().isISO8601(),
  body('valid_to').optional({ nullable: true }).isISO8601(),
  body('notes').optional().trim()
]

router.get('/',    ctrl.list)
router.post('/',   createRules, validate, ctrl.create)
router.patch('/:id', [param('id').isInt(), ...updateRules], validate, ctrl.update)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)

module.exports = router
