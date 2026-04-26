// Teste direto no banco
require('dotenv').config()
const knex = require('knex')

const config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 6543,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  }
}

async function testDirect() {
  const db = knex(config)
  
  try {
    console.log('🧪 TESTE DIRETO NO BANCO\n')
    
    // 1. Listar fornecedores
    console.log('1️⃣ Listando fornecedores...')
    const suppliers = await db('suppliers').select('*')
    console.log(`✅ ${suppliers.length} fornecedores`)
    
    if (suppliers.length > 0) {
      const firstSupplier = suppliers[0]
      console.log(`   Primeiro: ${firstSupplier.name} (ID: ${firstSupplier.id})`)
      
      // 2. Inserir insumo
      console.log('\n2️⃣ Inserindo insumo...')
      const [created] = await db('supplies').insert({
        name: 'Teste Direto',
        type: 'Essence',
        supplier_id: firstSupplier.id,
        unit: 'ml',
        quantity_purchased: 100,
        total_amount_paid: 50.00,
        batch: 'DIRECT001',
        notes: 'Teste direto'
      }).returning('*')
      
      console.log('✅ Insumo criado:', created.name, `(ID: ${created.id})`)
      
      // 3. Buscar insumo
      console.log('\n3️⃣ Buscando insumo...')
      const found = await db('supplies').where('id', created.id).first()
      console.log('✅ Insumo encontrado:', found.name)
      console.log('💰 Custo unitário:', found.unit_cost)
      
      // 4. Deletar insumo
      console.log('\n4️⃣ Deletando insumo...')
      await db('supplies').where('id', created.id).del()
      console.log('✅ Insumo deletado')
      
      console.log('\n🎉 TESTE DIRETO PASSOU!')
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message)
  } finally {
    await db.destroy()
  }
}

testDirect()