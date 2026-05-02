const express = require('express')
const router = express.Router()
const controller = require('../controllers/authController')
const { authenticate } = require('../middleware/auth')

// Rotas públicas
router.post('/login', controller.login)

// Rotas protegidas
router.post('/logout', authenticate, controller.logout)
router.get('/verify', authenticate, controller.verifySession)
router.post('/change-password', authenticate, controller.changePassword)

module.exports = router
