const express = require('express')
const cors    = require('cors')
const path    = require('path')

const suppliesRoutes  = require('./routes/insumos')
const suppliersRoutes = require('./routes/fornecedores')
const customersRoutes = require('./routes/clientes')
const productsRoutes  = require('./routes/products')
const formulasRoutes  = require('./routes/formulas')
const batchesRoutes   = require('./routes/batches')
const bottlingsRoutes = require('./routes/bottlings')
const activityLogsRoutes = require('./routes/activityLogs')
const dashboardRoutes = require('./routes/dashboard')
const ordersRoutes    = require('./routes/orders')
const kitsRoutes      = require('./routes/kits')
const couponsRoutes   = require('./routes/coupons')
const lossesRoutes    = require('./routes/losses')
const donationsRoutes = require('./routes/donations')
const batchTransfersRoutes = require('./routes/batchTransfers')
const occurrencesRoutes = require('./routes/occurrences')
const traceabilityRoutes = require('./routes/traceability')
const customerGiftsRoutes = require('./routes/customerGifts')
const systemRulesRoutes = require('./routes/systemRules')
const userPermissionsRoutes = require('./routes/userPermissions')
const migrationsRoutes = require('./routes/migrations')

const app  = express()
const PORT = process.env.PORT || 3001

// ─── Middleware ───────────────────────────────────────────────────────────────
// CORS configurado para aceitar requisições do frontend
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://sistema.portalupiparfum.com.br',
      'https://sistema.portalupiparfum.com.br',
      'http://api.sistema.portalupiparfum.com.br',
      'https://api.sistema.portalupiparfum.com.br',
      'http://ivxgd3e9ile1ugs25tqpka0e.187.77.227.96.sslip.io'
    ]
    
    // Permitir requisições sem origin (como Postman) ou de origens permitidas
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      console.log(`❌ CORS bloqueado para origem: ${origin}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  exposedHeaders: ['Cache-Control', 'Pragma', 'Expires'],
  credentials: true,
  optionsSuccessStatus: 204,
  preflightContinue: false
}

app.use(cors(corsOptions))

// Debug CORS detalhado
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url}`)
  console.log(`   Origin: ${req.get('Origin') || 'none'}`)
  console.log(`   Host: ${req.get('Host')}`)
  next()
})
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Middleware para evitar cache em rotas de API
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  })
  next()
})

// Request logger (dev)
app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`)
  next()
})

// Debug routes
console.log('🔍 Carregando routes...')
console.log('🔍 suppliesRoutes:', typeof suppliesRoutes)
console.log('🔍 suppliersRoutes:', typeof suppliersRoutes)
console.log('🔍 customersRoutes:', typeof customersRoutes)
console.log('🔍 migrationsRoutes:', typeof migrationsRoutes)
console.log('🔍 userPermissionsRoutes:', typeof userPermissionsRoutes)

// ─── Routes ───────────────────────────────────────────────────────────────────
try {
  app.use('/api/supplies',  suppliesRoutes)
  app.use('/api/suppliers', suppliersRoutes)
  app.use('/api/customers', customersRoutes)
  app.use('/api/products',  productsRoutes)
  app.use('/api/formulas',  formulasRoutes)
  app.use('/api/batches',   batchesRoutes)
  app.use('/api/bottlings', bottlingsRoutes)
  app.use('/api/logs',      activityLogsRoutes)
  app.use('/api/dashboard', dashboardRoutes)
  app.use('/api/orders',    ordersRoutes)
  app.use('/api/kits',      kitsRoutes)
  app.use('/api/coupons',   couponsRoutes)
  app.use('/api/losses',    lossesRoutes)
  app.use('/api/donations', donationsRoutes)
  app.use('/api/batch-transfers', batchTransfersRoutes)
  app.use('/api/occurrences', occurrencesRoutes)
  app.use('/api/traceability', traceabilityRoutes)
  app.use('/api/customer-gifts', customerGiftsRoutes)
  app.use('/api/system-rules', systemRulesRoutes)
  app.use('/api/user-permissions', userPermissionsRoutes)
  app.use('/api/migrations', migrationsRoutes)
  
  console.log('✅ Todas as rotas carregadas com sucesso')
} catch (routeError) {
  console.error('❌ Erro ao carregar rotas:', routeError)
}

// Health check com CORS headers explícitos
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    ts: new Date().toISOString(),
    cors: 'enabled'
  })
})

// CORS test endpoint
app.get('/api/cors-test', (_req, res) => {
  res.json({ 
    message: 'CORS está funcionando!',
    timestamp: new Date().toISOString(),
    origin: _req.get('Origin') || 'no-origin',
    host: _req.get('Host')
  })
})

// OPTIONS handler explícito para todas as rotas /api/*
app.options('/api/*', (_req, res) => {
  res.sendStatus(204)
})

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌸 Parfumerie API running on http://localhost:${PORT}`)
  console.log(`   Available endpoints:`)
  console.log(`   GET  /api/supplies`)
  console.log(`   POST /api/supplies`)
  console.log(`   GET  /api/supplies/stats`)
  console.log(`   GET  /api/suppliers`)
  console.log(`   POST /api/suppliers`)
  console.log(`   GET  /api/customers`)
  console.log(`   POST /api/customers`)
  console.log(`   GET  /api/products`)
  console.log(`   POST /api/products`)
  console.log(`   GET  /api/formulas`)
  console.log(`   POST /api/formulas`)
  console.log(`   GET  /api/batches`)
  console.log(`   POST /api/batches`)
  console.log(`   GET  /api/bottlings`)
  console.log(`   POST /api/bottlings`)
  console.log(`   GET  /api/orders`)
  console.log(`   POST /api/orders (Motor de Decisão)`)
  console.log(`   POST /api/orders/check-gifts (Verificar Brindes)`)
  console.log(`   GET  /api/orders/:id/automatic-orders`)
  console.log(`   GET  /api/kits`)
  console.log(`   POST /api/kits`)
  console.log(`   GET  /api/coupons`)
  console.log(`   POST /api/coupons`)
  console.log(`   POST /api/coupons/validate`)
  console.log(`   GET  /api/losses`)
  console.log(`   POST /api/losses`)
  console.log(`   GET  /api/losses/stats`)
  console.log(`   GET  /api/donations`)
  console.log(`   POST /api/donations`)
  console.log(`   GET  /api/donations/stats`)
  console.log(`   GET  /api/batch-transfers`)
  console.log(`   POST /api/batch-transfers`)
  console.log(`   GET  /api/batch-transfers/batch/:batch_id`)
  console.log(`   GET  /api/batch-transfers/stats`)
  console.log(`   GET  /api/occurrences`)
  console.log(`   POST /api/occurrences`)
  console.log(`   GET  /api/occurrences/stats`)
  console.log(`   GET  /api/occurrences/order/:order_id`)
  console.log(`   GET  /api/occurrences/:id`)
  console.log(`   PATCH /api/occurrences/:id`)
  console.log(`   PATCH /api/occurrences/:id/status`)
  console.log(`   POST /api/occurrences/:id/use-credit`)
  console.log(`   GET  /api/traceability/bottling/:id`)
  console.log(`   GET  /api/traceability/supply/:id`)
  console.log(`   GET  /api/traceability/logs/:entity_type/:entity_id`)
  console.log(`   GET  /api/traceability/chain/:type/:id`)
  console.log(`   GET  /api/customer-gifts/check-duplicate`)
  console.log(`   POST /api/customer-gifts`)
  console.log(`   GET  /api/customer-gifts/stats`)
  console.log(`   GET  /api/customer-gifts/customer/:customer_id`)
  console.log(`   GET  /api/system-rules`)
  console.log(`   POST /api/system-rules (Admin)`)
  console.log(`   GET  /api/system-rules/:id`)
  console.log(`   PUT  /api/system-rules/:id (Admin)`)
  console.log(`   PATCH /api/system-rules/:id/toggle (Admin)`)
  console.log(`   GET  /api/system-rules/:id/history`)
  console.log(`   GET  /api/system-rules/admin/notifications`)
  console.log(`   GET  /api/system-rules/admin/stats`)
  console.log(`   GET  /api/dashboard/overview`)
  console.log(`   GET  /api/dashboard/financial`)
  console.log(`   GET  /api/dashboard/production`)
  console.log(`   GET  /api/dashboard/alerts`)
  console.log(`   GET  /api/dashboard/sales\n`)
})

module.exports = app
