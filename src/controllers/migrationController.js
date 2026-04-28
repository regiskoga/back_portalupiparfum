const knex = require('../db/connection')

// ─── Executar Migrations ──────────────────────────────────────────────────────
exports.runMigrations = async (req, res) => {
  try {
    console.log('🔄 Executando migrations...')
    
    const [batchNo, log] = await knex.migrate.latest()
    
    if (log.length === 0) {
      console.log('✅ Nenhuma migration pendente')
      return res.json({ 
        message: 'Nenhuma migration pendente',
        batch: batchNo,
        migrations: []
      })
    }

    console.log(`✅ Migrations executadas - Batch ${batchNo}:`)
    log.forEach(migration => console.log(`   - ${migration}`))

    res.json({
      message: 'Migrations executadas com sucesso',
      batch: batchNo,
      migrations: log
    })
  } catch (error) {
    console.error('❌ Erro ao executar migrations:', error)
    res.status(500).json({ 
      error: 'Erro ao executar migrations',
      details: error.message 
    })
  }
}

// ─── Executar Seeds ────────────────────────────────────────────────────────────
exports.runSeeds = async (req, res) => {
  try {
    console.log('🌱 Executando seeds...')
    
    const [log] = await knex.seed.run()
    
    console.log('✅ Seeds executados:')
    log.forEach(seed => console.log(`   - ${seed}`))

    res.json({
      message: 'Seeds executados com sucesso',
      seeds: log
    })
  } catch (error) {
    console.error('❌ Erro ao executar seeds:', error)
    res.status(500).json({ 
      error: 'Erro ao executar seeds',
      details: error.message 
    })
  }
}

// ─── Status das Migrations ────────────────────────────────────────────────────
exports.getMigrationStatus = async (req, res) => {
  try {
    const completed = await knex.migrate.list()
    
    res.json({
      completed: completed[0],
      pending: completed[1]
    })
  } catch (error) {
    console.error('❌ Erro ao verificar status das migrations:', error)
    res.status(500).json({ 
      error: 'Erro ao verificar status das migrations',
      details: error.message 
    })
  }
}

// ─── Setup Completo (Migrations + Seeds) ──────────────────────────────────────
exports.setupDatabase = async (req, res) => {
  try {
    console.log('🚀 Iniciando setup completo do banco...')
    
    // 1. Executar migrations
    console.log('🔄 Executando migrations...')
    const [batchNo, migrationLog] = await knex.migrate.latest()
    
    if (migrationLog.length > 0) {
      console.log(`✅ Migrations executadas - Batch ${batchNo}:`)
      migrationLog.forEach(migration => console.log(`   - ${migration}`))
    } else {
      console.log('✅ Nenhuma migration pendente')
    }

    // 2. Executar seeds
    console.log('🌱 Executando seeds...')
    const [seedLog] = await knex.seed.run()
    
    console.log('✅ Seeds executados:')
    seedLog.forEach(seed => console.log(`   - ${seed}`))

    console.log('🎉 Setup do banco concluído com sucesso!')

    res.json({
      message: 'Setup do banco concluído com sucesso',
      migrations: {
        batch: batchNo,
        executed: migrationLog
      },
      seeds: {
        executed: seedLog
      }
    })
  } catch (error) {
    console.error('❌ Erro no setup do banco:', error)
    res.status(500).json({ 
      error: 'Erro no setup do banco',
      details: error.message 
    })
  }
}

// ─── Deploy em Produção ───────────────────────────────────────────────────────
exports.deployMigrations = async (req, res) => {
  try {
    console.log('🚀 Iniciando deploy das migrations via API...')
    
    // Testar conexão
    await knex.raw('SELECT 1')
    console.log('✅ Conexão com banco OK')
    
    // Verificar migrations pendentes
    const [completed, pending] = await knex.migrate.list()
    
    console.log(`📊 Status atual:`)
    console.log(`   - Migrations executadas: ${completed.length}`)
    console.log(`   - Migrations pendentes: ${pending.length}`)
    
    if (pending.length === 0) {
      return res.json({
        message: 'Nenhuma migration pendente',
        status: 'up-to-date',
        completed: completed.length,
        pending: 0
      })
    }
    
    // Executar migrations
    console.log('🔄 Executando migrations pendentes...')
    const [batchNo, migrationLog] = await knex.migrate.latest()
    
    console.log(`✅ Migrations executadas - Batch ${batchNo}`)
    migrationLog.forEach(migration => console.log(`   - ${migration}`))
    
    // Executar seeds
    console.log('🌱 Executando seeds...')
    const [seedLog] = await knex.seed.run()
    
    console.log('✅ Seeds executados:')
    seedLog.forEach(seed => console.log(`   - ${seed}`))
    
    res.json({
      message: 'Deploy executado com sucesso',
      status: 'deployed',
      migrations: {
        batch: batchNo,
        executed: migrationLog,
        total: completed.length + migrationLog.length
      },
      seeds: {
        executed: seedLog
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Erro no deploy:', error)
    res.status(500).json({ 
      error: 'Erro no deploy das migrations',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

// ─── Testar Conexão ────────────────────────────────────────────────────────────
exports.testConnection = async (req, res) => {
  try {
    await knex.raw('SELECT 1')
    res.json({ 
      message: 'Conexão com o banco OK',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Erro de conexão:', error)
    res.status(500).json({ 
      error: 'Erro de conexão com o banco',
      details: error.message 
    })
  }
}