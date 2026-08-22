/**
 * Coupons Routes
 */

const express = require('express')
const router = express.Router()
const couponsController = require('../controllers/couponsController')
const { body } = require('express-validator')
const { validate } = require('../middleware/validate')

/**
 * GET /api/coupons
 * Lista todos os cupons
 */
router.get('/', couponsController.list)

/**
 * GET /api/coupons/stats
 * Estatísticas de uso de cupons
 */
router.get('/stats', couponsController.stats)

/**
 * GET /api/coupons/:code
 * Busca um cupom por código
 */
router.get('/:code', couponsController.getByCode)

/**
 * POST /api/coupons/validate
 * Valida um cupom
 */
router.post(
  '/validate',
  [
    body('code').notEmpty().withMessage('code is required'),
    body('order_value').optional().isFloat({ min: 0 }).withMessage('order_value must be a positive number')
  ],
  validate,
  couponsController.validate
)

/**
 * POST /api/coupons
 * Cria um novo cupom
 */
router.post(
  '/',
  [
    body('code').notEmpty().withMessage('code is required'),
    body('type')
      .isIn(['Percentage', 'Fixed Amount', 'Progressive', 'Buy X Get Y'])
      .withMessage('Invalid coupon type'),
    body('discount_value').isFloat({ min: 0 }).withMessage('discount_value must be a positive number'),
    body('min_items').optional({ nullable: true }).isInt({ min: 1 }),
    body('free_items').optional({ nullable: true }).isInt({ min: 1 }),
    body('min_order_value').optional({ nullable: true }).isFloat({ min: 0 }),
    body('max_uses').optional({ nullable: true }).isInt({ min: 1 }),
    body('description').optional().isString(),
    body('active').optional().isBoolean(),
    body('valid_from').optional({ nullable: true }).isISO8601(),
    body('valid_until').optional({ nullable: true }).isISO8601(),
    body('partner_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('commission_rate').optional({ nullable: true }).isFloat({ min: 0, max: 100 })
  ],
  validate,
  couponsController.create
)

/**
 * PATCH /api/coupons/:id
 * Atualiza um cupom
 */
router.patch(
  '/:id',
  [
    body('code').optional().notEmpty().withMessage('code cannot be empty'),
    body('type')
      .optional()
      .isIn(['Percentage', 'Fixed Amount', 'Progressive', 'Buy X Get Y'])
      .withMessage('Invalid coupon type'),
    body('discount_value').optional().isFloat({ min: 0 }),
    body('min_items').optional({ nullable: true }).isInt({ min: 1 }),
    body('free_items').optional({ nullable: true }).isInt({ min: 1 }),
    body('min_order_value').optional({ nullable: true }).isFloat({ min: 0 }),
    body('max_uses').optional({ nullable: true }).isInt({ min: 1 }),
    body('description').optional().isString(),
    body('active').optional().isBoolean(),
    body('valid_from').optional({ nullable: true }).isISO8601(),
    body('valid_until').optional({ nullable: true }).isISO8601(),
    body('partner_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('commission_rate').optional({ nullable: true }).isFloat({ min: 0, max: 100 })
  ],
  validate,
  couponsController.update
)

/**
 * DELETE /api/coupons/:id
 * Deleta um cupom
 */
router.delete('/:id', couponsController.delete)

module.exports = router
