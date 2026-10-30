const router = require('express').Router()
const { authenticate } = require('../middleware/auth')
router.use(authenticate) // Fase 2 (30/10/2026): exige sessao valida - fecha API aberta (G4)
const ctrl = require('../controllers/freightTypesController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const rules = [
  body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('active').optional().isBoolean(),
]

router.get('/', ctrl.list)
router.get('/:id', [param('id').isInt()], validate, ctrl.getOne)
router.post('/', rules, validate, ctrl.create)
router.put('/:id', [param('id').isInt(), ...rules], validate, ctrl.update)
router.patch('/:id', [param('id').isInt()], validate, ctrl.update)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)

module.exports = router
