// Script para testar se as migrations estão no lugar correto
require('dotenv').config()
const knex = require('knex')
const config = require('./knexfile.js')

async function testMigrations() {
  console.log('🔍 Testando configuração de migrations...')
  
  const db = knex(config[process.env.NODE_ENV || 'production'])
  
  try {
    // Verificar se consegue listar migrations
    const migrations = await db.migrate.list()
    console.log('✅ Migrations encontradas:', migrations[1].length)
    console.log('📋 Migrations pendentes:', migrations[0].length)
    
    if (migrations[0].length > 0) {
      console.log('⚠️ Há migrations pendentes para executar')
    } else {
      console.log('✅ Todas as migrations já foram executadas')
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar migrations:', error.message)
  } finally {
    await db.destroy()
  }
}

testMigrations()