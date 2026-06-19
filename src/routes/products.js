const router = require('express').Router()
const ctrl = require('../controllers/productsController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const GENDERS = ['Masculino', 'Feminino', 'Unissex']
const DAY_NIGHT = ['Dia', 'Noite', 'Ambos']

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
  body('notes').optional().trim(),
  body('main_accords').optional().trim(),
  body('perfumer').optional().trim(),
  body('launch_year').optional().isInt({ min: 1900, max: 2100 }),
  body('day_night_profile').optional().isIn(DAY_NIGHT),
]

router.get('/', ctrl.list)
router.get('/:id/fragrance-lookup', [param('id').isInt()], validate, ctrl.fragranceLookup)
router.get('/stats', ctrl.stats)
router.get('/:id', [param('id').isInt()], validate, ctrl.getOne)
router.post('/', productRules, validate, ctrl.create)
router.put('/:id', [param('id').isInt(), ...productRules], validate, ctrl.update)
router.patch('/:id', [param('id').isInt()], validate, ctrl.update)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)

module.exports = router