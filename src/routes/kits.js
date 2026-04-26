/**
 * Kits Routes
 */

const express = require('express')
const router = express.Router()
const kitsController = require('../controllers/kitsController')
const { body } = require('express-validator')
const { validate } = require('../middleware/validate')

/**
 * GET /api/kits
 * Lista todos os kits
 */
router.get('/', kitsController.list)

/**
 * GET /api/kits/:id
 * Busca um kit por ID
 */
router.get('/:id', kitsController.getById)

/**
 * POST /api/kits
 * Cria um novo kit
 */
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('name is required'),
    body('quantity').isInt({ min: 1 }).withMessage('quantity must be at least 1'),
    body('volume_ml').isFloat({ min: 0 }).withMessage('volume_ml must be a positive number'),
    body('discount_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('discount_percentage must be between 0 and 100'),
    body('description').optional().isString(),
    body('active').optional().isBoolean()
  ],
  validate,
  kitsController.create
)

/**
 * PATCH /api/kits/:id
 * Atualiza um kit
 */
router.patch(
  '/:id',
  [
    body('name').optional().notEmpty().withMessage('name cannot be empty'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be at least 1'),
    body('volume_ml').optional().isFloat({ min: 0 }).withMessage('volume_ml must be a positive number'),
    body('discount_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('discount_percentage must be between 0 and 100'),
    body('description').optional().isString(),
    body('active').optional().isBoolean()
  ],
  validate,
  kitsController.update
)

/**
 * DELETE /api/kits/:id
 * Deleta um kit
 */
router.delete('/:id', kitsController.delete)

/**
 * POST /api/kits/calculate-price
 * Calcula preço do kit
 */
router.post(
  '/calculate-price',
  [
    body('kit_id').isInt().withMessage('kit_id must be an integer'),
    body('product_id').isInt().withMessage('product_id must be an integer'),
    body('base_price').isFloat({ min: 0 }).withMessage('base_price must be a positive number')
  ],
  validate,
  kitsController.calculatePrice
)

module.exports = router
