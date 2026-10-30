const express = require('express')
const router = express.Router()
const controller = require('../controllers/authController')
const { authenticate } = require('../middleware/auth')
const { loginRateLimit } = require('../middleware/rateLimit')

// Rotas públicas
// Rate-limit anti força-bruta: conta só falhas (401) por IP, zera no sucesso.
router.post('/login', loginRateLimit(), controller.login)

// Rotas protegidas
router.post('/logout', controller.logout)
router.get('/verify', authenticate, controller.verifySession)
router.post('/change-password', authenticate, controller.changePassword)

module.exports = router
