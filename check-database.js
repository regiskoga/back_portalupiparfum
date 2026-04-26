// Script para verificar estado do banco
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

async function checkDatabase() {
  const db = knex(config)
  
  try {
    console.log('🔍 Verificando tabelas existentes...')
    
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    
    console.log('📋 Tabelas encontradas:')
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`)
    })
    
    if (tables.rows.length === 0) {
      console.log('✅ Banco vazio - pronto para migrations!')
    } else {
      console.log('\n🗑️ Limpando todas as tabelas...')
      
      // Dropar todas as tabelas
      for (const row of tables.rows) {
        if (row.table_name !== 'knex_migrations' && row.table_name !== 'knex_migrations_lock') {
          await db.raw(`DROP TABLE IF EXISTS "${row.table_name}" CASCADE`)
          console.log(`  ✅ Removida: ${row.table_name}`)
        }
      }
      
      console.log('✅ Banco limpo - pronto para migrations!')
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await db.destroy()
  }
}

checkDatabase()