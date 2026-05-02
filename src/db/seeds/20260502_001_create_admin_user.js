/**
 * Seed: Criar Usuário Administrador
 * Cria o usuário ADM inicial do sistema
 */

const bcrypt = require('bcrypt')

exports.seed = async function(knex) {
  // Limpar tabelas (apenas em desenvolvimento)
  await knex('sessions').del()
  await knex('users').del()
  
  // Hash da senha padrão: "admin123"
  const passwordHash = await bcrypt.hash('admin123', 10)
  
  // Inserir usuário ADM
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
