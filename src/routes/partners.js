const router = require('express').Router()
const ctrl   = require('../controllers/partnersController')
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')

const partnerRules = [
  body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
  body('channel_type').optional().isIn(['youtube', 'instagram', 'tiktok', 'outro'])
    .withMessage('Canal inválido'),
  body('payout_mode').optional().isIn(['mercadoria', 'pix', 'ambos'])
    .withMessage('Forma de pagamento inválida'),
  body('default_commission_rate').optional({ nullable: true }).isFloat({ min: 0, max: 100 })
    .withMessage('Comissão deve estar entre 0 e 100'),
  body('contact_email').optional({ values: 'falsy' }).isEmail().withMessage('E-mail inválido'),
]

router.get   ('/',              ctrl.list)
router.get   ('/:id/statement', [param('id').isInt()], validate, ctrl.statement)
router.post  ('/:id/redemptions', [
  param('id').isInt(),
  body('amount').isFloat({ gt: 0 }).withMessage('Valor do resgate inválido'),
  body('payout_mode').optional().isIn(['mercadoria', 'pix']),
  body('items').optional().isArray(),
], validate, ctrl.createRedemption)
router.patch ('/:id/redemptions/:rid/cancel',
  [param('id').isInt(), param('rid').isInt()], validate, ctrl.cancelRedemption)
router.get   ('/:id',          [param('id').isInt()], validate, ctrl.getOne)
router.post  ('/',             partnerRules, validate, ctrl.create)
router.patch ('/:id/reativar', [param('id').isInt()], validate, ctrl.reativar)
router.put   ('/:id',         [param('id').isInt(), ...partnerRules], validate, ctrl.update)
router.patch ('/:id',         [param('id').isInt()], validate, ctrl.update)
router.delete('/:id',         [param('id').isInt()], validate, ctrl.remove)

module.exports = router
