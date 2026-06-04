/**
 * Migration: cria tabela maceration_checkins para tracking diário da maceração alternada.
 * Cada linha representa o registro de que o operador moveu o lote no dia N (geladeira/fora).
 */

exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('maceration_checkins')
  if (exists) return

  await knex.schema.createTable('maceration_checkins', t => {
    t.increments('id')
    t.integer('batch_id').notNullable()
      .references('id').inTable('batches').onDelete('CASCADE')
    t.integer('day_number').notNullable()
    t.string('expected_location', 20).notNullable() // 'geladeira' | 'fora'
    t.timestamp('checked_at').notNullable().defaultTo(knex.fn.now())
    t.string('operator', 100).defaultTo('')
    t.text('notes').defaultTo('')

    t.unique(['batch_id', 'day_number'])
    t.index('batch_id')
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('maceration_checkins')
}
