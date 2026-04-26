/**
 * Donations Routes
 * Rotas para gerenciamento de doações
 */

const express = require('express')
const router = express.Router()
const donationsController = require('../controllers/donationsController')
const { body } = require('express-validator')
const { validate } = require('../middleware/validate')

/**
 * GET /api/donations
 * Lista todas as doações com paginação e filtros
 */
router.get('/', donationsController.list)

/**
 * GET /api/donations/stats
 * Estatísticas de doações
 */
router.get('/stats', donationsController.stats)

/**
 * GET /api/donations/customer/:customer_id
 * Busca doações de um cliente específico
 */
router.get('/customer/:customer_id', donationsController.getByCustomer)

/**
 * GET /api/donations/:id
 * Busca uma doação por ID
 */
router.get('/:id', donationsController.getById)

/**
 * POST /api/donations
 * Registra uma nova doação
 */
router.post(
  '/',
  [
    body('customer_id').optional().isInt().withMessage('customer_id must be an integer'),
    body('recipient_name').optional().isString(),
    body('product_id').isInt().withMessage('product_id must be an integer'),
    body('bottling_id').isInt().withMessage('bottling_id must be an integer'),
    body('quantity').isInt({ min: 1 }).withMessage('quantity must be at least 1'),
    body('donation_type')
      .optional()
      .isIn(['Gift', 'Sample', 'Promotion', 'Charity', 'Other'])
      .withMessage('Invalid donation_type'),
    body('reason').optional().isString(),
    body('operator').optional().isString(),
    body('donated_at').optional().isISO8601()
  ],
  validate,
  donationsController.create
)

/**
 * PATCH /api/donations/:id
 * Atualiza uma doação
 */
router.patch(
  '/:id',
  [
    body('reason').optional().isString(),
    body('operator').optional().isString(),
    body('recipient_name').optional().isString()
  ],
  validate,
  donationsController.update
)

/**
 * DELETE /api/donations/:id
 * Deleta uma doação (reversão)
 */
router.delete('/:id', donationsController.delete)

module.exports = router
