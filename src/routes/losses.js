/**
 * Losses Routes
 * Rotas para gerenciamento de perdas
 */

const express = require('express')
const router = express.Router()
const lossesController = require('../controllers/lossesController')
const { body } = require('express-validator')
const { validate } = require('../middleware/validate')

/**
 * GET /api/losses
 * Lista todas as perdas com paginação e filtros
 */
router.get('/', lossesController.list)

/**
 * GET /api/losses/stats
 * Estatísticas de perdas
 */
router.get('/stats', lossesController.stats)

/**
 * GET /api/losses/:id
 * Busca uma perda por ID
 */
router.get('/:id', lossesController.getById)

/**
 * POST /api/losses
 * Registra uma nova perda
 */
router.post(
  '/',
  [
    body('loss_type')
      .isIn(['Leakage', 'Breakage', 'Theft', 'Evaporation', 'Expiration', 'Other'])
      .withMessage('Invalid loss_type'),
    body('item_type')
      .isIn(['Supply', 'Batch', 'Bottling'])
      .withMessage('Invalid item_type'),
    body('item_id').isInt().withMessage('item_id must be an integer'),
    body('quantity_lost').isFloat({ min: 0 }).withMessage('quantity_lost must be a positive number'),
    body('reason').notEmpty().withMessage('reason is required'),
    body('operator').optional().isString(),
    body('occurred_at').optional().isISO8601()
  ],
  validate,
  lossesController.create
)

/**
 * PATCH /api/losses/:id
 * Atualiza uma perda
 */
router.patch(
  '/:id',
  [
    body('reason').optional().notEmpty().withMessage('reason cannot be empty'),
    body('operator').optional().isString()
  ],
  validate,
  lossesController.update
)

/**
 * DELETE /api/losses/:id
 * Deleta uma perda (reversão)
 */
router.delete('/:id', lossesController.delete)

module.exports = router
