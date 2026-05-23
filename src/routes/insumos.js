const router = require('express').Router()
const ctrl   = require('../controllers/insumosController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const TYPES = ['Essence','Base','Chemical','Packaging','Bottle','Label']
const UNITS = ['ml','g','unit','unidade']

const supplyRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('type').isIn(TYPES).withMessage(`Type must be: ${TYPES.join(', ')}`),
  body('supplier_id').isInt({ min: 1 }).withMessage('Invalid supplier'),
  body('unit').isIn(UNITS).withMessage(`Unit must be: ${UNITS.join(', ')}`),
  body('quantity_purchased').isFloat({ gt: 0 }).withMessage('Quantity must be greater than zero'),
  body('total_amount_paid').isFloat({ min: 0 }).withMessage('Total amount must be >= 0'),
]

router.get   ('/',          ctrl.list)
router.get   ('/stats',     ctrl.stats)
router.get   ('/:id', [param('id').isInt()], validate, ctrl.getOne)
router.post  ('/test', (req, res) => {
  console.log('🧪 ROTA DE TESTE EXECUTADA')
  res.json({ message: 'Teste OK', body: req.body })
})
router.post  ('/', supplyRules, validate, (req, res, next) => {
  console.log('🔍 POST /supplies - Middleware executado')
  next()
}, ctrl.create)
router.put   ('/:id', [param('id').isInt(), ...supplyRules], validate, ctrl.update)
router.patch ('/:id', [param('id').isInt()], validate, ctrl.update)
router.patch ('/:id/toggle-open', [param('id').isInt()], validate, ctrl.toggleOpen)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)

module.exports = router
