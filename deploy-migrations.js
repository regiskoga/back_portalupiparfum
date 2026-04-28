/**
 * Script para executar migrations em produção via código
 * Execute este arquivo após o deploy para aplicar as novas tabelas
 */

const knex = require('./src/db/connection')

async function deployMigrations() {
  try {
    console.log('🚀 Iniciando deploy das migrations em produção...')
    console.log('📅', new Date().toISOString())
    
    // Testar conexão
    console.log('🔍 Testando conexão com o banco...')
    await knex.raw('SELECT 1')
    console.log('✅ Conexão OK')
    
    // Verificar migrations pendentes
    console.log('🔍 Verificando migrations pendentes...')
    const [completed, pending] = await knex.migrate.list()
    
    console.log(`📊 Status atual:`)
    console.log(`   - Migrations executadas: ${completed.length}`)
    console.log(`   - Migrations pendentes: ${pending.length}`)
    
    if (pending.length === 0) {
      console.log('✅ Nenhuma migration pendente')
      return
    }
    
    console.log('🔄 Executando migrations pendentes...')
    pending.forEach(migration => console.log(`   - ${migration}`))
    
    // Executar migrations
    const [batchNo, log] = await knex.migrate.latest()
    
    console.log(`✅ Migrations executadas com sucesso!`)
    console.log(`   - Batch: ${batchNo}`)
    log.forEach(migration => console.log(`   - ${migration}`))
    
    // Executar seeds
    console.log('🌱 Executando seeds...')
    const [seedLog] = await knex.seed.run()
    
    console.log('✅ Seeds executados:')
    seedLog.forEach(seed => console.log(`   - ${seed}`))
    
    console.log('🎉 Deploy concluído com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro no deploy:', error)
    throw error
  } finally {
    await knex.destroy()
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  deployMigrations()
    .then(() => {
      console.log('✅ Deploy finalizado')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Deploy falhou:', error)
      process.exit(1)
    })
}

module.exports = deployMigrations