/**
 * Migration: Add missing business-rule parameters
 */

exports.up = async function(knex) {
  await knex('parameters').insert([
    {
      key: 'profit_margin_minimum_pct',
      value: '30',
      label: 'Margem mínima de lucro (%)',
      description: 'Percentual mínimo de margem aceito ao definir preços de venda'
    },
    {
      key: 'low_stock_alert_pct',
      value: '20',
      label: 'Alerta de estoque baixo (%)',
      description: 'Percentual do volume inicial abaixo do qual o sistema emite alerta de estoque'
    },
    {
      key: 'low_stock_alert_ml',
      value: '50',
      label: 'Alerta de estoque baixo (ml mínimo)',
      description: 'Volume absoluto em ml abaixo do qual o lote é considerado crítico'
    },
    {
      key: 'batch_minimum_ml',
      value: '100',
      label: 'Volume mínimo por lote (ml)',
      description: 'Quantidade mínima em ml para abertura de um novo lote de produção'
    },
    {
      key: 'expiry_alert_days',
      value: '30',
      label: 'Antecedência de alerta de vencimento (dias)',
      description: 'Quantos dias antes do vencimento o sistema deve emitir alertas'
    },
    {
      key: 'repricing_trigger_pct',
      value: '15',
      label: 'Gatilho de reprecificação (%)',
      description: 'Variação percentual no custo de insumos que dispara sugestão de revisão de preços'
    },
  ]).onConflict('key').ignore()
}

exports.down = async function(knex) {
  await knex('parameters').whereIn('key', [
    'profit_margin_minimum_pct',
    'low_stock_alert_pct',
    'low_stock_alert_ml',
    'batch_minimum_ml',
    'expiry_alert_days',
    'repricing_trigger_pct',
  ]).del()
}
