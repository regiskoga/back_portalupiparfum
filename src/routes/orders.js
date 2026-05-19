/**
 * Orders Routes
 * Rotas para gerenciamento de pedidos com motor de decisão
 */

const express = require('express')
const router = express.Router()
const ordersController = require('../controllers/ordersController')
const { body } = require('express-validator')
const { validate } = require('../middleware/validate')

/**
 * GET /api/orders
 * Lista todos os pedidos com paginação e filtros
 */
router.get('/', ordersController.list)

/**
 * GET /api/orders/:id
 * Busca um pedido por ID com itens
 */
router.get('/:id', ordersController.getById)

/**
 * POST /api/orders/check-gifts
 * Verifica brindes duplicados antes de criar pedido (PROMPT #3)
 */
router.post('/check-gifts', 
  [
    body('customer_id').isInt({ min: 1 }).withMessage('ID do cliente é obrigatório'),
    body('gifts').isArray({ min: 1 }).withMessage('Lista de brindes é obrigatória'),
    body('gifts.*').trim().isLength({ min: 1 }).withMessage('Nome do brinde não pode estar vazio')
  ],
  validate,
  ordersController.checkGifts
)

/**
 * POST /api/orders
 * Cria um novo pedido com motor de decisão automática
 */
router.post(
  '/',
  [
    body('customer_id').isInt().withMessage('customer_id must be an integer'),
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
    body('items.*.product_id').isInt().withMessage('product_id must be an integer'),
    body('items.*.volume_ml').isFloat({ min: 0 }).withMessage('volume_ml must be a positive number'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('quantity must be at least 1'),
    body('items.*.unit_price').isFloat({ min: 0 }).withMessage('unit_price must be a positive number'),
    body('discount').optional().isFloat({ min: 0 }).withMessage('discount must be a positive number'),
    body('shipping').optional().isFloat({ min: 0 }).withMessage('shipping must be a positive number'),
    body('channel').optional().isString(),
    body('notes').optional().isString(),
    body('coupon_code').optional().isString()
  ],
  validate,
  ordersController.create
)

/**
 * PATCH /api/orders/:id/status
 * Atualiza status do pedido
 */
router.patch(
  '/:id/status',
  [
    body('status')
      .isIn(['Pending', 'Confirmed', 'In Production', 'Ready', 'Shipped', 'Delivered', 'Cancelled'])
      .withMessage('Invalid status')
  ],
  validate,
  ordersController.updateStatus
)

/**
 * GET /api/orders/:id/automatic-orders
 * Busca ordens automáticas geradas para o pedido
 */
router.get('/:id/automatic-orders', ordersController.getAutomaticOrders)

/**
 * POST /api/orders/apply-kit
 * Aplica kit a um pedido
 */
router.post(
  '/apply-kit',
  [
    body('order_id').isInt().withMessage('order_id must be an integer'),
    body('kit_id').isInt().withMessage('kit_id must be an integer')
  ],
  validate,
  ordersController.applyKit
)

module.exports = router
