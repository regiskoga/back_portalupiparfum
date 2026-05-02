const express = require('express')
const router = express.Router()
const controller = require('../controllers/usersController')
const { authenticate, authorize } = require('../middleware/auth')

// Todas as rotas requerem autenticação e perfil ADM
router.use(authenticate)
router.use(authorize('ADM'))

// CRUD de usuários
router.get('/', controller.list)
router.get('/:id', controller.getById)
router.post('/', controller.create)
router.put('/:id', controller.update)
router.delete('/:id', controller.delete)

// Resetar senha
router.post('/:id/reset-password', controller.resetPassword)

module.exports = router
