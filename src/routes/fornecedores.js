const router = require('express').Router()
const { authenticate } = require('../middleware/auth')
router.use(authenticate) // Fase 2 (30/10/2026): exige sessao valida - fecha API aberta (G4)
const ctrl   = require('../controllers/fornecedoresController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const supplierRules = [
  body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
]

router.get   ('/',              ctrl.list)
router.get   ('/:id',          [param('id').isInt()], validate, ctrl.getOne)
router.post  ('/',             supplierRules, validate, ctrl.create)
router.put   ('/:id',         [param('id').isInt(), ...supplierRules], validate, ctrl.update)
router.patch ('/:id/reativar', [param('id').isInt()], validate, ctrl.reativar)
router.patch ('/:id',         [param('id').isInt()], validate, ctrl.update)
router.delete('/:id',         [param('id').isInt()], validate, ctrl.remove)

module.exports = router
