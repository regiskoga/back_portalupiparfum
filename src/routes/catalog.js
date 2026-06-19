const router = require('express').Router()
const ctrl = require('../controllers/catalogController')

// Rotas públicas — sem middleware de autenticação
router.get('/',       ctrl.list)
router.get('/brands', ctrl.brands)
router.post('/order', ctrl.createOrder)

module.exports = router
