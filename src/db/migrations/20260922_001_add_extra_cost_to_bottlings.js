/**
 * Migration: custo extra por frasco no envase.
 *
 * Pedido do cliente (21/09/2026, vídeo): "esse custo que está sendo calculado
 * nem sempre é o custo certo, acho que ainda precisa colocar uns 4 reais a mais
 * por cada frasco, independente do tamanho. Porque a impressão de etiqueta que
 * eu faço e outras coisas que têm que ser feitas."
 *
 * Duas peças, as duas ADITIVAS:
 *
 * 1. `bottlings.extra_cost` — quanto de custo diverso entrou NAQUELE envase.
 *    Guardado na linha (e não recalculado na leitura) porque o parâmetro pode
 *    mudar amanhã e o custo registrado de um envase não pode mudar junto: ele
 *    já virou preço, já foi vendido. Default 0 = os envases que já existem
 *    ficam exatamente como estão (decisão do usuário: vale só dos novos em
 *    diante).
 *
 * 2. Parâmetro `extra_cost_per_bottle` — o valor por unidade, editável na tela
 *    de Parâmetros sem deploy. Nasce com os 4,00 que ele pediu.
 */

const PARAM = {
  key: 'extra_cost_per_bottle',
  value: '4.00',
  label: 'Custo extra por frasco (R$)',
  description: 'Somado ao custo de cada unidade envasada, além de líquido, frasco e rótulo (impressão de etiqueta e outros). Vale para envases criados a partir de agora.',
}

exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('bottlings', 'extra_cost')
  if (!hasColumn) {
    await knex.schema.alterTable('bottlings', table => {
      table.decimal('extra_cost', 10, 2).defaultTo(0)
    })
  }

  const exists = await knex('parameters').where({ key: PARAM.key }).first()
  if (!exists) await knex('parameters').insert(PARAM)
}

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('bottlings', 'extra_cost')
  if (hasColumn) {
    await knex.schema.alterTable('bottlings', table => {
      table.dropColumn('extra_cost')
    })
  }
  await knex('parameters').where({ key: PARAM.key }).del()
}
