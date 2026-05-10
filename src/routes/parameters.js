const router = require('express').Router()
const ctrl   = require('../controllers/parametersController')

router.get('/', ctrl.getAll)
router.put('/', ctrl.update)

module.exports = router
