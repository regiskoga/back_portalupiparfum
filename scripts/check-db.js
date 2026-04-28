#!/usr/bin/env node

/**
 * Script para verificar o estado do banco de dados
 */

const knex = require('knex')
const config = require('../knexfile.js')

async function checkDatabase() {
  console.log('🔍 Verificando estado do banco de dados...')
  
  const db = knex(config.production)
  
  try {
    // Verificar tabelas principais
    const tables = [
      'suppliers', 'supplies', 'customers', 'products', 
      'formulas', 'batches', 'system_rules', 'kits', 'coupons'
    ]
    
    for (const table of tables) {
      const count = await db(table).count('* as total').first()
      console.log(`📊 ${table}: ${count.total} registros`)
    }
    
    // Verificar algumas regras específicas
    console.log('\n🔧 Regras do Sistema:')
    const rules = await db('system_rules').select('key', 'title', 'text_value').limit(5)
    rules.forEach(rule => {
      console.log(`   - ${rule.key}: ${rule.text_value}`)
    })
    
    console.log('\n✅ Verificação concluída!')
    
  } catch (error) {
    console.error('❌ Erro ao verificar banco:', error.message)
  } finally {
    await db.destroy()
  }
}

checkDatabase()