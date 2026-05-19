/**
 * Seed 004: Dados de demonstração para todas as telas CRUD (não-admin)
 * Inserção guardada por contagem — idempotente.
 */

exports.seed = async function (knex) {
  console.log('🌸 Iniciando seed de dados de demonstração...')

  try {
    // ══════════════════════════════════════════════════════
    // FORNECEDORES
    // ══════════════════════════════════════════════════════
    const { count: suppliersCount } = await knex('suppliers').count('* as count').first()
    if (parseInt(suppliersCount) === 0) {
      await knex('suppliers').insert([
        { name: 'Aroma Mix Essências',          type: 'Essence',   contact: 'Carlos Silva',    email: 'vendas@aromamix.com.br',          phone: '(11) 9 8765-4321', address: 'Rua das Essências, 100 — São Paulo/SP',     active: true },
        { name: 'Fragrance World Brasil',        type: 'Essence',   contact: 'Ana Lima',        email: 'comercial@fragranceworld.com.br',  phone: '(21) 9 7654-3210', address: 'Av. Atlântica, 500 — Rio de Janeiro/RJ',    active: true },
        { name: 'Silva & Cia Essências',         type: 'Essence',   contact: 'Roberto Silva',   email: 'roberto@silvacia.com.br',          phone: '(31) 9 6543-2109', address: 'Rua Minerios, 250 — Belo Horizonte/MG',     active: true },
        { name: 'Galvão Química Ltda',           type: 'Base',      contact: 'Maria Galvão',    email: 'pedidos@galvaoquim.com.br',        phone: '(11) 9 5432-1098', address: 'Av. Industrial, 1200 — Santo André/SP',    active: true },
        { name: 'QuimiChem Brasil',              type: 'Chemical',  contact: 'Paulo Santos',    email: 'vendas@quimichem.com.br',          phone: '(11) 9 4321-0987', address: 'Rua Química, 78 — Diadema/SP',              active: true },
        { name: 'Nordeste Químicos',             type: 'Chemical',  contact: 'José Ferreira',   email: 'jose@nordestequim.com.br',         phone: '(85) 9 3210-9876', address: 'Av. Bezerra de Menezes, 340 — Fortaleza/CE', active: true },
        { name: 'Frascoo Brasil Embalagens',     type: 'Bottle',    contact: 'Fernanda Costa',  email: 'vendas@frascoo.com.br',            phone: '(11) 9 2109-8765', address: 'Rua do Vidro, 445 — São Paulo/SP',          active: true },
        { name: 'Glass Premium Frascos',         type: 'Bottle',    contact: 'Luciana Mendes',  email: 'comercial@glasspremium.com.br',    phone: '(11) 9 1098-7654', address: 'Rua Cristal, 89 — Guarulhos/SP',            active: true },
        { name: 'Rótulo Arte Gráfica',           type: 'Label',     contact: 'Diego Oliveira',  email: 'arte@rotuloarte.com.br',           phone: '(11) 9 0987-6543', address: 'Rua da Gráfica, 210 — São Paulo/SP',        active: true },
        { name: 'Premium Labels',                type: 'Label',     contact: 'Claudia Rocha',   email: 'claudia@premiumlabels.com.br',     phone: '(11) 9 8765-0000', address: 'Rua Impressa, 55 — Osasco/SP',              active: true },
        { name: 'Alfa Embalagens Cosméticas',    type: 'Packaging', contact: 'Fernando Alves',  email: 'fernando@alfaemb.com.br',          phone: '(41) 9 7654-1111', address: 'Rua das Embalagens, 320 — Curitiba/PR',     active: true },
        { name: 'BrazChem Suprimentos',          type: 'Multiple',  contact: 'Tatiana Nunes',   email: 'tatiana@brazchem.com.br',          phone: '(11) 9 6543-2222', address: 'Av. Paulista, 900 — São Paulo/SP',          active: true },
      ])
      console.log('✅ 12 fornecedores inseridos')
    }

    // ══════════════════════════════════════════════════════
    // INSUMOS (SUPPLIES)
    // ══════════════════════════════════════════════════════
    const { count: suppliesCount } = await knex('supplies').count('* as count').first()
    if (parseInt(suppliesCount) === 0) {
      const allSuppliers = await knex('suppliers').select('id', 'name')
      const sid = {}
      allSuppliers.forEach(s => {
        if (s.name.includes('Aroma Mix'))            sid.aromamix   = s.id
        else if (s.name.includes('Fragrance World')) sid.fragworld  = s.id
        else if (s.name.includes('Silva & Cia'))     sid.silvacia   = s.id
        else if (s.name.includes('Galvão'))          sid.galvao     = s.id
        else if (s.name.includes('QuimiChem'))       sid.quimichem  = s.id
        else if (s.name.includes('Nordeste'))        sid.nordeste   = s.id
        else if (s.name.includes('Frascoo'))         sid.frascoo    = s.id
        else if (s.name.includes('Rótulo Arte'))     sid.rotulo     = s.id
      })

      const now = new Date()
      await knex('supplies').insert([
        // Essências
        { name: 'Essência Sauvage (Dior)',            type: 'Essence',  supplier_id: sid.aromamix,  unit: 'ml',      quantity_purchased: 500,  total_amount_paid: 450.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Essência Bleu de Chanel',            type: 'Essence',  supplier_id: sid.aromamix,  unit: 'ml',      quantity_purchased: 500,  total_amount_paid: 420.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Essência La Vie Est Belle',          type: 'Essence',  supplier_id: sid.silvacia,  unit: 'ml',      quantity_purchased: 300,  total_amount_paid: 285.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Essência One Million (Paco R.)',     type: 'Essence',  supplier_id: sid.fragworld, unit: 'ml',      quantity_purchased: 400,  total_amount_paid: 380.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Essência 212 VIP Men (CH)',          type: 'Essence',  supplier_id: sid.fragworld, unit: 'ml',      quantity_purchased: 400,  total_amount_paid: 360.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Essência Olympéa (Paco R.)',         type: 'Essence',  supplier_id: sid.silvacia,  unit: 'ml',      quantity_purchased: 300,  total_amount_paid: 270.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Essência Black Opium (YSL)',         type: 'Essence',  supplier_id: sid.aromamix,  unit: 'ml',      quantity_purchased: 400,  total_amount_paid: 400.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Essência Invictus (Paco R.)',        type: 'Essence',  supplier_id: sid.fragworld, unit: 'ml',      quantity_purchased: 500,  total_amount_paid: 475.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Essência Baccarat Rouge 540',        type: 'Essence',  supplier_id: sid.silvacia,  unit: 'ml',      quantity_purchased: 200,  total_amount_paid: 480.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Essência Good Girl (CH)',            type: 'Essence',  supplier_id: sid.aromamix,  unit: 'ml',      quantity_purchased: 300,  total_amount_paid: 285.00, purchase_date: now, receipt_status: 'Recebido' },
        // Bases e fixadores
        { name: 'Base Fix Premium 5L',               type: 'Base',     supplier_id: sid.galvao,    unit: 'ml',      quantity_purchased: 5000, total_amount_paid: 120.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'DPG Dipropilenoglicol 1L',          type: 'Chemical', supplier_id: sid.quimichem, unit: 'ml',      quantity_purchased: 1000, total_amount_paid:  35.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Álcool 96° 5L',                     type: 'Chemical', supplier_id: sid.nordeste,  unit: 'ml',      quantity_purchased: 5000, total_amount_paid:  65.00, purchase_date: now, receipt_status: 'Recebido' },
        // Frascos
        { name: 'Frasco Vidro 10ml',                 type: 'Bottle',   supplier_id: sid.frascoo,   unit: 'unidade', quantity_purchased: 200,  total_amount_paid: 160.00, purchase_date: now, receipt_status: 'Recebido', bottle_type: '10ml spray' },
        { name: 'Frasco Vidro 15ml',                 type: 'Bottle',   supplier_id: sid.frascoo,   unit: 'unidade', quantity_purchased: 200,  total_amount_paid: 200.00, purchase_date: now, receipt_status: 'Recebido', bottle_type: '15ml spray' },
        { name: 'Frasco Vidro 30ml',                 type: 'Bottle',   supplier_id: sid.frascoo,   unit: 'unidade', quantity_purchased: 150,  total_amount_paid: 247.50, purchase_date: now, receipt_status: 'Recebido', bottle_type: '30ml spray' },
        { name: 'Frasco Vidro 50ml',                 type: 'Bottle',   supplier_id: sid.frascoo,   unit: 'unidade', quantity_purchased: 100,  total_amount_paid: 220.00, purchase_date: now, receipt_status: 'Recebido', bottle_type: '50ml spray' },
        // Rótulos
        { name: 'Rótulo Adesivo 10ml',               type: 'Label',    supplier_id: sid.rotulo,    unit: 'unidade', quantity_purchased: 500,  total_amount_paid:  75.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Rótulo Adesivo 15ml',               type: 'Label',    supplier_id: sid.rotulo,    unit: 'unidade', quantity_purchased: 500,  total_amount_paid:  75.00, purchase_date: now, receipt_status: 'Recebido' },
        { name: 'Rótulo Adesivo 30ml',               type: 'Label',    supplier_id: sid.rotulo,    unit: 'unidade', quantity_purchased: 300,  total_amount_paid:  60.00, purchase_date: now, receipt_status: 'Recebido' },
      ])
      console.log('✅ 20 insumos inseridos')
    }

    // ══════════════════════════════════════════════════════
    // CLIENTES
    // ══════════════════════════════════════════════════════
    const { count: customersCount } = await knex('customers').count('* as count').first()
    if (parseInt(customersCount) === 0) {
      await knex('customers').insert([
        { name: 'Ana Carolina Souza',       phone: '(11) 9 8765-4321', email: 'ana.souza@gmail.com',       city: 'São Paulo',     state: 'SP', zip_code: '01310-100' },
        { name: 'Marcos Vinicius Pereira',  phone: '(11) 9 7654-3210', email: 'marcos.pereira@hotmail.com', city: 'Guarulhos',    state: 'SP', zip_code: '07111-000' },
        { name: 'Juliana Santos Ferreira',  phone: '(11) 9 6543-2109', email: 'juliana.santos@gmail.com',   city: 'São Paulo',    state: 'SP', zip_code: '04040-001' },
        { name: 'Ricardo Albuquerque',      phone: '(81) 9 5432-1098', email: 'ricardoalb@gmail.com',       city: 'Recife',       state: 'PE', zip_code: '50010-010' },
        { name: 'Patricia Lima Costa',      phone: '(21) 9 4321-0987', email: 'patricialima@gmail.com',     city: 'Rio de Janeiro', state: 'RJ', zip_code: '20040-020' },
        { name: 'Fernando Costa Mendes',    phone: '(11) 9 3210-9876', email: 'fcosta@gmail.com',           city: 'São Paulo',    state: 'SP', zip_code: '01414-001' },
        { name: 'Camila Rodrigues Silva',   phone: '(41) 9 2109-8765', email: 'camila.rod@gmail.com',       city: 'Curitiba',     state: 'PR', zip_code: '80010-000' },
        { name: 'Bruno Henrique Oliveira',  phone: '(11) 9 1098-7654', email: 'brunooli@hotmail.com',       city: 'Santo André',  state: 'SP', zip_code: '09010-170' },
        { name: 'Tatiana Figueiredo',       phone: '(61) 9 0987-6543', email: 'tatiana.fig@gmail.com',      city: 'Brasília',     state: 'DF', zip_code: '70040-010' },
        { name: 'Leonardo Martins Vieira',  phone: '(51) 9 9876-5432', email: 'leo.martins@gmail.com',      city: 'Porto Alegre', state: 'RS', zip_code: '90010-150' },
        { name: 'Alessandra Batista',       phone: '(11) 9 8765-1111', email: 'ale.batista@gmail.com',      city: 'São Paulo',    state: 'SP', zip_code: '02010-000' },
        { name: 'Guilherme Neto Santos',    phone: '(11) 9 7654-2222', email: 'gui.neto@gmail.com',         city: 'Campinas',     state: 'SP', zip_code: '13010-050' },
      ])
      console.log('✅ 12 clientes inseridos')
    }

    // ══════════════════════════════════════════════════════
    // EMBALAGENS (PACKAGING TYPES)
    // ══════════════════════════════════════════════════════
    const { count: packCount } = await knex('packaging_types').count('* as count').first()
    if (parseInt(packCount) === 0) {
      await knex('packaging_types').insert([
        { name: 'Spray 10ml',     volume_ml: 10,  format: 'spray',     suggested_price:  35.00, active: true },
        { name: 'Spray 15ml',     volume_ml: 15,  format: 'spray',     suggested_price:  45.00, active: true },
        { name: 'Spray 30ml',     volume_ml: 30,  format: 'spray',     suggested_price:  75.00, active: true },
        { name: 'Spray 50ml',     volume_ml: 50,  format: 'spray',     suggested_price: 110.00, active: true },
        { name: 'Spray 100ml',    volume_ml: 100, format: 'spray',     suggested_price: 180.00, active: true },
        { name: 'Roll-on 10ml',   volume_ml: 10,  format: 'roll-on',   suggested_price:  30.00, active: true },
        { name: 'Roll-on 15ml',   volume_ml: 15,  format: 'roll-on',   suggested_price:  40.00, active: true },
        { name: 'Roll-on 30ml',   volume_ml: 30,  format: 'roll-on',   suggested_price:  65.00, active: true },
        { name: 'Miniatura 3ml',  volume_ml:  3,  format: 'miniatura', suggested_price:  15.00, active: true },
        { name: 'Miniatura 5ml',  volume_ml:  5,  format: 'miniatura', suggested_price:  22.00, active: true },
      ])
      console.log('✅ 10 tipos de embalagem inseridos')
    }

    // ══════════════════════════════════════════════════════
    // PROJETOS / PRODUTOS
    // ══════════════════════════════════════════════════════
    const { count: prodCount } = await knex('products').count('* as count').first()
    const existingProdCount = parseInt(prodCount)

    // Mapeamento: inspiration_name → nome do supply de essência
    const essenceMap = {
      'Sauvage':            'Essência Sauvage (Dior)',
      'Bleu de Chanel':     'Essência Bleu de Chanel',
      'La Vie Est Belle':   'Essência La Vie Est Belle',
      'One Million':        'Essência One Million (Paco R.)',
      '212 VIP Men':        'Essência 212 VIP Men (CH)',
      'Olympéa':            'Essência Olympéa (Paco R.)',
      'Black Opium':        'Essência Black Opium (YSL)',
      'Invictus':           'Essência Invictus (Paco R.)',
      'Baccarat Rouge 540': 'Essência Baccarat Rouge 540',
      'Good Girl':          'Essência Good Girl (CH)',
    }

    const allProductDefs = [
      { project_name: 'Inspirado em One Million',        inspiration_brand: 'Paco Rabanne',              inspiration_name: 'One Million',        commercial_name: 'Gold Million',    gender: 'Masculino', top_notes: 'Toranja, Hortelã, Sangue',                 heart_notes: 'Canela, Especiarias, Rosa',               base_notes: 'Âmbar, Couro, Patchouli',                active: true },
      { project_name: 'Inspirado em 212 VIP Men',        inspiration_brand: 'Carolina Herrera',          inspiration_name: '212 VIP Men',        commercial_name: 'VIP Night',       gender: 'Masculino', top_notes: 'Abacaxi, Rum, Vodka',                      heart_notes: 'Couro Branco, Âmbar',                    base_notes: 'Tonka, Baunilha, Cedro',                  active: true },
      { project_name: 'Inspirado em Olympéa',            inspiration_brand: 'Paco Rabanne',              inspiration_name: 'Olympéa',            commercial_name: 'Olympia Gold',    gender: 'Feminino',  top_notes: 'Toranja Verde, Flor de Sal',               heart_notes: "Lírio d'Água, Cashmere Wood",            base_notes: 'Musgo de Carvalho, Sândalo, Âmbar',       active: true },
      { project_name: 'Inspirado em Black Opium',        inspiration_brand: 'Yves Saint Laurent',        inspiration_name: 'Black Opium',        commercial_name: 'Dark Energy',     gender: 'Feminino',  top_notes: 'Pêra, Rosa',                               heart_notes: 'Café, Jasmim',                           base_notes: 'Baunilha, Patchouli, Cedro',              active: true },
      { project_name: 'Inspirado em Invictus',           inspiration_brand: 'Paco Rabanne',              inspiration_name: 'Invictus',           commercial_name: 'Victor Sport',    gender: 'Masculino', top_notes: 'Toranja, Louro, Mandarina',                heart_notes: 'Jasmim, Guaiac Wood',                    base_notes: 'Âmbar Cinza, Musgo de Carvalho',          active: true },
      { project_name: 'Inspirado em Baccarat Rouge 540', inspiration_brand: 'Maison Francis Kurkdjian',  inspiration_name: 'Baccarat Rouge 540', commercial_name: 'Crystal Rouge',   gender: 'Unissex',   top_notes: 'Açafrão, Jasmim',                          heart_notes: 'Ambroxan, Cedro',                        base_notes: 'Resina de Fundo, Musgo',                  active: true },
      { project_name: 'Inspirado em Good Girl',          inspiration_brand: 'Carolina Herrera',          inspiration_name: 'Good Girl',          commercial_name: 'Boa Garota',      gender: 'Feminino',  top_notes: 'Café, Amêndoa',                            heart_notes: 'Jasmim Sambac, Tuberosa',                base_notes: 'Baunilha, Tonka, Patchouli',              active: true },
    ]

    let newProds = []
    if (existingProdCount < 10) {
      const toInsert = allProductDefs.slice(0, 10 - existingProdCount)
      newProds = await knex('products').insert(toInsert).returning('*')
      console.log(`✅ ${newProds.length} produtos inseridos`)
    }

    // ══════════════════════════════════════════════════════
    // FÓRMULAS + ITENS DE FÓRMULA
    // ══════════════════════════════════════════════════════
    const allProducts   = await knex('products').select('*')
    const allSupplies   = await knex('supplies').select('id', 'name', 'type')

    const supplyByName  = {}
    allSupplies.forEach(s => { supplyByName[s.name] = s.id })

    const baseSupplyId = supplyByName['Base Fix Premium 5L']
    const dpgSupplyId  = supplyByName['DPG Dipropilenoglicol 1L']

    const { count: formulaCount } = await knex('formulas').count('* as count').first()
    const existingFormulaCount = parseInt(formulaCount)

    // Buscar produtos que ainda não têm fórmula
    const existingFormulas = await knex('formulas').select('product_id')
    const productsWithFormula = new Set(existingFormulas.map(f => f.product_id))

    const productsNeedingFormula = allProducts.filter(p => !productsWithFormula.has(p.id))

    if (productsNeedingFormula.length > 0 && baseSupplyId && dpgSupplyId) {
      for (const product of productsNeedingFormula) {
        const [formula] = await knex('formulas').insert({
          product_id:        product.id,
          name:              `Fórmula ${product.commercial_name || product.project_name} v1.0`,
          description:       `Fórmula padrão — ${product.project_name}`,
          total_percentage:  100.00,
          validated:         true,
          active:            true,
        }).returning('*')

        // Identificar essência pelo inspiration_name
        const essenceName  = essenceMap[product.inspiration_name]
        const essenceSupId = essenceName ? supplyByName[essenceName] : null

        if (essenceSupId && baseSupplyId !== essenceSupId && dpgSupplyId !== essenceSupId) {
          await knex('formula_items').insert([
            { formula_id: formula.id, supply_id: essenceSupId, percentage: 25.00, order_index: 1, notes: 'Essência principal' },
            { formula_id: formula.id, supply_id: baseSupplyId, percentage: 65.00, order_index: 2, notes: 'Base veículo'       },
            { formula_id: formula.id, supply_id: dpgSupplyId,  percentage: 10.00, order_index: 3, notes: 'Fixador DPG'        },
          ])
        } else if (baseSupplyId && dpgSupplyId) {
          // Fallback: base + DPG se não encontrar a essência
          await knex('formula_items').insert([
            { formula_id: formula.id, supply_id: baseSupplyId, percentage: 90.00, order_index: 1, notes: 'Base veículo' },
            { formula_id: formula.id, supply_id: dpgSupplyId,  percentage: 10.00, order_index: 2, notes: 'Fixador DPG'  },
          ])
        }
      }
      console.log(`✅ ${productsNeedingFormula.length} fórmulas criadas`)
    }

    // Também criar formula_items para fórmulas existentes que não tenham itens
    const allFormulas = await knex('formulas').select('*')
    const formulasWithItems = await knex('formula_items').distinct('formula_id').pluck('formula_id')
    const formulasWithItemsSet = new Set(formulasWithItems)

    const formulasNeedingItems = allFormulas.filter(f => !formulasWithItemsSet.has(f.id))
    if (formulasNeedingItems.length > 0 && baseSupplyId && dpgSupplyId) {
      for (const formula of formulasNeedingItems) {
        const product = formula.product_id
          ? allProducts.find(p => p.id === formula.product_id)
          : null
        const essenceName  = product ? essenceMap[product.inspiration_name] : null
        const essenceSupId = essenceName ? supplyByName[essenceName] : null

        if (essenceSupId && baseSupplyId !== essenceSupId && dpgSupplyId !== essenceSupId) {
          await knex('formula_items').insert([
            { formula_id: formula.id, supply_id: essenceSupId, percentage: 25.00, order_index: 1, notes: 'Essência principal' },
            { formula_id: formula.id, supply_id: baseSupplyId, percentage: 65.00, order_index: 2, notes: 'Base veículo'       },
            { formula_id: formula.id, supply_id: dpgSupplyId,  percentage: 10.00, order_index: 3, notes: 'Fixador DPG'        },
          ]).onConflict(['formula_id', 'supply_id']).ignore()
        } else {
          await knex('formula_items').insert([
            { formula_id: formula.id, supply_id: baseSupplyId, percentage: 90.00, order_index: 1, notes: 'Base veículo' },
            { formula_id: formula.id, supply_id: dpgSupplyId,  percentage: 10.00, order_index: 2, notes: 'Fixador DPG'  },
          ]).onConflict(['formula_id', 'supply_id']).ignore()
        }
      }
      console.log(`✅ Itens adicionados a ${formulasNeedingItems.length} fórmulas existentes`)
    }

    // ══════════════════════════════════════════════════════
    // LOTES (BATCHES)
    // ══════════════════════════════════════════════════════
    const { count: batchCount } = await knex('batches').count('* as count').first()
    const existingBatchCount = parseInt(batchCount)

    if (existingBatchCount < 10) {
      const updatedFormulas = await knex('formulas').select('id', 'product_id').limit(10)
      const today  = new Date()
      const d = (delta) => { const d = new Date(today); d.setDate(d.getDate() + delta); return d }

      const batchDefs = [
        { formula_id: updatedFormulas[0]?.id, product_id: updatedFormulas[0]?.product_id, batch_code: 'DEMO-001-2026', production_date: d(-30), quantity_ml: 600, remaining_ml: 600, total_cost: 162.00, cost_per_ml: 0.27, status: 'Pronto para envase', maceration_start: d(-30), maceration_end: d(-20), notes: 'Lote demo pronto para envase' },
        { formula_id: updatedFormulas[1]?.id, product_id: updatedFormulas[1]?.product_id, batch_code: 'DEMO-002-2026', production_date: d(-25), quantity_ml: 400, remaining_ml: 400, total_cost: 108.00, cost_per_ml: 0.27, status: 'Pronto para envase', maceration_start: d(-25), maceration_end: d(-15), notes: 'Lote demo pronto para envase' },
        { formula_id: updatedFormulas[2]?.id, product_id: updatedFormulas[2]?.product_id, batch_code: 'DEMO-003-2026', production_date: d(-10), quantity_ml: 500, remaining_ml: 500, total_cost: 140.00, cost_per_ml: 0.28, status: 'Em maceração',      maceration_start: d(-10), maceration_end: d(+5),  notes: 'Lote em maceração ativa' },
        { formula_id: updatedFormulas[3]?.id, product_id: updatedFormulas[3]?.product_id, batch_code: 'DEMO-004-2026', production_date: d(-5),  quantity_ml: 300, remaining_ml: 300, total_cost:  96.00, cost_per_ml: 0.32, status: 'Em maceração',      maceration_start: d(-5),  maceration_end: d(+10), notes: 'Lote em maceração ativa' },
        { formula_id: updatedFormulas[4]?.id, product_id: updatedFormulas[4]?.product_id, batch_code: 'DEMO-005-2026', production_date: d(-60), quantity_ml: 800, remaining_ml: 200, total_cost: 232.00, cost_per_ml: 0.29, status: 'Finalizado',         maceration_start: d(-60), maceration_end: d(-50), notes: 'Lote finalizado — uso parcial' },
        { formula_id: updatedFormulas[0]?.id, product_id: updatedFormulas[0]?.product_id, batch_code: 'DEMO-006-2026', production_date: d(-45), quantity_ml: 500, remaining_ml: 500, total_cost: 135.00, cost_per_ml: 0.27, status: 'Pronto para envase', maceration_start: d(-45), maceration_end: d(-35), notes: 'Segunda produção' },
        { formula_id: updatedFormulas[1]?.id, product_id: updatedFormulas[1]?.product_id, batch_code: 'DEMO-007-2026', production_date: d(-20), quantity_ml: 400, remaining_ml: 400, total_cost: 108.00, cost_per_ml: 0.27, status: 'Em maceração',      maceration_start: d(-20), maceration_end: d(+3),  notes: 'Lote quase pronto' },
        { formula_id: updatedFormulas[2]?.id, product_id: updatedFormulas[2]?.product_id, batch_code: 'DEMO-008-2026', production_date: d(-90), quantity_ml: 600, remaining_ml:   0, total_cost: 168.00, cost_per_ml: 0.28, status: 'Finalizado',         maceration_start: d(-90), maceration_end: d(-80), notes: 'Lote totalmente utilizado' },
      ].filter(b => b.formula_id)
        .slice(0, 10 - existingBatchCount)

      if (batchDefs.length > 0) {
        await knex('batches').insert(batchDefs)
        console.log(`✅ ${batchDefs.length} lotes inseridos`)
      }
    }

    // ══════════════════════════════════════════════════════
    // ENVASES (BOTTLINGS)
    // ══════════════════════════════════════════════════════
    const { count: bottlingsCount } = await knex('bottlings').count('* as count').first()
    if (parseInt(bottlingsCount) === 0) {
      const bottleSupId10 = supplyByName['Frasco Vidro 10ml']
      const bottleSupId15 = supplyByName['Frasco Vidro 15ml']
      const bottleSupId30 = supplyByName['Frasco Vidro 30ml']
      const bottleSupId50 = supplyByName['Frasco Vidro 50ml']
      const labelSupId10  = supplyByName['Rótulo Adesivo 10ml']
      const labelSupId15  = supplyByName['Rótulo Adesivo 15ml']
      const labelSupId30  = supplyByName['Rótulo Adesivo 30ml']
      const today = new Date()
      const d = (delta) => { const d = new Date(today); d.setDate(d.getDate() + delta); return d }

      await knex('bottlings').insert([
        { bottling_code: 'ENV-001-2026', bottling_date: d(-60), product_name: 'Savage Gold',  product_ref: 'SG-30',  volume_ml: 30, quantity: 20, quantity_available: 18, bottle_supply_id: bottleSupId30, label_supply_id: labelSupId30, liquid_cost:  8.10, bottle_cost: 1.65, label_cost: 0.20, total_cost: 199.10, unit_cost:  9.95, active: true },
        { bottling_code: 'ENV-002-2026', bottling_date: d(-55), product_name: 'Blue Elegance', product_ref: 'BE-30',  volume_ml: 30, quantity: 15, quantity_available: 15, bottle_supply_id: bottleSupId30, label_supply_id: labelSupId30, liquid_cost:  8.37, bottle_cost: 1.65, label_cost: 0.20, total_cost: 153.30, unit_cost: 10.22, active: true },
        { bottling_code: 'ENV-003-2026', bottling_date: d(-50), product_name: 'Beautiful Life', product_ref: 'BL-15', volume_ml: 15, quantity: 25, quantity_available: 20, bottle_supply_id: bottleSupId15, label_supply_id: labelSupId15, liquid_cost:  4.20, bottle_cost: 1.00, label_cost: 0.15, total_cost: 133.75, unit_cost:  5.35, active: true },
        { bottling_code: 'ENV-004-2026', bottling_date: d(-45), product_name: 'Gold Million',  product_ref: 'GM-30',  volume_ml: 30, quantity: 20, quantity_available: 12, bottle_supply_id: bottleSupId30, label_supply_id: labelSupId30, liquid_cost:  9.60, bottle_cost: 1.65, label_cost: 0.20, total_cost: 229.00, unit_cost: 11.45, active: true },
        { bottling_code: 'ENV-005-2026', bottling_date: d(-40), product_name: 'VIP Night',     product_ref: 'VN-50',  volume_ml: 50, quantity: 12, quantity_available: 10, bottle_supply_id: bottleSupId50, label_supply_id: labelSupId30, liquid_cost: 16.00, bottle_cost: 2.20, label_cost: 0.20, total_cost: 220.80, unit_cost: 18.40, active: true },
        { bottling_code: 'ENV-006-2026', bottling_date: d(-35), product_name: 'Olympia Gold',  product_ref: 'OG-15',  volume_ml: 15, quantity: 30, quantity_available: 28, bottle_supply_id: bottleSupId15, label_supply_id: labelSupId15, liquid_cost:  4.05, bottle_cost: 1.00, label_cost: 0.15, total_cost: 156.00, unit_cost:  5.20, active: true },
        { bottling_code: 'ENV-007-2026', bottling_date: d(-30), product_name: 'Dark Energy',   product_ref: 'DE-10',  volume_ml: 10, quantity: 40, quantity_available: 35, bottle_supply_id: bottleSupId10, label_supply_id: labelSupId10, liquid_cost:  3.20, bottle_cost: 0.80, label_cost: 0.15, total_cost: 166.00, unit_cost:  4.15, active: true },
        { bottling_code: 'ENV-008-2026', bottling_date: d(-25), product_name: 'Victor Sport',  product_ref: 'VS-30',  volume_ml: 30, quantity: 18, quantity_available: 18, bottle_supply_id: bottleSupId30, label_supply_id: labelSupId30, liquid_cost:  8.40, bottle_cost: 1.65, label_cost: 0.20, total_cost: 185.85, unit_cost: 10.32, active: true },
        { bottling_code: 'ENV-009-2026', bottling_date: d(-20), product_name: 'Crystal Rouge', product_ref: 'CR-15',  volume_ml: 15, quantity: 10, quantity_available: 10, bottle_supply_id: bottleSupId15, label_supply_id: labelSupId15, liquid_cost:  6.00, bottle_cost: 1.00, label_cost: 0.15, total_cost:  71.50, unit_cost:  7.15, active: true },
        { bottling_code: 'ENV-010-2026', bottling_date: d(-15), product_name: 'Boa Garota',    product_ref: 'BG-30',  volume_ml: 30, quantity: 22, quantity_available: 22, bottle_supply_id: bottleSupId30, label_supply_id: labelSupId30, liquid_cost:  8.55, bottle_cost: 1.65, label_cost: 0.20, total_cost: 228.80, unit_cost: 10.40, active: true },
      ])
      console.log('✅ 10 envases inseridos')
    }

    // ══════════════════════════════════════════════════════
    // TABELA DE PREÇOS (PRICE LISTS)
    // ══════════════════════════════════════════════════════
    const { count: priceListCount } = await knex('price_lists').count('* as count').first()
    if (parseInt(priceListCount) === 0) {
      const products = await knex('products').select('id', 'commercial_name', 'inspiration_name').limit(10)
      const packTypes = await knex('packaging_types').select('id', 'volume_ml', 'name')
      const pack30 = packTypes.find(p => p.name === 'Spray 30ml')
      const pack15 = packTypes.find(p => p.name === 'Spray 15ml')
      const pack50 = packTypes.find(p => p.name === 'Spray 50ml')
      const pack10 = packTypes.find(p => p.name === 'Spray 10ml')

      const priceEntries = []
      const priceMap = [
        { vol: 10, packType: pack10, prices: [35, 30, 32, 38, 35, 28, 30, 36, 55, 32] },
        { vol: 15, packType: pack15, prices: [45, 40, 42, 50, 45, 38, 40, 48, 72, 42] },
        { vol: 30, packType: pack30, prices: [75, 68, 72, 82, 78, 65, 70, 80, 120, 72] },
        { vol: 50, packType: pack50, prices: [110, 100, 105, 120, 115, 95, 100, 115, 175, 105] },
      ]

      products.forEach((prod, i) => {
        priceMap.forEach(({ vol, packType, prices }) => {
          if (packType) {
            priceEntries.push({
              product_id:        prod.id,
              packaging_type_id: packType.id,
              volume_ml:         vol,
              price:             prices[i] || 50,
              valid_from:        new Date(),
            })
          }
        })
      })

      if (priceEntries.length > 0) {
        await knex('price_lists').insert(priceEntries)
        console.log(`✅ ${priceEntries.length} preços inseridos`)
      }
    }

    // ══════════════════════════════════════════════════════
    // DESCONTOS POR VOLUME (VOLUME DISCOUNTS)
    // ══════════════════════════════════════════════════════
    const { count: vdCount } = await knex('volume_discounts').count('* as count').first()
    if (parseInt(vdCount) === 0) {
      const packTypes = await knex('packaging_types').select('id', 'name').limit(4)
      const discounts = []

      packTypes.forEach(pt => {
        discounts.push(
          { packaging_type_id: pt.id, min_quantity:  2, discount_percentage:  5.00, active: true },
          { packaging_type_id: pt.id, min_quantity:  5, discount_percentage: 10.00, active: true },
          { packaging_type_id: pt.id, min_quantity: 10, discount_percentage: 15.00, active: true },
        )
      })

      // Descontos globais (sem embalagem específica)
      discounts.push(
        { packaging_type_id: null, min_quantity:  3, discount_percentage:  7.00, active: true },
        { packaging_type_id: null, min_quantity:  8, discount_percentage: 12.00, active: true },
        { packaging_type_id: null, min_quantity: 20, discount_percentage: 20.00, active: true },
      )

      if (discounts.length > 0) {
        await knex('volume_discounts').insert(discounts)
        console.log(`✅ ${discounts.length} descontos por volume inseridos`)
      }
    }

    // ══════════════════════════════════════════════════════
    // PEDIDOS / VENDAS (ORDERS + ORDER_ITEMS)
    // ══════════════════════════════════════════════════════
    const { count: orderCount } = await knex('orders').count('* as count').first()
    if (parseInt(orderCount) === 0) {
      const customers = await knex('customers').select('id').limit(12)
      const products  = await knex('products').select('id', 'commercial_name', 'project_name').limit(10)
      const today = new Date()
      const d = (delta) => { const dt = new Date(today); dt.setDate(dt.getDate() + delta); return dt }

      const orderDefs = [
        { customer_id: customers[0]?.id,  code: 'ORD-20260410-001', status: 'Delivered',     channel: 'WhatsApp',       discount: 0,   shipping: 15.00, created_at: d(-40) },
        { customer_id: customers[1]?.id,  code: 'ORD-20260415-002', status: 'Delivered',     channel: 'Instagram',      discount: 5,   shipping: 12.00, created_at: d(-35) },
        { customer_id: customers[2]?.id,  code: 'ORD-20260420-003', status: 'Shipped',       channel: 'WhatsApp',       discount: 0,   shipping: 18.00, created_at: d(-30) },
        { customer_id: customers[3]?.id,  code: 'ORD-20260425-004', status: 'Ready',         channel: 'Physical Store', discount: 10,  shipping:  0.00, created_at: d(-25) },
        { customer_id: customers[4]?.id,  code: 'ORD-20260428-005', status: 'In Production', channel: 'Website',        discount: 0,   shipping: 20.00, created_at: d(-22) },
        { customer_id: customers[5]?.id,  code: 'ORD-20260501-006', status: 'Confirmed',     channel: 'WhatsApp',       discount: 0,   shipping: 15.00, created_at: d(-18) },
        { customer_id: customers[6]?.id,  code: 'ORD-20260505-007', status: 'Pending',       channel: 'Instagram',      discount: 0,   shipping: 15.00, created_at: d(-14) },
        { customer_id: customers[7]?.id,  code: 'ORD-20260508-008', status: 'Confirmed',     channel: 'Referral',       discount: 15,  shipping:  0.00, created_at: d(-11) },
        { customer_id: customers[8]?.id,  code: 'ORD-20260510-009', status: 'Cancelled',     channel: 'WhatsApp',       discount: 0,   shipping: 10.00, created_at: d(-9)  },
        { customer_id: customers[9]?.id,  code: 'ORD-20260512-010', status: 'Pending',       channel: 'Website',        discount: 0,   shipping: 15.00, created_at: d(-7)  },
        { customer_id: customers[10]?.id, code: 'ORD-20260515-011', status: 'Confirmed',     channel: 'WhatsApp',       discount: 5,   shipping: 12.00, created_at: d(-4)  },
        { customer_id: customers[11]?.id, code: 'ORD-20260517-012', status: 'Pending',       channel: 'Physical Store', discount: 0,   shipping:  0.00, created_at: d(-2)  },
      ].filter(o => o.customer_id)

      if (orderDefs.length > 0) {
        const insertedOrders = await knex('orders').insert(orderDefs).returning('*')

        const itemDefs = []
        const volPrices = [
          { vol: 30, price: 75 },
          { vol: 15, price: 45 },
          { vol: 30, price: 68 },
          { vol: 50, price: 110 },
          { vol: 30, price: 82 },
          { vol: 15, price: 38 },
          { vol: 10, price: 30 },
          { vol: 30, price: 80 },
          { vol: 15, price: 72 },
          { vol: 30, price: 72 },
          { vol: 50, price: 100 },
          { vol: 15, price: 42 },
        ]

        insertedOrders.forEach((order, i) => {
          const prod = products[i % products.length]
          if (!prod) return
          const { vol, price } = volPrices[i % volPrices.length]
          itemDefs.push({
            order_id:        order.id,
            product_id:      prod.id,
            product_name:    prod.commercial_name || prod.project_name,
            product_ref:     `${(prod.commercial_name || 'PRD').substring(0, 3).toUpperCase()}-${vol}`,
            volume_ml:       vol,
            quantity:        Math.ceil((i % 3) + 1),
            unit_price:      price,
            decision_status: 'Ready Stock',
            estimated_days:  3,
            decision_notes:  'Frasco disponível em estoque',
          })
        })

        if (itemDefs.length > 0) {
          await knex('order_items').insert(itemDefs)
        }
        console.log(`✅ ${insertedOrders.length} pedidos e ${itemDefs.length} itens inseridos`)
      }
    }

    // ══════════════════════════════════════════════════════
    // PERDAS (LOSSES)
    // ══════════════════════════════════════════════════════
    const { count: lossCount } = await knex('losses').count('* as count').first()
    if (parseInt(lossCount) === 0) {
      const today = new Date()
      const d = (delta) => { const dt = new Date(today); dt.setDate(dt.getDate() + delta); return dt }
      const allSups    = await knex('supplies').select('id', 'name').limit(5)
      const allBatches = await knex('batches').select('id', 'batch_code').limit(5)

      const lossDefs = []
      if (allSups.length > 0) {
        lossDefs.push(
          { loss_type: 'Leakage',    item_type: 'Supply',  item_id: allSups[0].id, item_name: allSups[0].name, quantity_lost: 50.0,  unit: 'ml',      cost: 45.00,  reason: 'Frasco caiu durante manuseio', operator: 'João', occurred_at: d(-45) },
          { loss_type: 'Evaporation', item_type: 'Supply', item_id: allSups[1].id, item_name: allSups[1].name, quantity_lost: 20.0,  unit: 'ml',      cost: 16.80,  reason: 'Evaporação — armazenagem inadequada', operator: 'Maria', occurred_at: d(-38) },
          { loss_type: 'Breakage',   item_type: 'Supply',  item_id: allSups[2].id, item_name: allSups[2].name, quantity_lost: 30.0,  unit: 'ml',      cost: 28.50,  reason: 'Frasco quebrado na bancada', operator: 'João', occurred_at: d(-30) },
          { loss_type: 'Expiration', item_type: 'Supply',  item_id: allSups[3]?.id || allSups[0].id, item_name: allSups[3]?.name || allSups[0].name, quantity_lost: 100.0, unit: 'ml', cost: 95.00, reason: 'Insumo vencido — prazo expirado', operator: 'Supervisão', occurred_at: d(-20) },
          { loss_type: 'Other',      item_type: 'Supply',  item_id: allSups[4]?.id || allSups[0].id, item_name: allSups[4]?.name || allSups[0].name, quantity_lost: 15.0,  unit: 'ml', cost: 14.25, reason: 'Amostragem para cliente — fora do padrão', operator: 'Vendas', occurred_at: d(-15) },
        )
      }
      if (allBatches.length > 0) {
        lossDefs.push(
          { loss_type: 'Evaporation', item_type: 'Batch', item_id: allBatches[0].id, item_name: allBatches[0].batch_code, quantity_lost: 25.0, unit: 'ml', cost: 7.00,  reason: 'Evaporação no período de maceração', operator: 'Produção', occurred_at: d(-28) },
          { loss_type: 'Breakage',    item_type: 'Batch', item_id: allBatches[1]?.id || allBatches[0].id, item_name: allBatches[1]?.batch_code || allBatches[0].batch_code, quantity_lost: 120.0, unit: 'ml', cost: 33.60, reason: 'Recipiente quebrado durante transferência', operator: 'Produção', occurred_at: d(-22) },
          { loss_type: 'Leakage',     item_type: 'Batch', item_id: allBatches[2]?.id || allBatches[0].id, item_name: allBatches[2]?.batch_code || allBatches[0].batch_code, quantity_lost:  40.0, unit: 'ml', cost: 11.20, reason: 'Vazamento na válvula do recipiente', operator: 'Armazenagem', occurred_at: d(-10) },
          { loss_type: 'Other',       item_type: 'Batch', item_id: allBatches[3]?.id || allBatches[0].id, item_name: allBatches[3]?.batch_code || allBatches[0].batch_code, quantity_lost:  10.0, unit: 'ml', cost: 2.80,  reason: 'Descartado em teste de qualidade', operator: 'QA', occurred_at: d(-5) },
          { loss_type: 'Expiration',  item_type: 'Batch', item_id: allBatches[4]?.id || allBatches[0].id, item_name: allBatches[4]?.batch_code || allBatches[0].batch_code, quantity_lost: 200.0, unit: 'ml', cost: 56.00, reason: 'Lote com formulação incorreta descartado', operator: 'QA', occurred_at: d(-3) },
        )
      }

      if (lossDefs.length > 0) {
        await knex('losses').insert(lossDefs)
        console.log(`✅ ${lossDefs.length} perdas registradas`)
      }
    }

    // ══════════════════════════════════════════════════════
    // DOAÇÕES (DONATIONS)
    // ══════════════════════════════════════════════════════
    const { count: donationCount } = await knex('donations').count('* as count').first()
    if (parseInt(donationCount) === 0) {
      const customers  = await knex('customers').select('id', 'name').limit(8)
      const products   = await knex('products').select('id', 'commercial_name', 'project_name').limit(5)
      const bottlings  = await knex('bottlings').select('id', 'product_name').limit(5)
      const today = new Date()
      const d = (delta) => { const dt = new Date(today); dt.setDate(dt.getDate() + delta); return dt }

      const donDefs = [
        { customer_id: customers[0]?.id, product_id: products[0]?.id, bottling_id: bottlings[0]?.id, product_name: products[0]?.commercial_name || 'Savage Gold',  volume_ml: 5,  quantity: 1, unit_cost: 1.35, total_cost: 1.35, donation_type: 'Sample',    reason: 'Amostra para avaliação de novo cliente', operator: 'Vendas',   donated_at: d(-50) },
        { customer_id: customers[1]?.id, product_id: products[1]?.id, bottling_id: bottlings[1]?.id, product_name: products[1]?.commercial_name || 'Blue Elegance', volume_ml: 3,  quantity: 2, unit_cost: 0.81, total_cost: 1.62, donation_type: 'Sample',    reason: 'Amostras em evento de lançamento', operator: 'Marketing', donated_at: d(-45) },
        { customer_id: customers[2]?.id, product_id: products[2]?.id, bottling_id: bottlings[2]?.id, product_name: products[2]?.commercial_name || 'Beautiful Life', volume_ml: 10, quantity: 1, unit_cost: 4.20, total_cost: 4.20, donation_type: 'Gift',      reason: 'Presente de aniversário para cliente VIP', operator: 'Gerência', donated_at: d(-40) },
        { customer_id: null,             product_id: products[0]?.id, bottling_id: null,             product_name: products[0]?.commercial_name || 'Savage Gold',  volume_ml: 15, quantity: 5, unit_cost: 5.35, total_cost: 26.75, donation_type: 'Promotion', reason: 'Campanha de marketing em redes sociais', operator: 'Marketing', donated_at: d(-35) },
        { customer_id: customers[3]?.id, product_id: products[3]?.id, bottling_id: bottlings[3]?.id, product_name: products[3]?.commercial_name || 'Gold Million',  volume_ml: 5,  quantity: 1, unit_cost: 1.92, total_cost: 1.92, donation_type: 'Sample',    reason: 'Amostra solicitada pelo cliente', operator: 'Vendas', donated_at: d(-30) },
        { customer_id: customers[4]?.id, product_id: products[4]?.id, bottling_id: bottlings[4]?.id, product_name: products[4]?.commercial_name || 'VIP Night',     volume_ml: 3,  quantity: 1, unit_cost: 1.10, total_cost: 1.10, donation_type: 'Sample',    reason: 'Primeira amostra — novo produto', operator: 'Vendas', donated_at: d(-25) },
        { customer_id: null,             product_id: products[1]?.id, bottling_id: null,             product_name: products[1]?.commercial_name || 'Blue Elegance', volume_ml: 10, quantity: 3, unit_cost: 5.22, total_cost: 15.66, donation_type: 'Charity',   reason: 'Doação para bazar beneficente', operator: 'Gerência', donated_at: d(-20) },
        { customer_id: customers[5]?.id, product_id: products[2]?.id, bottling_id: null,             product_name: products[2]?.commercial_name || 'Beautiful Life', volume_ml: 30, quantity: 1, unit_cost: 9.95, total_cost: 9.95, donation_type: 'Gift',      reason: 'Brinde por compra acima de R$ 500', operator: 'Vendas', donated_at: d(-15) },
        { customer_id: customers[6]?.id, product_id: products[0]?.id, bottling_id: null,             product_name: products[0]?.commercial_name || 'Savage Gold',  volume_ml: 5,  quantity: 2, unit_cost: 1.35, total_cost: 2.70, donation_type: 'Promotion', reason: 'Amostras de campanha Instagram', operator: 'Marketing', donated_at: d(-10) },
        { customer_id: customers[7]?.id, product_id: products[3]?.id, bottling_id: null,             product_name: products[3]?.commercial_name || 'Gold Million',  volume_ml: 15, quantity: 1, unit_cost: 4.78, total_cost: 4.78, donation_type: 'Gift',      reason: 'Brinde fidelidade — cliente 1 ano', operator: 'Gerência', donated_at: d(-5) },
      ]

      await knex('donations').insert(donDefs)
      console.log(`✅ ${donDefs.length} doações registradas`)
    }

    console.log('🎉 Dados de demonstração inseridos com sucesso!')

  } catch (error) {
    console.error('❌ Erro no seed de demonstração:', error.message)
    throw error
  }
}
