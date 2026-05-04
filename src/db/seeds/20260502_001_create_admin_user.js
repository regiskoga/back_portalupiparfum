/**
 * Seed: Criar Usuário Administrador
 * Cria o usuário ADM inicial do sistema
 */

const bcrypt = require('bcrypt')

exports.seed = async function(knex) {
  // Verificar se já existe o usuário ADM para não sobrescrever dados em produção
  const existing = await knex('users').where({ email: 'euclidesbarbosa2001@gmail.com' }).first()

  if (existing) {
    console.log('ℹ️  Usuário ADM já existe — seed ignorado para preservar dados.')
    return
  }

  // Hash da senha padrão: "admin123"
  const passwordHash = await bcrypt.hash('admin123', 10)

  await knex('users').insert([
    {
      id: 1,
      name: 'Euclides Barbosa Pereira',
      email: 'euclidesbarbosa2001@gmail.com',
      password_hash: passwordHash,
      profile: 'ADM',
      active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ])

  console.log('✅ Usuário ADM criado com sucesso!')
  console.log('📧 Email: euclidesbarbosa2001@gmail.com')
  console.log('🔑 Senha: admin123')
  console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!')
}
