const router = require('express').Router()
const ctrl = require('../controllers/productsController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const GENDERS = ['Masculino', 'Feminino', 'Unissex']

const productRules = [
  body('project_name').trim().notEmpty().withMessage('Project name is required'),
  body('gender').optional().isIn(GENDERS).withMessage(`Gender must be: ${GENDERS.join(', ')}`),
  body('inspiration_brand').optional().trim(),
  body('inspiration_name').optional().trim(),
  body('commercial_name').optional().trim(),
  body('narrative').optional().trim(),
  body('top_notes').optional().trim(),
  body('heart_notes').optional().trim(),
  body('base_notes').optional().trim(),
  body('notes').optional().trim()
]

router.get('/', ctrl.list)
router.get('/stats', ctrl.stats)
router.get('/:id', [param('id').isInt()], validate, ctrl.getOne)
router.post('/', productRules, validate, ctrl.create)
router.put('/:id', [param('id').isInt(), ...productRules], validate, ctrl.update)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)

module.exports = router