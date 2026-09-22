const router = require('express').Router()
const ctrl = require('../controllers/monthlyExpensesController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

// ⚠️ Cada rota monta as regras do ZERO. Reaproveitar um array e mapear
// `.optional()` sobre ele MUTA as regras da outra rota (express-validator
// guarda estado na cadeia) — já quebrou o cadastro de cliente uma vez.
const regrasCriar = [
  body('expense_date').notEmpty().withMessage('Data é obrigatória').isISO8601(),
  body('description').trim().notEmpty().withMessage('Descrição é obrigatória'),
  body('amount').isFloat({ min: 0 }).withMessage('Valor deve ser um número não negativo'),
  body('category').optional().isString(),
  body('notes').optional().isString(),
]

const regrasEditar = [
  body('expense_date').optional().isISO8601(),
  body('description').optional().trim().notEmpty().withMessage('Descrição não pode ficar vazia'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Valor deve ser um número não negativo'),
  body('category').optional().isString(),
  body('notes').optional().isString(),
]

// `/categories` ANTES de `/:id`, senão "categories" é capturado como id.
router.get('/categories', ctrl.categories)
router.get('/', ctrl.list)
router.get('/:id', [param('id').isInt()], validate, ctrl.getOne)
router.post('/', regrasCriar, validate, ctrl.create)
router.put('/:id', [param('id').isInt(), ...regrasEditar], validate, ctrl.update)
router.patch('/:id', [param('id').isInt(), ...regrasEditar], validate, ctrl.update)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)

module.exports = router
