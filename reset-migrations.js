// Script para resetar migrations corrompidas
require('dotenv').config()
const knex = require('knex')

const config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 6543,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  }
}

async function resetMigrations() {
  const db = knex(config)
  
  try {
    console.log('🔄 Conectando ao Supabase...')
    
    // Testar conexão
    await db.raw('SELECT 1')
    console.log('✅ Conexão estabelecida!')
    
    // Limpar tabela de migrations
    console.log('🗑️ Limpando estado das migrations...')
    await db.raw('DROP TABLE IF EXISTS knex_migrations CASCADE')
    await db.raw('DROP TABLE IF EXISTS knex_migrations_lock CASCADE')
    
    console.log('✅ Estado das migrations resetado!')
    console.log('🚀 Agora você pode executar: npm run migrate:latest')
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
    
    if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 Possíveis soluções:')
      console.log('1. Verificar se o projeto Supabase está ativo')
      console.log('2. Tentar porta 5432 em vez de 6543')
      console.log('3. Verificar firewall/proxy corporativo')
    }
  } finally {
    await db.destroy()
  }
}

resetMigrations()