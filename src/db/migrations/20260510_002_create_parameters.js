exports.up = async function (knex) {
  await knex.schema.createTable('parameters', table => {
    table.string('key').primary()
    table.text('value').notNullable()
    table.string('label').notNullable()
    table.text('description').defaultTo('')
    table.timestamps(true, true)
  })

  await knex('parameters').insert([
    {
      key: 'maceration_days',
      value: '10',
      label: 'Dias de maceração',
      description: 'Duração padrão da maceração em dias corridos'
    },
    {
      key: 'chorinho_tolerance_pct',
      value: '5',
      label: 'Tolerância de chorinho (%)',
      description: 'Percentual de volume extra permitido no envase (ex: 5 = 5%)'
    },
  ])
}

exports.down = function (knex) {
  return knex.schema.dropTable('parameters')
}
