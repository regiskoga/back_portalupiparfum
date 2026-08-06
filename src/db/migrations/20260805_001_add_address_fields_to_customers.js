/**
 * Migration: campos de endereço separados em customers
 * Adiciona rua/número/complemento/bairro/país + referência do contato e ponto
 * de referência da residência. Reusa city/state/zip_code que já existem.
 * A coluna `address` (endereço completo) é MANTIDA (deprecada, escondida da UI)
 * para não perder o que já foi importado — pode ser removida no futuro.
 * Todos nullable; country default 'Brasil'.
 */

exports.up = function (knex) {
  return knex.schema.alterTable('customers', (t) => {
    t.text('street').nullable()
    t.text('street_number').nullable()
    t.text('complement').nullable()
    t.text('neighborhood').nullable()
    t.text('country').defaultTo('Brasil')
    t.text('contact_reference').nullable()      // de onde veio o contato (grupo/indicação)
    t.text('residence_reference').nullable()    // ponto de referência físico da casa
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('customers', (t) => {
    t.dropColumn('street')
    t.dropColumn('street_number')
    t.dropColumn('complement')
    t.dropColumn('neighborhood')
    t.dropColumn('country')
    t.dropColumn('contact_reference')
    t.dropColumn('residence_reference')
  })
}
