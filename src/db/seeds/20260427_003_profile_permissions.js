/**
 * Seed: Profile Permissions (Configuração inicial)
 */

exports.seed = async function(knex) {
  // Limpar tabela
  await knex('profile_permissions').del()

  // Buscar IDs dos perfis e telas
  const profiles = await knex('user_profiles').select('id', 'name')
  const screens = await knex('system_screens').select('id', 'screen_key')

  const permissions = []

  // ADM - Acesso total
  const admProfile = profiles.find(p => p.name === 'ADM')
  if (admProfile) {
    screens.forEach(screen => {
      permissions.push({
        profile_id: admProfile.id,
        screen_id: screen.id,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true
      })
    })
  }

  // Vendedor - Acesso comercial
  const vendedorProfile = profiles.find(p => p.name === 'Vendedor')
  if (vendedorProfile) {
    const vendedorScreens = [
      'dashboard-overview', 'dashboard-sales',
      'clientes', 'orders', 'kits', 'coupons',
      'produtos', 'customer-gifts'
    ]
    
    screens.forEach(screen => {
      if (vendedorScreens.includes(screen.screen_key)) {
        permissions.push({
          profile_id: vendedorProfile.id,
          screen_id: screen.id,
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: false // Vendedor não pode deletar
        })
      }
    })
  }

  // Visualizador - Apenas leitura
  const visualizadorProfile = profiles.find(p => p.name === 'Visualizador')
  if (visualizadorProfile) {
    const visualizadorScreens = [
      'dashboard-overview', 'dashboard-production', 'dashboard-financial', 'dashboard-sales',
      'insumos', 'fornecedores', 'produtos', 'formulas', 'lotes', 'envases',
      'clientes', 'traceability'
    ]
    
    screens.forEach(screen => {
      if (visualizadorScreens.includes(screen.screen_key)) {
        permissions.push({
          profile_id: visualizadorProfile.id,
          screen_id: screen.id,
          can_view: true,
          can_create: false,
          can_edit: false,
          can_delete: false
        })
      }
    })
  }

  // Inserir permissões
  if (permissions.length > 0) {
    await knex('profile_permissions').insert(permissions)
  }
}