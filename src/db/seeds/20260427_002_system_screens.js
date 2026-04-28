/**
 * Seed: System Screens
 */

exports.seed = async function(knex) {
  // Limpar tabela
  await knex('system_screens').del()

  // Inserir telas do sistema
  await knex('system_screens').insert([
    // Dashboard
    { id: 1, screen_key: 'dashboard-overview', screen_name: 'Dashboard - Visão Geral', category: 'Dashboard', route: 'dashboard', sort_order: 1 },
    { id: 2, screen_key: 'dashboard-production', screen_name: 'Dashboard - Produção', category: 'Dashboard', route: 'dashboard', sort_order: 2 },
    { id: 3, screen_key: 'dashboard-financial', screen_name: 'Dashboard - Financeiro', category: 'Dashboard', route: 'dashboard', sort_order: 3 },
    { id: 4, screen_key: 'dashboard-alerts', screen_name: 'Dashboard - Alertas', category: 'Dashboard', route: 'dashboard', sort_order: 4 },
    { id: 5, screen_key: 'dashboard-sales', screen_name: 'Dashboard - Vendas', category: 'Dashboard', route: 'dashboard', sort_order: 5 },

    // Estoque
    { id: 10, screen_key: 'insumos', screen_name: 'Insumos', category: 'Estoque', route: 'insumos', sort_order: 10 },
    { id: 11, screen_key: 'fornecedores', screen_name: 'Fornecedores', category: 'Estoque', route: 'fornecedores', sort_order: 11 },

    // Produção
    { id: 20, screen_key: 'produtos', screen_name: 'Produtos', category: 'Produção', route: 'produtos', sort_order: 20 },
    { id: 21, screen_key: 'formulas', screen_name: 'Fórmulas', category: 'Produção', route: 'formulas', sort_order: 21 },
    { id: 22, screen_key: 'lotes', screen_name: 'Lotes', category: 'Produção', route: 'lotes', sort_order: 22 },
    { id: 23, screen_key: 'envases', screen_name: 'Envases', category: 'Produção', route: 'envases', sort_order: 23 },

    // Comercial
    { id: 30, screen_key: 'clientes', screen_name: 'Clientes', category: 'Comercial', route: 'clientes', sort_order: 30 },
    { id: 31, screen_key: 'orders', screen_name: 'Pedidos', category: 'Comercial', route: 'orders', sort_order: 31 },
    { id: 32, screen_key: 'kits', screen_name: 'Kits', category: 'Comercial', route: 'kits', sort_order: 32 },
    { id: 33, screen_key: 'coupons', screen_name: 'Cupons', category: 'Comercial', route: 'coupons', sort_order: 33 },

    // Operações
    { id: 40, screen_key: 'losses', screen_name: 'Perdas', category: 'Operações', route: 'losses', sort_order: 40 },
    { id: 41, screen_key: 'donations', screen_name: 'Doações', category: 'Operações', route: 'donations', sort_order: 41 },
    { id: 42, screen_key: 'batch-transfers', screen_name: 'Transferências de Lote', category: 'Operações', route: 'batch-transfers', sort_order: 42 },
    { id: 43, screen_key: 'occurrences', screen_name: 'Ocorrências', category: 'Operações', route: 'occurrences', sort_order: 43 },

    // Sistema
    { id: 50, screen_key: 'traceability', screen_name: 'Rastreabilidade', category: 'Sistema', route: 'traceability', sort_order: 50 },
    { id: 51, screen_key: 'customer-gifts', screen_name: 'Brindes de Cliente', category: 'Sistema', route: 'customer-gifts', sort_order: 51 },
    { id: 52, screen_key: 'system-rules', screen_name: 'Regras do Sistema', category: 'Sistema', route: 'system-rules', sort_order: 52 },
    { id: 53, screen_key: 'user-permissions', screen_name: 'Configuração de Perfis', category: 'Sistema', route: 'user-permissions', sort_order: 53 }
  ])
}