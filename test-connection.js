// Script para testar conexão com PostgreSQL
require('dotenv').config()
const knex = require('knex')
const config = require('./knexfile.js')

async function testConnection() {
  console.log('🔍 Testando conexão com PostgreSQL...')
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Configurado' : 'NÃO CONFIGURADO')
  
  const db = knex(config[process.env.NODE_ENV || 'development'])
  
  try {
    // Testar conexão básica
    await db.raw('SELECT 1')
    console.log('✅ Conexão com PostgreSQL OK!')
    
    // Testar se as tabelas existem
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `)
    
    console.log('📋 Tabelas encontradas:', tables.rows.map(r => r.table_name))
    
    if (tables.rows.length === 0) {
      console.log('⚠️ Nenhuma tabela encontrada. Execute as migrations:')
      console.log('npm run migrate:latest')
    }
    
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message)
    console.log('\n🔧 Verifique:')
    console.log('1. Se o PostgreSQL está rodando no Coolify')
    console.log('2. Se as credenciais no .env estão corretas')
    console.log('3. Se a rede permite conexão')
  } finally {
    await db.destroy()
  }
}

testConnection()