// Script de teste para verificar integração frontend-backend
const axios = require('axios')

const API_BASE = 'http://localhost:3001/api'

async function testEndpoints() {
  console.log('🧪 Testando endpoints do frontend...\n')
  
  try {
    // Test Products
    console.log('📦 Testando Products...')
    const products = await axios.get(`${API_BASE}/products`)
    console.log(`✅ GET /products - ${products.data.length} produtos encontrados`)
    
    // Test Formulas
    console.log('🧪 Testando Formulas...')
    const formulas = await axios.get(`${API_BASE}/formulas`)
    console.log(`✅ GET /formulas - ${formulas.data.length} fórmulas encontradas`)
    
    // Test Batches
    console.log('🏭 Testando Batches...')
    const batches = await axios.get(`${API_BASE}/batches`)
    console.log(`✅ GET /batches - ${batches.data.length} lotes encontrados`)
    
    // Test Supplies (for formula creation)
    console.log('📋 Testando Supplies...')
    const supplies = await axios.get(`${API_BASE}/supplies?limit=5`)
    console.log(`✅ GET /supplies - ${supplies.data.data.length} insumos encontrados`)
    
    console.log('\n🎉 Todos os endpoints estão funcionando!')
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message)
  }
}

testEndpoints()