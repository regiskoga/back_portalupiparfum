exports.up = async function (knex) {
  await knex('parameters').insert([
    {
      key: 'low_stock_supply_warning',
      value: '100',
      label: 'Estoque de insumo — aviso (qtd)',
      description: 'Quantidade abaixo da qual o insumo entra em estado de aviso de estoque baixo'
    },
    {
      key: 'low_stock_supply_critical',
      value: '50',
      label: 'Estoque de insumo — crítico (qtd)',
      description: 'Quantidade abaixo da qual o insumo entra em estado crítico de estoque'
    },
    {
      key: 'low_stock_batch_ml',
      value: '500',
      label: 'Estoque de lote para produto de alta demanda (ml)',
      description: 'Volume em ml abaixo do qual um produto com alta demanda recebe alerta de estoque baixo'
    },
    {
      key: 'maceration_alert_days',
      value: '3',
      label: 'Antecedência de alerta de fim de maceração (dias)',
      description: 'Quantos dias antes do fim da maceração o sistema emite o alerta de lote próximo de liberar'
    },
    {
      key: 'critical_supply_qty',
      value: '200',
      label: 'Estoque mínimo de insumo crítico (qtd)',
      description: 'Quantidade abaixo da qual um insumo usado em múltiplas fórmulas é considerado crítico'
    },
    {
      key: 'critical_supply_formulas_min',
      value: '3',
      label: 'Fórmulas mínimas para insumo crítico',
      description: 'Número mínimo de fórmulas que usam o insumo para ele ser classificado como crítico'
    },
    {
      key: 'high_demand_orders_min',
      value: '5',
      label: 'Pedidos mínimos para produto de alta demanda',
      description: 'Número mínimo de pedidos nos últimos 30 dias para classificar um produto como alta demanda'
    },
    {
      key: 'profit_margin_warning_pct',
      value: '20',
      label: 'Margem de lucro — aviso crítico (%)',
      description: 'Percentual abaixo do qual a sugestão de reprecificação tem severidade de aviso (acima disso é informativo)'
    },
  ]).onConflict('key').ignore()
}

exports.down = async function (knex) {
  await knex('parameters').whereIn('key', [
    'low_stock_supply_warning',
    'low_stock_supply_critical',
    'low_stock_batch_ml',
    'maceration_alert_days',
    'critical_supply_qty',
    'critical_supply_formulas_min',
    'high_demand_orders_min',
    'profit_margin_warning_pct',
  ]).del()
}
