const router = require('express').Router()
const ctrl   = require('../controllers/parametersController')
const { authenticate, authorize } = require('../middleware/auth')

router.use(authenticate)
router.use(authorize('ADM'))

router.get('/', ctrl.getAll)
router.put('/', ctrl.update)

module.exports = router
