/**
 * Seed: Configurar Permissões por Perfil
 * Define quais telas cada perfil pode acessar
 */

exports.seed = async function(knex) {
  // Limpar permissões existentes
  await knex('profile_screen_permissions').del()
  
  // Definir telas do sistema
  const screens = [
    'dashboard',
    'insumos',
    'fornecedores',
    'clientes',
    'produtos',
    'formulas',
    'lotes',
    'envases',
    'pedidos',
    'kits',
    'cupons',
    'perdas',
    'doacoes',
    'transferencias',
    'ocorrencias',
    'rastreabilidade',
    'usuarios',
    'configuracoes'
  ]
  
  const permissions = []
  
  // ═══ PERFIL ADM ═══
  // ADM tem acesso total a tudo
  screens.forEach(screen => {
    permissions.push({
      profile: 'ADM',
      screen_key: screen,
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: true
    })
  })
  
  // ═══ PERFIL GERENTE ═══
  // GERENTE tem acesso a quase tudo, exceto usuários
  screens.forEach(screen => {
    if (screen !== 'usuarios') {
      permissions.push({
        profile: 'GERENTE',
        screen_key: screen,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: screen !== 'rastreabilidade' // Não pode deletar rastreabilidade
      })
    }
  })
  
  // ═══ PERFIL OPERADOR ═══
  // OPERADOR pode criar e editar, mas não deletar
  const operatorScreens = [
    'dashboard',
    'insumos',
    'fornecedores',
    'clientes',
    'produtos',
    'formulas',
    'lotes',
    'envases',
    'pedidos',
    'rastreabilidade'
  ]
  
  operatorScreens.forEach(screen => {
    permissions.push({
      profile: 'OPERADOR',
      screen_key: screen,
      can_view: true,
      can_create: screen !== 'dashboard' && screen !== 'rastreabilidade',
      can_edit: screen !== 'dashboard' && screen !== 'rastreabilidade',
      can_delete: false
    })
  })
  
  // ═══ PERFIL VISUALIZADOR ═══
  // VISUALIZADOR só pode ver
  const viewerScreens = [
    'dashboard',
    'insumos',
    'fornecedores',
    'clientes',
    'produtos',
    'rastreabilidade'
  ]
  
  viewerScreens.forEach(screen => {
    permissions.push({
      profile: 'VISUALIZADOR',
      screen_key: screen,
      can_view: true,
      can_create: false,
      can_edit: false,
      can_delete: false
    })
  })
  
  // Inserir permissões
  await knex('profile_screen_permissions').insert(permissions)
  
  console.log(`✅ ${permissions.length} permissões configuradas com sucesso!`)
}
