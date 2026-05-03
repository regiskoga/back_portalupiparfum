const express = require('express')
const router = express.Router()
const controller = require('../controllers/authController')
const { authenticate } = require('../middleware/auth')
const db = require('../db/connection')

// Rotas públicas
router.post('/login', controller.login)

// Debug endpoint - verificar estrutura da tabela users
router.get('/debug/users-table', async (req, res) => {
  try {
    const columns = await db('users').columnInfo()
    const sampleUser = await db('users').select('*').first()
    res.json({
      columns: Object.keys(columns),
      columnDetails: columns,
      sampleUserFields: sampleUser ? Object.keys(sampleUser) : []
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Rotas protegidas
router.post('/logout', authenticate, controller.logout)
router.get('/verify', authenticate, controller.verifySession)
router.post('/change-password', authenticate, controller.changePassword)

module.exports = router
