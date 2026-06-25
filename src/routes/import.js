const express = require('express')
const multer  = require('multer')
const router  = express.Router()
const ctrl    = require('../controllers/importController')
const { authenticate } = require('../middleware/auth')

// Upload em memória (não persistir arquivo em disco) — limite 10MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

router.use(authenticate)

// Baixa o template .xlsx
router.get('/template', ctrl.generateTemplate)

// Preview (dry-run) — valida sem persistir
router.post('/preview', upload.single('file'), ctrl.preview)

// Commit — persiste em transação após validação
router.post('/commit', upload.single('file'), ctrl.commit)

module.exports = router
