// Teste simples dos CRUDs
const axios = require('axios')

const API_BASE = 'http://localhost:3001/api'

async function testSimple() {
  try {
    console.log('🧪 TESTE SIMPLES DOS CRUDs\n')
    
    // 1. Testar health
    console.log('1️⃣ Testando health...')
    const health = await axios.get(`${API_BASE}/health`)
    console.log('✅ API funcionando:', health.data.status)
    
    // 2. Listar fornecedores
    console.log('\n2️⃣ Listando fornecedores...')
    const suppliers = await axios.get(`${API_BASE}/suppliers`)
    console.log(`✅ ${suppliers.data.length} fornecedores encontrados`)
    
    if (suppliers.data.length > 0) {
      const firstSupplier = suppliers.data[0]
      console.log(`   Primeiro: ${firstSupplier.name} (ID: ${firstSupplier.id})`)
      
      // 3. Criar insumo simples
      console.log('\n3️⃣ Criando insumo...')
      const newSupply = {
        name: 'Teste Essência',
        type: 'Essence',
        supplier_id: firstSupplier.id,
        unit: 'ml',
        quantity_purchased: 100,
        total_amount_paid: 50.00,
        batch: 'TEST001',
        notes: 'Teste'
      }
      
      const created = await axios.post(`${API_BASE}/supplies`, newSupply)
      console.log('✅ Insumo criado:', created.data.name, `(ID: ${created.data.id})`)
      
      // 4. Listar insumos
      console.log('\n4️⃣ Listando insumos...')
      const supplies = await axios.get(`${API_BASE}/supplies`)
      console.log(`✅ ${supplies.data.data.length} insumos encontrados`)
      
      // 5. Deletar insumo
      console.log('\n5️⃣ Deletando insumo...')
      await axios.delete(`${API_BASE}/supplies/${created.data.id}`)
      console.log('✅ Insumo deletado')
      
      // 6. Testar cliente
      console.log('\n6️⃣ Testando cliente...')
      const newCustomer = {
        name: 'João Teste',
        tax_id: '123.456.789-00',
        phone: '(11) 99999-0001',
        email: 'joao@teste.com'
      }
      
      const customer = await axios.post(`${API_BASE}/customers`, newCustomer)
      console.log('✅ Cliente criado:', customer.data.name)
      
      console.log('\n🎉 TODOS OS TESTES BÁSICOS PASSARAM!')
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message)
  }
}

testSimple()