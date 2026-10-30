const router = require('express').Router()
const { authenticate } = require('../middleware/auth')
router.use(authenticate) // Fase 2 (30/10/2026): exige sessao valida - fecha API aberta (G4)
const ctrl = require('../controllers/volumeDiscountsController')
const { param } = require('express-validator')
const { validate } = require('../middleware/validate')

router.get('/', ctrl.list)
router.get('/resolve', ctrl.resolve)
router.post('/', ctrl.create)
router.patch('/:id', [param('id').isInt()], validate, ctrl.update)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)

module.exports = router
