/**
 * Seed: User Profiles
 */

exports.seed = async function(knex) {
  // Limpar tabela
  await knex('user_profiles').del()

  // Inserir perfis padrão
  await knex('user_profiles').insert([
    {
      id: 1,
      name: 'ADM',
      description: 'Administrador - Acesso total ao sistema',
      is_active: true
    },
    {
      id: 2,
      name: 'Vendedor',
      description: 'Vendedor - Acesso comercial e clientes',
      is_active: true
    },
    {
      id: 3,
      name: 'Visualizador',
      description: 'Visualizador - Apenas leitura e relatórios',
      is_active: true
    }
  ])
}