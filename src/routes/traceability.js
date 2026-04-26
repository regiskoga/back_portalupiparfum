const router = require('express').Router()
const ctrl = require('../controllers/traceabilityController')
const { param, query } = require('express-validator')
const { validate } = require('../middleware/validate')

// ═══════════════════════════════════════════════════════════════════════════════
// ROTAS DE RASTREABILIDADE TOTAL - PROMPT #12
// ═══════════════════════════════════════════════════════════════════════════════

// ─── RASTREABILIDADE: FRASCO → ORIGEM ─────────────────────────────────────────
router.get('/bottling/:bottling_id', 
  [param('bottling_id').isInt({ min: 1 }).withMessage('ID do envase deve ser um número válido')],
  validate,
  ctrl.traceBottlingToOrigin
)

// ─── RASTREABILIDADE: INSUMO → DESTINO ────────────────────────────────────────
router.get('/supply/:supply_id',
  [param('supply_id').isInt({ min: 1 }).withMessage('ID do insumo deve ser um número válido')],
  validate,
  ctrl.traceSupplyToDestination
)

// ─── LOGS POR ENTIDADE ────────────────────────────────────────────────────────
router.get('/logs/:entity_type/:entity_id',
  [
    param('entity_type').isIn(['supply', 'batch', 'bottling', 'order', 'customer'])
      .withMessage('Tipo de entidade inválido'),
    param('entity_id').isInt({ min: 1 }).withMessage('ID da entidade deve ser um número válido'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limite deve ser entre 1 e 200'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset deve ser >= 0')
  ],
  validate,
  ctrl.getEntityLogs
)

// ─── CADEIA COMPLETA (GENÉRICO) ───────────────────────────────────────────────
router.get('/chain/:type/:id',
  [
    param('type').isIn(['bottling', 'supply']).withMessage('Tipo deve ser "bottling" ou "supply"'),
    param('id').isInt({ min: 1 }).withMessage('ID deve ser um número válido')
  ],
  validate,
  ctrl.getFullChain
)

module.exports = router