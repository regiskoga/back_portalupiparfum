const router = require('express').Router()
const ctrl   = require('../controllers/fornecedoresController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const supplierRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
]

router.get   ('/',    ctrl.list)
router.get   ('/:id', [param('id').isInt()], validate, ctrl.getOne)
router.post  ('/', supplierRules, validate, ctrl.create)
router.put   ('/:id', [param('id').isInt(), ...supplierRules], validate, ctrl.update)
router.patch ('/:id', [param('id').isInt()], validate, ctrl.update)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)

module.exports = router
