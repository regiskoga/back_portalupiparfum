const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
// Fase 2 (30/10/2026): exige sessao valida. O front injeta o token via
// services/http.js (a tela user-permissions.js nao setava Authorization por conta propria).
router.use(authenticate)
const controller = require('../controllers/userPermissionsController')

// ─── Perfis ───────────────────────────────────────────────────────────────────
router.get('/profiles', controller.getProfiles)

// ─── Telas ────────────────────────────────────────────────────────────────────
router.get('/screens', controller.getScreens)

// ─── Permissões ───────────────────────────────────────────────────────────────
router.get('/profiles/:profileId/permissions', controller.getProfilePermissions)
router.put('/profiles/:profileId/permissions', controller.updateProfilePermissions)
router.get('/profiles/:profileId/screens', controller.getScreensWithPermissions)

// ─── Verificação ──────────────────────────────────────────────────────────────
router.get('/check/:profileId/:screenKey/:action', controller.checkPermission)

module.exports = router