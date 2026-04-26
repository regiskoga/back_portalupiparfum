// Script para corrigir todos os controllers
const fs = require('fs')
const path = require('path')

function fixController(filePath, tableName) {
  console.log(`🔧 Corrigindo ${filePath}...`)
  
  let content = fs.readFileSync(filePath, 'utf8')
  
  // Corrigir problemas comuns do Knex com PostgreSQL
  content = content.replace(
    /\.where\('([^']+)', req\.params\.id\)/g,
    ".where('$1', parseInt(req.params.id))"
  )
  
  content = content.replace(
    /\.where\({ id: req\.params\.id }\)/g,
    ".where({ id: parseInt(req.params.id) })"
  )
  
  // Corrigir returning com PostgreSQL
  content = content.replace(
    /\.returning\('id'\)/g,
    ".returning('*')"
  )
  
  fs.writeFileSync(filePath, content)
  console.log(`✅ ${filePath} corrigido`)
}

// Corrigir todos os controllers
const controllersDir = path.join(__dirname, 'src', 'controllers')
const controllers = [
  'insumosController.js',
  'fornecedoresController.js', 
  'clientesController.js'
]

controllers.forEach(controller => {
  const filePath = path.join(controllersDir, controller)
  if (fs.existsSync(filePath)) {
    fixController(filePath)
  }
})

console.log('🎉 Todos os controllers corrigidos!')