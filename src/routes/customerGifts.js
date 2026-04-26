const router = require('express').Router()
const ctrl = require('../controllers/customerGiftsController')
const { body, param, query } = require('express-validator')
const { validate } = require('../middleware/validate')

// ═══════════════════════════════════════════════════════════════════════════════
// ROTAS DE BRINDES DE CLIENTES - PROMPT #3
// ═══════════════════════════════════════════════════════════════════════════════

const giftRules = [
  body('customer_id').isInt({ min: 1 }).withMessage('ID do cliente é obrigatório'),
  body('gift_name').trim().isLength({ min: 1 }).withMessage('Nome do brinde é obrigatório'),
  body('order_id').optional().isInt({ min: 1 }).withMessage('ID do pedido deve ser válido'),
  body('gift_type').optional().trim().isLength({ min: 1 }).withMessage('Tipo do brinde deve ser válido'),
  body('gift_description').optional().trim(),
  body('gift_value').optional().isFloat({ min: 0 }).withMessage('Valor do brinde deve ser >= 0'),
  body('operator').optional().trim().notEmpty().withMessage('Operador não pode estar vazio'),
  body('notes').optional().trim()
]

// ─── VERIFICAR BRINDE DUPLICADO ───────────────────────────────────────────────
router.get('/check-duplicate',
  [
    query('customer_id').isInt({ min: 1 }).withMessage('ID do cliente é obrigatório'),
    query('gift_name').trim().isLength({ min: 1 }).withMessage('Nome do brinde é obrigatório')
  ],
  validate,
  ctrl.checkDuplicateGift
)

// ─── REGISTRAR BRINDE ─────────────────────────────────────────────────────────
router.post('/', giftRules, validate, ctrl.recordGift)

// ─── ESTATÍSTICAS DE BRINDES ──────────────────────────────────────────────────
router.get('/stats', ctrl.getGiftStats)

// ─── LISTAR TODOS OS BRINDES ──────────────────────────────────────────────────
router.get('/', ctrl.listAllGifts)

// ─── BRINDES DE UM CLIENTE ESPECÍFICO ─────────────────────────────────────────
router.get('/customer/:customer_id',
  [param('customer_id').isInt({ min: 1 }).withMessage('ID do cliente deve ser válido')],
  validate,
  ctrl.getCustomerGifts
)

module.exports = router