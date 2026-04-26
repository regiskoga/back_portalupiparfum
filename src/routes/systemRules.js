/**
 * Rotas: Sistema de Regras Configuráveis
 */

const express = require('express');
const router = express.Router();
const systemRulesController = require('../controllers/systemRulesController');
const {
  createRuleValidation,
  updateRuleValidation,
  showRuleValidation,
  indexRulesValidation,
  toggleActiveValidation,
  historyValidation,
  notificationsValidation,
  markNotificationReadValidation,
  getRuleValueValidation
} = require('../validators/systemRulesValidator');

// Middleware de autenticação (placeholder - implementar quando tiver auth)
const requireAdmin = (req, res, next) => {
  // TODO: Implementar verificação de admin quando tiver sistema de auth
  // Por enquanto, permite acesso
  next();
};

// === ROTAS PÚBLICAS (leitura) ===

// Listar regras com filtros e busca
router.get('/', 
  indexRulesValidation,
  systemRulesController.index
);

// Buscar regra específica por ID ou key
router.get('/:id', 
  showRuleValidation,
  systemRulesController.show
);

// Buscar valor de regra específica (para uso interno do sistema)
router.get('/value/:key',
  getRuleValueValidation,
  systemRulesController.getRuleValue
);

// Estatísticas das regras
router.get('/admin/stats',
  systemRulesController.stats
);

// === ROTAS ADMINISTRATIVAS (requerem admin) ===

// Criar nova regra
router.post('/',
  requireAdmin,
  createRuleValidation,
  systemRulesController.store
);

// Atualizar regra existente
router.put('/:id',
  requireAdmin,
  updateRuleValidation,
  systemRulesController.update
);

// Ativar/Desativar regra
router.patch('/:id/toggle',
  requireAdmin,
  toggleActiveValidation,
  systemRulesController.toggleActive
);

// === HISTÓRICO E AUDITORIA ===

// Listar histórico de uma regra
router.get('/:id/history',
  historyValidation,
  systemRulesController.history
);

// === NOTIFICAÇÕES ===

// Listar notificações
router.get('/admin/notifications',
  notificationsValidation,
  systemRulesController.notifications
);

// Marcar notificação como lida
router.patch('/admin/notifications/:id/read',
  markNotificationReadValidation,
  systemRulesController.markNotificationRead
);

module.exports = router;