/**
 * Migration (Fase 1): cadastro de Parceiros (afiliados / divulgadores).
 *
 * Um parceiro é um canal (YouTube, Instagram, etc.) que divulga a marca usando
 * cupons. A vinculação parceiro↔cupom fica em coupons.partner_id (1:N — um
 * parceiro tem vários cupons; um cupom tem no máximo um dono, senão a comissão
 * fica ambígua). A % de comissão padrão mora aqui; o cupom pode sobrescrever.
 *
 * O crédito de comissão em si (livro-razão) é da Fase 2 — aqui é só o cadastro.
 */

exports.up = function (knex) {
  return knex.schema.createTable('partners', (table) => {
    table.increments('id').primary()
    table.text('name').notNullable()
    table.text('doc').defaultTo('')                       // CPF/CNPJ p/ nota de permuta
    table.enu('channel_type', ['youtube', 'instagram', 'tiktok', 'outro'])
      .notNullable().defaultTo('outro')
    table.text('handle').defaultTo('')                    // @ do perfil
    table.text('url').defaultTo('')                       // link do canal
    table.text('contact_email').defaultTo('')
    table.text('contact_phone').defaultTo('')
    table.decimal('default_commission_rate', 5, 2).notNullable().defaultTo(0) // % padrão
    table.enu('payout_mode', ['mercadoria', 'pix', 'ambos']).notNullable().defaultTo('mercadoria')
    table.boolean('active').notNullable().defaultTo(true) // soft-delete
    table.text('notes').defaultTo('')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    table.index('name')
    table.index('active')
  })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('partners')
}
