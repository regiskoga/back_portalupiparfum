const express = require('express')
const path    = require('path')
const { db }  = require('./models/db')

const authRoutes      = require('./routes/auth')
const usersRoutes     = require('./routes/users')
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
const migrationsRoutes   = require('./routes/migrations')
const parametersRoutes   = require('./routes/parameters')
const priceListsRoutes   = require('./routes/priceLists')
const packagingTypesRoutes  = require('./routes/packagingTypes')
const freightTypesRoutes    = require('./routes/freightTypes')
const volumeDiscountsRoutes = require('./routes/volumeDiscounts')
const macerationRoutes      = require('./routes/maceration')
const catalogRoutes         = require('./routes/catalog')
const importRoutes          = require('./routes/import')

const app  = express()
const PORT = process.env.PORT || 3001

// ─── Middleware ───────────────────────────────────────────────────────────────
// CORS explícito — funciona mesmo atrás de reverse proxy (Traefik/Nginx)
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://sistema.portalupiparfum.com.br',
  'https://sistema.portalupiparfum.com.br',
  'http://api.sistema.portalupiparfum.com.br',
  'https://api.sistema.portalupiparfum.com.br',
  'http://ivxgd3e9ile1ugs25tqpka0e.187.77.227.96.sslip.io'
]

app.use((req, res, next) => {
  const origin = req.get('Origin')
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin || '*')
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Cache-Control,Pragma,Expires')
    res.set('Access-Control-Allow-Credentials', 'true')
    res.set('Access-Control-Max-Age', '86400')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

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
  // Rotas públicas (sem autenticação)
  app.use('/api/auth',          authRoutes)
  app.use('/api/public/catalog', catalogRoutes)
  
  // Rotas protegidas
  app.use('/api/users',     usersRoutes)
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
  app.use('/api/migrations',  migrationsRoutes)
  app.use('/api/parameters',  parametersRoutes)
  app.use('/api/price-lists', priceListsRoutes)
  app.use('/api/packaging-types',  packagingTypesRoutes)
  app.use('/api/freight-types',    freightTypesRoutes)
  app.use('/api/volume-discounts', volumeDiscountsRoutes)
  app.use('/api/maceration',       macerationRoutes)
  app.use('/api/import',           importRoutes)

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

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

// ─── Start ────────────────────────────────────────────────────────────────────
;(async () => {
  try {
    const [batch, ran] = await db.migrate.latest()
    if (ran.length === 0) {
      console.log('✅ Migrations: nenhuma pendente')
    } else {
      console.log(`✅ Migrations executadas (batch ${batch}): ${ran.map(m => m.split('/').pop()).join(', ')}`)
    }
  } catch (err) {
    console.error('❌ Erro ao rodar migrations:', err.message)
    process.exit(1)
  }

  app.listen(PORT, () => {
  console.log(`\n🌸 Perfumaria API running on http://localhost:${PORT}`)
  console.log(`\n── AUTH ──────────────────────────────────────────`)
  console.log(`   POST  /api/auth/login`)
  console.log(`   POST  /api/auth/logout`)
  console.log(`   GET   /api/auth/verify`)
  console.log(`   POST  /api/auth/change-password`)
  console.log(`\n── USERS ─────────────────────────────────────────`)
  console.log(`   GET   /api/users`)
  console.log(`   GET   /api/users/:id`)
  console.log(`   POST  /api/users`)
  console.log(`   PUT   /api/users/:id`)
  console.log(`   DELETE /api/users/:id`)
  console.log(`   POST  /api/users/:id/reset-password`)
  console.log(`\n── INSUMOS ───────────────────────────────────────`)
  console.log(`   GET   /api/supplies`)
  console.log(`   GET   /api/supplies/stats`)
  console.log(`   GET   /api/supplies/:id`)
  console.log(`   POST  /api/supplies`)
  console.log(`   PUT   /api/supplies/:id`)
  console.log(`   PATCH /api/supplies/:id`)
  console.log(`   PATCH /api/supplies/:id/toggle-open`)
  console.log(`   DELETE /api/supplies/:id`)
  console.log(`\n── FORNECEDORES ──────────────────────────────────`)
  console.log(`   GET   /api/suppliers`)
  console.log(`   GET   /api/suppliers/:id`)
  console.log(`   POST  /api/suppliers`)
  console.log(`   PUT   /api/suppliers/:id`)
  console.log(`   PATCH /api/suppliers/:id`)
  console.log(`   PATCH /api/suppliers/:id/reativar`)
  console.log(`   DELETE /api/suppliers/:id`)
  console.log(`\n── CLIENTES ──────────────────────────────────────`)
  console.log(`   GET   /api/customers`)
  console.log(`   GET   /api/customers/stats`)
  console.log(`   GET   /api/customers/:id`)
  console.log(`   POST  /api/customers`)
  console.log(`   PATCH /api/customers/:id`)
  console.log(`   DELETE /api/customers/:id`)
  console.log(`   GET   /api/customers/:id/orders`)
  console.log(`\n── PRODUTOS ──────────────────────────────────────`)
  console.log(`   GET   /api/products`)
  console.log(`   GET   /api/products/stats`)
  console.log(`   GET   /api/products/:id`)
  console.log(`   POST  /api/products`)
  console.log(`   PUT   /api/products/:id`)
  console.log(`   PATCH /api/products/:id`)
  console.log(`   DELETE /api/products/:id`)
  console.log(`\n── FÓRMULAS ──────────────────────────────────────`)
  console.log(`   GET   /api/formulas`)
  console.log(`   GET   /api/formulas/:id`)
  console.log(`   GET   /api/formulas/:id/items`)
  console.log(`   POST  /api/formulas`)
  console.log(`   PUT   /api/formulas/:id`)
  console.log(`   PATCH /api/formulas/:id`)
  console.log(`   DELETE /api/formulas/:id`)
  console.log(`   POST  /api/formulas/:id/validate`)
  console.log(`\n── LOTES ─────────────────────────────────────────`)
  console.log(`   GET   /api/batches`)
  console.log(`   GET   /api/batches/stats`)
  console.log(`   GET   /api/batches/next-code`)
  console.log(`   GET   /api/batches/stock-summary`)
  console.log(`   GET   /api/batches/formula-info/:formula_id`)
  console.log(`   POST  /api/batches/merge`)
  console.log(`   POST  /api/batches/update-maceration-status`)
  console.log(`   GET   /api/batches/:id`)
  console.log(`   GET   /api/batches/:id/can-bottle`)
  console.log(`   POST  /api/batches`)
  console.log(`   PUT   /api/batches/:id`)
  console.log(`   PATCH /api/batches/:id`)
  console.log(`   DELETE /api/batches/:id`)
  console.log(`   POST  /api/batches/:id/start-maceration`)
  console.log(`\n── ENVASES ───────────────────────────────────────`)
  console.log(`   GET   /api/bottlings`)
  console.log(`   GET   /api/bottlings/stats`)
  console.log(`   GET   /api/bottlings/stock-summary`)
  console.log(`   GET   /api/bottlings/available-batches`)
  console.log(`   GET   /api/bottlings/in-maceration`)
  console.log(`   GET   /api/bottlings/:id`)
  console.log(`   POST  /api/bottlings`)
  console.log(`   PATCH /api/bottlings/:id`)
  console.log(`   DELETE /api/bottlings/:id`)
  console.log(`\n── PEDIDOS ───────────────────────────────────────`)
  console.log(`   GET   /api/orders`)
  console.log(`   GET   /api/orders/:id`)
  console.log(`   POST  /api/orders  (Motor de Decisão)`)
  console.log(`   POST  /api/orders/check-gifts`)
  console.log(`   POST  /api/orders/apply-kit`)
  console.log(`   PATCH /api/orders/:id/status`)
  console.log(`   PATCH /api/orders/:id/coupon`)
  console.log(`   GET   /api/orders/:id/automatic-orders`)
  console.log(`   PATCH /api/orders/:orderId/items/:itemId`)
  console.log(`   PATCH /api/orders/:orderId/items/:itemId/bottling`)
  console.log(`\n── KITS ──────────────────────────────────────────`)
  console.log(`   GET   /api/kits`)
  console.log(`   GET   /api/kits/:id`)
  console.log(`   POST  /api/kits`)
  console.log(`   PATCH /api/kits/:id`)
  console.log(`   DELETE /api/kits/:id`)
  console.log(`   POST  /api/kits/calculate-price`)
  console.log(`\n── CUPONS ────────────────────────────────────────`)
  console.log(`   GET   /api/coupons`)
  console.log(`   GET   /api/coupons/stats`)
  console.log(`   GET   /api/coupons/:code`)
  console.log(`   POST  /api/coupons`)
  console.log(`   POST  /api/coupons/validate`)
  console.log(`   PATCH /api/coupons/:id`)
  console.log(`   DELETE /api/coupons/:id`)
  console.log(`\n── PERDAS / DOAÇÕES / TRANSFERÊNCIAS ─────────────`)
  console.log(`   GET   /api/losses  |  POST  |  PATCH /:id  |  DELETE /:id`)
  console.log(`   GET   /api/donations  |  POST  |  PATCH /:id  |  DELETE /:id`)
  console.log(`   GET   /api/batch-transfers  |  POST`)
  console.log(`   GET   /api/batch-transfers/batch/:batch_id`)
  console.log(`\n── OCORRÊNCIAS ───────────────────────────────────`)
  console.log(`   GET   /api/occurrences`)
  console.log(`   GET   /api/occurrences/stats`)
  console.log(`   GET   /api/occurrences/order/:order_id`)
  console.log(`   GET   /api/occurrences/:id`)
  console.log(`   POST  /api/occurrences`)
  console.log(`   PATCH /api/occurrences/:id`)
  console.log(`   PATCH /api/occurrences/:id/status`)
  console.log(`   POST  /api/occurrences/:id/use-credit`)
  console.log(`\n── RASTREABILIDADE ───────────────────────────────`)
  console.log(`   GET   /api/traceability/bottling/:bottling_id`)
  console.log(`   GET   /api/traceability/supply/:supply_id`)
  console.log(`   GET   /api/traceability/logs/:entity_type/:entity_id`)
  console.log(`   GET   /api/traceability/chain/:type/:id`)
  console.log(`\n── BRINDES / LOGS / DASHBOARD ────────────────────`)
  console.log(`   GET   /api/customer-gifts  |  POST  |  GET /stats  |  GET /customer/:id`)
  console.log(`   GET   /api/logs  |  GET /stats  |  GET /entity/:type/:id`)
  console.log(`   GET   /api/dashboard/overview  |  /financial  |  /production  |  /alerts  |  /sales`)
  console.log(`\n── PARÂMETROS / PREÇOS / EMBALAGENS ──────────────`)
  console.log(`   GET   /api/parameters  |  PUT /`)
  console.log(`   GET   /api/price-lists  |  POST  |  PATCH /:id  |  DELETE /:id`)
  console.log(`   GET   /api/packaging-types  |  POST  |  PUT /:id  |  PATCH /:id  |  DELETE /:id`)
  console.log(`   GET   /api/volume-discounts  |  GET /resolve  |  POST  |  PATCH /:id  |  DELETE /:id`)
  console.log(`\n── SISTEMA ───────────────────────────────────────`)
  console.log(`   GET   /api/system-rules  |  POST  |  GET /:id  |  PUT /:id  |  PATCH /:id/toggle`)
  console.log(`   GET   /api/system-rules/admin/notifications  |  /admin/stats`)
  console.log(`   GET   /api/user-permissions/profiles  |  /screens  |  /check/:profileId/:key/:action`)
  console.log(`   GET   /api/migrations/status  |  POST /run  |  POST /deploy`)
  console.log(`   GET   /api/health`)
  console.log()
  })
})()

module.exports = app
