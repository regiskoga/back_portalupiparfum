const router = require('express').Router()
const ctrl = require('../controllers/volumeDiscountsController')
const { param } = require('express-validator')
const { validate } = require('../middleware/validate')

router.get('/', ctrl.list)
router.get('/resolve', ctrl.resolve)
router.post('/', ctrl.create)
router.patch('/:id', [param('id').isInt()], validate, ctrl.update)
router.delete('/:id', [param('id').isInt()], validate, ctrl.remove)

module.exports = router
