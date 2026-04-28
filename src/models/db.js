// Conexão com PostgreSQL usando Knex.js
require('dotenv').config()
const knex = require('knex')
const knexConfig = require('../../knexfile')

// Selecionar ambiente (development ou production)
const environment = process.env.NODE_ENV || 'development'
const config = knexConfig[environment]

// Criar instância do Knex
const db = knex(config)

// Testar conexão
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ Conectado ao PostgreSQL (Coolify)')
  })
  .catch((err) => {
    console.error('❌ Erro ao conectar ao PostgreSQL:', err.message)
    process.exit(1)
  })

// Exportar instância do Knex
module.exports = { db }
