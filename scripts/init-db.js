#!/usr/bin/env node

/**
 * Script de inicialização do banco de dados
 * Executa migrations e seeds automaticamente
 */

const knex = require('knex')
const config = require('../knexfile.js')

async function initDatabase() {
  console.log('🚀 Iniciando configuração do banco de dados...')
  
  const db = knex(config.production)
  
  try {
    // Testar conexão
    console.log('🔍 Testando conexão com o banco...')
    await db.raw('SELECT 1')
    console.log('✅ Conexão estabelecida com sucesso!')
    
    // Executar migrations
    console.log('📋 Executando migrations...')
    const [batchNo, log] = await db.migrate.latest()
    
    if (log.length === 0) {
      console.log('✅ Banco já está atualizado!')
    } else {
      console.log(`✅ Executadas ${log.length} migrations:`)
      log.forEach(migration => console.log(`   - ${migration}`))
    }
    
    // Executar seeds
    console.log('🌱 Executando seeds...')
    await db.seed.run()
    console.log('✅ Seeds executados com sucesso!')
    
    console.log('🎉 Banco de dados configurado com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro ao configurar banco:', error.message)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  initDatabase()
}

module.exports = { initDatabase }