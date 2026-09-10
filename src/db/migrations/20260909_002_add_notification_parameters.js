/**
 * Migration: parâmetros das novas notificações.
 *
 * Ficam na tabela `parameters` para aparecerem sozinhos na tela de Parâmetros
 * (ela renderiza key/label/description de tudo que existe lá) e poderem ser
 * ajustados sem deploy. Os defaults do controller são os mesmos daqui.
 *
 * essence_idle_days = 180 de propósito: com 90 dias seriam 270 essências
 * paradas hoje, o que transforma o aviso em ruído.
 */

const PARAMS = [
  {
    key: 'low_stock_bottle_warning',
    value: '50',
    label: 'Frasco: alerta amarelo (un.)',
    description: 'Abaixo desta quantidade o frasco entra como alerta nas notificações',
  },
  {
    key: 'low_stock_bottle_critical',
    value: '20',
    label: 'Frasco: alerta vermelho (un.)',
    description: 'Abaixo desta quantidade o frasco entra como crítico nas notificações',
  },
  {
    key: 'order_stale_days',
    value: '7',
    label: 'Pedido parado (dias)',
    description: 'Dias na fila sem envase completo para o pedido virar notificação',
  },
  {
    key: 'essence_idle_days',
    value: '180',
    label: 'Essência parada (dias)',
    description: 'Dias desde a compra sem nenhum uso para a essência virar notificação',
  },
]

exports.up = async function (knex) {
  for (const p of PARAMS) {
    const exists = await knex('parameters').where({ key: p.key }).first()
    if (!exists) await knex('parameters').insert(p)
  }
}

exports.down = async function (knex) {
  await knex('parameters').whereIn('key', PARAMS.map(p => p.key)).del()
}
