// Script para testar CRUDs
const axios = require('axios')

const API_BASE = 'http://localhost:3001/api'

async function testCRUDs() {
  try {
    console.log('🧪 TESTANDO CRUDs DO PARFUMERIE\n')
    
    // 1. Testar criação de insumo
    console.log('1️⃣ Criando insumo...')
    const newSupply = {
      name: 'Essência de Rosa',
      type: 'Essence',
      supplier_id: 11, // Aromax Essências
      unit: 'ml',
      quantity_purchased: 100,
      total_amount_paid: 250.00,
      batch: 'LOTE001',
      notes: 'Essência importada'
    }
    
    const createResponse = await axios.post(`${API_BASE}/supplies`, newSupply)
    console.log('✅ Insumo criado:', createResponse.data.name)
    const supplyId = createResponse.data.id
    
    // 2. Testar listagem
    console.log('\n2️⃣ Listando insumos...')
    const listResponse = await axios.get(`${API_BASE}/supplies`)
    console.log(`✅ ${listResponse.data.data.length} insumos encontrados`)
    
    // 3. Testar busca por ID
    console.log('\n3️⃣ Buscando insumo por ID...')
    const getResponse = await axios.get(`${API_BASE}/supplies/${supplyId}`)
    console.log('✅ Insumo encontrado:', getResponse.data.name)
    if (getResponse.data.unit_cost) {
      console.log('💰 Custo unitário calculado:', getResponse.data.unit_cost)
    }
    
    // 4. Testar atualização
    console.log('\n4️⃣ Atualizando insumo...')
    const updateData = {
      name: 'Essência de Rosa Premium',
      quantity_purchased: 150,
      total_amount_paid: 300.00
    }
    const updateResponse = await axios.put(`${API_BASE}/supplies/${supplyId}`, updateData)
    console.log('✅ Insumo atualizado:', updateResponse.data.name)
    if (updateResponse.data.unit_cost) {
      console.log('💰 Novo custo unitário:', updateResponse.data.unit_cost)
    }
    
    // 5. Testar estatísticas
    console.log('\n5️⃣ Verificando estatísticas...')
    const statsResponse = await axios.get(`${API_BASE}/supplies/stats`)
    console.log('📊 Estatísticas:', {
      total: statsResponse.data.total_supplies,
      valor_total: statsResponse.data.total_value,
      por_tipo: statsResponse.data.by_type
    })
    
    // 6. Testar clientes
    console.log('\n6️⃣ Testando clientes...')
    const newCustomer = {
      name: 'Maria Silva',
      tax_id: '123.456.789-00',
      phone: '(11) 99999-0001',
      email: 'maria@email.com',
      address: 'Rua das Rosas, 123',
      city: 'São Paulo',
      state: 'SP',
      zip_code: '01234-567'
    }
    
    const customerResponse = await axios.post(`${API_BASE}/customers`, newCustomer)
    console.log('✅ Cliente criado:', customerResponse.data.name)
    
    // 7. Testar exclusão
    console.log('\n7️⃣ Testando exclusão...')
    await axios.delete(`${API_BASE}/supplies/${supplyId}`)
    console.log('✅ Insumo excluído com sucesso')
    
    console.log('\n🎉 TODOS OS TESTES PASSARAM!')
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message)
  }
}

testCRUDs()