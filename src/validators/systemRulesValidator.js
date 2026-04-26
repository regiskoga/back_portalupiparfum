/**
 * Validações para Sistema de Regras
 */

const { body, param, query } = require('express-validator');

// Categorias válidas
const VALID_CATEGORIES = [
  'calculo',
  'temporal', 
  'estoque',
  'producao',
  'clientes',
  'financeiro'
];

// Validações para criar regra
const createRuleValidation = [
  body('key')
    .notEmpty()
    .withMessage('Chave da regra é obrigatória')
    .isLength({ min: 3, max: 100 })
    .withMessage('Chave deve ter entre 3 e 100 caracteres')
    .matches(/^[a-z0-9_]+$/)
    .withMessage('Chave deve conter apenas letras minúsculas, números e underscore'),

  body('category')
    .notEmpty()
    .withMessage('Categoria é obrigatória')
    .isIn(VALID_CATEGORIES)
    .withMessage(`Categoria deve ser uma das seguintes: ${VALID_CATEGORIES.join(', ')}`),

  body('title')
    .notEmpty()
    .withMessage('Título é obrigatório')
    .isLength({ min: 5, max: 200 })
    .withMessage('Título deve ter entre 5 e 200 caracteres'),

  body('description')
    .notEmpty()
    .withMessage('Descrição é obrigatória')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Descrição deve ter entre 10 e 2000 caracteres'),

  body('config')
    .optional()
    .isObject()
    .withMessage('Config deve ser um objeto JSON válido'),

  body('numeric_value')
    .optional()
    .isNumeric()
    .withMessage('Valor numérico deve ser um número válido'),

  body('text_value')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Valor texto deve ter no máximo 500 caracteres'),

  body('is_editable')
    .optional()
    .isBoolean()
    .withMessage('is_editable deve ser true ou false')
];

// Validações para atualizar regra
const updateRuleValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID deve ser um número inteiro positivo'),

  body('title')
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage('Título deve ter entre 5 e 200 caracteres'),

  body('description')
    .optional()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Descrição deve ter entre 10 e 2000 caracteres'),

  body('config')
    .optional()
    .isObject()
    .withMessage('Config deve ser um objeto JSON válido'),

  body('numeric_value')
    .optional()
    .isNumeric()
    .withMessage('Valor numérico deve ser um número válido'),

  body('text_value')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Valor texto deve ter no máximo 500 caracteres'),

  body('change_reason')
    .optional()
    .isLength({ min: 5, max: 500 })
    .withMessage('Motivo da mudança deve ter entre 5 e 500 caracteres')
];

// Validações para buscar regra
const showRuleValidation = [
  param('id')
    .notEmpty()
    .withMessage('ID ou chave da regra é obrigatório')
];

// Validações para listar regras
const indexRulesValidation = [
  query('category')
    .optional()
    .isIn(VALID_CATEGORIES)
    .withMessage(`Categoria deve ser uma das seguintes: ${VALID_CATEGORIES.join(', ')}`),

  query('search')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Busca deve ter entre 2 e 100 caracteres'),

  query('active_only')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('active_only deve ser true ou false'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número inteiro positivo'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve ser entre 1 e 100')
];

// Validações para toggle ativo
const toggleActiveValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID deve ser um número inteiro positivo'),

  body('change_reason')
    .optional()
    .isLength({ min: 5, max: 500 })
    .withMessage('Motivo da mudança deve ter entre 5 e 500 caracteres')
];

// Validações para histórico
const historyValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID deve ser um número inteiro positivo'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número inteiro positivo'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limite deve ser entre 1 e 50')
];

// Validações para notificações
const notificationsValidation = [
  query('unread_only')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('unread_only deve ser true ou false'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número inteiro positivo'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limite deve ser entre 1 e 50')
];

// Validação para marcar notificação como lida
const markNotificationReadValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID deve ser um número inteiro positivo')
];

// Validação para buscar valor de regra
const getRuleValueValidation = [
  param('key')
    .notEmpty()
    .withMessage('Chave da regra é obrigatória')
    .matches(/^[a-z0-9_]+$/)
    .withMessage('Chave deve conter apenas letras minúsculas, números e underscore')
];

module.exports = {
  createRuleValidation,
  updateRuleValidation,
  showRuleValidation,
  indexRulesValidation,
  toggleActiveValidation,
  historyValidation,
  notificationsValidation,
  markNotificationReadValidation,
  getRuleValueValidation,
  VALID_CATEGORIES
};