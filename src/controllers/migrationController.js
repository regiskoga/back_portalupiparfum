const knex = require('../db/connection')
const fs = require('fs')
const path = require('path')

// ─── Executar SQL Direto ──────────────────────────────────────────────────────
exports.createPermissionsTables = async (req, res) => {
  try {
    console.log('🚀 Criando tabelas de permissões via SQL direto...')
    
    // Testar conexão primeiro
    try {
      await knex.raw('SELECT 1 as test')
      console.log('✅ Conexão com banco OK')
    } catch (connError) {
      console.error('❌ Erro de conexão:', connError.message)
      return res.status(500).json({
        error: 'Erro de conexão com o banco de dados',
        details: connError.message,
        suggestion: 'Verifique se o PostgreSQL está rodando e as credenciais estão corretas'
      })
    }
    
    // Ler arquivo SQL
    const sqlPath = path.join(__dirname, '../../create-permissions-tables.sql')
    
    if (!fs.existsSync(sqlPath)) {
      return res.status(500).json({
        error: 'Arquivo SQL não encontrado',
        path: sqlPath
      })
    }
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')
    console.log('📄 Arquivo SQL carregado, tamanho:', sqlContent.length, 'caracteres')
    
    // Dividir SQL em comandos separados (por ponto e vírgula)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))
    
    console.log('📊 Executando', commands.length, 'comandos SQL...')
    
    const results = []
    
    // Executar cada comando separadamente
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i]
      if (command.trim()) {
        try {
          console.log(`🔄 Executando comando ${i + 1}/${commands.length}`)
          const result = await knex.raw(command)
          results.push({ command: i + 1, status: 'success', rows: result.rowCount || 0 })
        } catch (cmdError) {
          console.error(`❌ Erro no comando ${i + 1}:`, cmdError.message)
          // Continuar mesmo com erro (pode ser comando já executado)
          results.push({ command: i + 1, status: 'error', error: cmdError.message })
        }
      }
    }
    
    console.log('✅ Execução SQL concluída!')
    
    // Verificar se as tabelas foram criadas
    const verification = {}
    const tables = ['user_profiles', 'system_screens', 'profile_permissions']
    
    for (const table of tables) {
      try {
        const exists = await knex.schema.hasTable(table)
        if (exists) {
          const count = await knex(table).count('* as total').first()
          verification[table] = { exists: true, count: parseInt(count.total) }
        } else {
          verification[table] = { exists: false, count: 0 }
        }
      } catch (verifyError) {
        verification[table] = { exists: false, error: verifyError.message }
      }
    }
    
    res.json({
      message: 'Execução SQL concluída',
      status: 'executed',
      timestamp: new Date().toISOString(),
      commands_executed: results.length,
      results: results,
      verification: verification
    })
    
  } catch (error) {
    console.error('❌ Erro geral ao criar tabelas:', error)
    res.status(500).json({ 
      error: 'Erro ao criar tabelas de permissões',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

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

// ─── Verificar se Tabelas Existem ─────────────────────────────────────────────
exports.checkPermissionsTables = async (req, res) => {
  try {
    console.log('🔍 Verificando conexão e tabelas...')
    
    // Primeiro testar conexão básica
    try {
      await knex.raw('SELECT 1 as test')
      console.log('✅ Conexão com banco OK')
    } catch (connError) {
      console.error('❌ Erro de conexão:', connError.message)
      return res.status(500).json({
        status: 'connection_error',
        error: 'Erro de conexão com o banco de dados',
        details: connError.message,
        suggestion: 'Verifique se o PostgreSQL está rodando e as credenciais estão corretas'
      })
    }
    
    const tables = ['user_profiles', 'system_screens', 'profile_permissions']
    const results = {}
    
    for (const table of tables) {
      try {
        const exists = await knex.schema.hasTable(table)
        if (exists) {
          const count = await knex(table).count('* as total').first()
          results[table] = { exists: true, count: parseInt(count.total) }
        } else {
          results[table] = { exists: false, count: 0 }
        }
      } catch (tableError) {
        console.error(`❌ Erro ao verificar tabela ${table}:`, tableError.message)
        results[table] = { exists: false, count: 0, error: tableError.message }
      }
    }
    
    const allExist = Object.values(results).every(r => r.exists)
    
    res.json({
      status: allExist ? 'ready' : 'missing_tables',
      tables: results,
      message: allExist ? 'Todas as tabelas existem' : 'Algumas tabelas estão faltando',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Erro geral ao verificar tabelas:', error)
    res.status(500).json({ 
      status: 'error',
      error: 'Erro ao verificar tabelas',
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