const express = require('express')
const router = express.Router()
const controller = require('../controllers/migrationController')

// ─── Migrations ───────────────────────────────────────────────────────────────
router.post('/run', controller.runMigrations)
router.get('/status', controller.getMigrationStatus)

// ─── Seeds ────────────────────────────────────────────────────────────────────
router.post('/seeds', controller.runSeeds)

// ─── Setup Completo ───────────────────────────────────────────────────────────
router.post('/setup', controller.setupDatabase)

// ─── Deploy em Produção ───────────────────────────────────────────────────────
router.post('/deploy', controller.deployMigrations)

// ─── Teste de Conexão ─────────────────────────────────────────────────────────
router.get('/test', controller.testConnection)

module.exports = router