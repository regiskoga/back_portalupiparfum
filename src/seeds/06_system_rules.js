/**
 * Seed: Regras Padrão do Sistema Parfumerie
 * Popula as regras básicas de negócio
 */

exports.seed = async function(knex) {
  // Limpar tabelas
  await knex('system_rules_notifications').del();
  await knex('system_rules_history').del();
  await knex('system_rules').del();

  // Regras padrão do sistema
  const defaultRules = [
    // === REGRAS DE CÁLCULO ===
    {
      key: 'unit_cost_calculation',
      category: 'calculo',
      title: 'Cálculo de Custo Unitário',
      description: 'O custo unitário dos insumos é calculado dividindo o valor total pago pela quantidade comprada. Fórmula: Custo Unitário = Valor Total ÷ Quantidade',
      config: {
        formula: 'total_paid / quantity_purchased',
        precision: 4,
        currency: 'BRL'
      },
      numeric_value: null,
      text_value: 'total_paid / quantity_purchased',
      is_editable: false, // regra core do sistema
      version: 1
    },
    {
      key: 'formula_validation_percentage',
      category: 'calculo',
      title: 'Validação de Fórmulas - Percentual Total',
      description: 'Todas as fórmulas devem somar exatamente 100%. O sistema não permite salvar fórmulas com soma diferente de 100%.',
      config: {
        required_total: 100,
        tolerance: 0,
        unit: 'percentage'
      },
      numeric_value: 100.0000,
      text_value: '100%',
      is_editable: true,
      version: 1
    },
    {
      key: 'profit_margin_minimum',
      category: 'calculo',
      title: 'Margem de Lucro Mínima',
      description: 'Margem de lucro mínima recomendada para produtos. Valores abaixo desta margem geram alertas no sistema.',
      config: {
        minimum_percentage: 30,
        alert_threshold: 25,
        unit: 'percentage'
      },
      numeric_value: 30.0000,
      text_value: '30%',
      is_editable: true,
      version: 1
    },

    // === REGRAS TEMPORAIS ===
    {
      key: 'maceration_period_days',
      category: 'temporal',
      title: 'Período de Maceração Obrigatório',
      description: 'Tempo mínimo que um lote deve ficar em maceração antes de poder ser envasado. Este período é essencial para a qualidade do perfume.',
      config: {
        days: 10,
        unit: 'days',
        strict: true
      },
      numeric_value: 10.0000,
      text_value: '10 dias',
      is_editable: true,
      version: 1
    },
    {
      key: 'expiry_alert_days',
      category: 'temporal',
      title: 'Alerta de Vencimento - Dias de Antecedência',
      description: 'Quantos dias antes do vencimento o sistema deve alertar sobre produtos próximos ao vencimento.',
      config: {
        days: 30,
        unit: 'days',
        alert_types: ['email', 'dashboard']
      },
      numeric_value: 30.0000,
      text_value: '30 dias',
      is_editable: true,
      version: 1
    },

    // === REGRAS DE ESTOQUE ===
    {
      key: 'low_stock_threshold',
      category: 'estoque',
      title: 'Limite de Estoque Baixo',
      description: 'Quantidade mínima em estoque que gera alerta. Quando um insumo atinge esta quantidade, o sistema emite notificação.',
      config: {
        threshold_type: 'percentage',
        percentage: 20,
        minimum_absolute: 50,
        unit: 'ml'
      },
      numeric_value: 20.0000,
      text_value: '20% ou 50ml',
      is_editable: true,
      version: 1
    },
    {
      key: 'chorinho_tolerance',
      category: 'estoque',
      title: 'Tolerância do Chorinho',
      description: 'Percentual de tolerância para sobras no envase. Esta margem evita problemas com pequenas sobras que não podem ser envasadas.',
      config: {
        percentage: 5,
        apply_to: 'bottling',
        unit: 'percentage'
      },
      numeric_value: 5.0000,
      text_value: '5%',
      is_editable: true,
      version: 1
    },

    // === REGRAS DE PRODUÇÃO ===
    {
      key: 'batch_minimum_quantity',
      category: 'producao',
      title: 'Quantidade Mínima por Lote',
      description: 'Quantidade mínima para criar um lote de produção. Lotes muito pequenos podem ser inviáveis economicamente.',
      config: {
        minimum_ml: 100,
        unit: 'ml',
        reason: 'economic_viability'
      },
      numeric_value: 100.0000,
      text_value: '100ml',
      is_editable: true,
      version: 1
    },
    {
      key: 'quality_control_required',
      category: 'producao',
      title: 'Controle de Qualidade Obrigatório',
      description: 'Define se o controle de qualidade é obrigatório antes do envase. Quando ativo, lotes precisam ser aprovados manualmente.',
      config: {
        required: false,
        approval_roles: ['admin', 'quality_manager'],
        can_override: true
      },
      numeric_value: null,
      text_value: 'Desabilitado',
      is_editable: true,
      version: 1
    },

    // === REGRAS DE CLIENTES ===
    {
      key: 'gift_duplicate_prevention',
      category: 'clientes',
      title: 'Prevenção de Brindes Duplicados',
      description: 'Controla se o sistema deve alertar quando um cliente já recebeu um brinde anteriormente.',
      config: {
        prevent_duplicates: true,
        allow_override: true,
        override_requires_reason: true
      },
      numeric_value: null,
      text_value: 'Ativo com override',
      is_editable: true,
      version: 1
    },
    {
      key: 'customer_credit_limit',
      category: 'clientes',
      title: 'Limite de Crédito Padrão',
      description: 'Limite de crédito padrão para novos clientes. Pode ser ajustado individualmente para cada cliente.',
      config: {
        default_limit: 1000,
        currency: 'BRL',
        auto_approve_up_to: 500
      },
      numeric_value: 1000.0000,
      text_value: 'R$ 1.000,00',
      is_editable: true,
      version: 1
    },

    // === REGRAS FINANCEIRAS ===
    {
      key: 'repricing_trigger_percentage',
      category: 'financeiro',
      title: 'Gatilho para Reprecificação',
      description: 'Percentual de aumento no custo dos insumos que dispara sugestão automática de reprecificação dos produtos.',
      config: {
        percentage: 15,
        unit: 'percentage',
        auto_suggest: true
      },
      numeric_value: 15.0000,
      text_value: '15%',
      is_editable: true,
      version: 1
    },
    {
      key: 'payment_terms_default',
      category: 'financeiro',
      title: 'Prazo de Pagamento Padrão',
      description: 'Prazo padrão para pagamento de pedidos. Aplicado automaticamente a novos pedidos.',
      config: {
        days: 30,
        unit: 'days',
        can_customize: true
      },
      numeric_value: 30.0000,
      text_value: '30 dias',
      is_editable: true,
      version: 1
    }
  ];

  // Inserir regras
  await knex('system_rules').insert(defaultRules);

  // Criar histórico inicial
  const insertedRules = await knex('system_rules').select('id', 'key');
  
  const historyEntries = insertedRules.map(rule => ({
    rule_id: rule.id,
    action: 'CREATE',
    old_values: null,
    new_values: { status: 'created_with_seed' },
    change_reason: 'Regra criada durante inicialização do sistema',
    changed_by: null, // sistema
    changed_at: new Date()
  }));

  await knex('system_rules_history').insert(historyEntries);

  console.log(`✅ Inseridas ${defaultRules.length} regras padrão do sistema`);
};