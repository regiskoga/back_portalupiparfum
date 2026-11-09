const express = require('express')
const multer  = require('multer')
const router  = express.Router()
const ctrl    = require('../controllers/importController')
const { authenticate, authorize } = require('../middleware/auth')

// Upload em memória (não persistir arquivo em disco) — limite 10MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

router.use(authenticate)

// Importação escreve em customers, formulas, suppliers, products, batches,
// bottlings e orders de uma vez, por planilha — é a rota com o maior alcance de
// escrita do sistema, e não é equivalente a nenhuma tela isolada.
//
// Por isso NÃO usa o authorizeWrite() das outras rotas, que liberaria OPERADOR:
// aqui a política é mais restritiva, definida pelo dono do sistema em 06/11/2026.
// Antes da auditoria, qualquer sessão autenticada importava — inclusive
// VISUALIZADOR, que assim escrevia em tabelas que as telas comuns não lhe davam.
router.use(authorize('ADM', 'GERENTE'))

// Baixa o template .xlsx em branco
router.get('/template', ctrl.generateTemplate)

// Baixa a planilha JA PREENCHIDA com os dados atuais, no mesmo layout do
// template (com a coluna ID). E a ponta de ida do round-trip: baixa, edita no
// Excel, sobe o mesmo arquivo em /preview e /commit.
// Mesmo gate da importacao (ADM/GERENTE): o arquivo carrega a tabela de precos
// inteira, e quem pode baixar e quem pode subir de volta.
router.get('/export', ctrl.exportSheet)

// Preview (dry-run) — valida sem persistir
router.post('/preview', upload.single('file'), ctrl.preview)

// Commit — persiste em transação após validação
router.post('/commit', upload.single('file'), ctrl.commit)

module.exports = router
