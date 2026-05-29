/**
 * Seed: Produtos, Fórmulas e Lotes de exemplo
 */

exports.seed = async function(knex) {
  console.log('⏭️  Seed de dados de exemplo desabilitado.')
  return

  // Guard: não re-inserir se já existem dados
  const { count } = await knex('products').count('* as count').first()
  if (parseInt(count) > 0) {
    console.log('⏭️  Produtos já existem — seed 002 ignorado.')
    return
  }

  try {
    await knex('products').del()
    
    // ═══ PRODUTOS ═══
    const products = await knex('products').insert([
      {
        project_name: 'Inspirado em Sauvage',
        inspiration_brand: 'Dior',
        inspiration_name: 'Sauvage',
        commercial_name: 'Savage Gold',
        gender: 'Masculino',
        narrative: 'Uma interpretação moderna e sofisticada do clássico Sauvage, com notas amadeiradas e especiarias orientais.',
        top_notes: 'Bergamota, Pimenta Rosa, Limão',
        heart_notes: 'Gerânio, Lavanda, Elemi',
        base_notes: 'Âmbar, Patchouli, Vetiver',
        active: true
      },
      {
        project_name: 'Inspirado em Bleu de Chanel',
        inspiration_brand: 'Chanel',
        inspiration_name: 'Bleu de Chanel',
        commercial_name: 'Blue Elegance',
        gender: 'Masculino',
        narrative: 'Elegância atemporal em uma fragrância fresca e amadeirada, perfeita para o homem moderno.',
        top_notes: 'Limão, Hortelã, Toranja Rosa',
        heart_notes: 'Gengibre, Noz-moscada, Jasmim',
        base_notes: 'Incenso, Cedro, Sândalo',
        active: true
      },
      {
        project_name: 'Inspirado em La Vie Est Belle',
        inspiration_brand: 'Lancôme',
        inspiration_name: 'La Vie Est Belle',
        commercial_name: 'Beautiful Life',
        gender: 'Feminino',
        narrative: 'Uma celebração da feminilidade com notas doces e florais que despertam alegria e confiança.',
        top_notes: 'Groselha Preta, Pêra',
        heart_notes: 'Íris, Jasmim, Flor de Laranjeira',
        base_notes: 'Pralinê, Baunilha, Patchouli',
        active: true
      }
    ]).returning('*')
    
    console.log(`✅ ${products.length} produtos inseridos`)
    
    // ═══ FÓRMULAS ═══
    const formulas = await knex('formulas').insert([
      {
        product_id: products[0].id,
        name: 'Fórmula Base v1.0',
        description: 'Primeira versão da fórmula Savage Gold',
        total_percentage: 100.00,
        validated: true,
        active: true
      },
      {
        product_id: products[1].id,
        name: 'Fórmula Clássica v1.0',
        description: 'Versão clássica do Blue Elegance',
        total_percentage: 100.00,
        validated: true,
        active: true
      },
      {
        product_id: products[2].id,
        name: 'Fórmula Doce v1.0',
        description: 'Versão doce e floral do Beautiful Life',
        total_percentage: 100.00,
        validated: true,
        active: true
      }
    ]).returning('*')
    
    console.log(`✅ ${formulas.length} fórmulas inseridas`)
    
    // ═══ ITENS DAS FÓRMULAS ═══
    // Buscar alguns insumos para usar nas fórmulas
    const supplies = await knex('supplies').select('*').limit(10)
    
    if (supplies.length >= 3) {
      const formulaItems = []
      
      // Fórmula 1 - Savage Gold (Masculino)
      formulaItems.push(
        { formula_id: formulas[0].id, supply_id: supplies[0].id, percentage: 45.00, order_index: 1, notes: 'Base principal' },
        { formula_id: formulas[0].id, supply_id: supplies[1].id, percentage: 30.00, order_index: 2, notes: 'Notas de coração' },
        { formula_id: formulas[0].id, supply_id: supplies[2].id, percentage: 25.00, order_index: 3, notes: 'Fixador' }
      )
      
      // Fórmula 2 - Blue Elegance (Masculino)
      if (supplies.length >= 6) {
        formulaItems.push(
          { formula_id: formulas[1].id, supply_id: supplies[3].id, percentage: 40.00, order_index: 1, notes: 'Base amadeirada' },
          { formula_id: formulas[1].id, supply_id: supplies[4].id, percentage: 35.00, order_index: 2, notes: 'Notas frescas' },
          { formula_id: formulas[1].id, supply_id: supplies[5].id, percentage: 25.00, order_index: 3, notes: 'Fixação' }
        )
      }
      
      // Fórmula 3 - Beautiful Life (Feminino)
      if (supplies.length >= 9) {
        formulaItems.push(
          { formula_id: formulas[2].id, supply_id: supplies[6].id, percentage: 50.00, order_index: 1, notes: 'Base floral' },
          { formula_id: formulas[2].id, supply_id: supplies[7].id, percentage: 30.00, order_index: 2, notes: 'Doçura' },
          { formula_id: formulas[2].id, supply_id: supplies[8].id, percentage: 20.00, order_index: 3, notes: 'Fixador suave' }
        )
      }
      
      await knex('formula_items').insert(formulaItems)
      console.log(`✅ ${formulaItems.length} itens de fórmulas inseridos`)
    }
    
    // ═══ LOTES ═══
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const macerationEnd = new Date(today)
    macerationEnd.setDate(macerationEnd.getDate() + 9) // 10 dias de maceração
    
    const batches = await knex('batches').insert([
      {
        formula_id: formulas[0].id,
        batch_code: 'SG001-2024',
        production_date: yesterday,
        quantity_ml: 500.00,
        remaining_ml: 500.00,
        total_cost: 125.50,
        cost_per_ml: 0.251,
        status: 'Em maceração',
        maceration_start: yesterday,
        maceration_end: macerationEnd,
        notes: 'Primeiro lote de produção do Savage Gold'
      },
      {
        formula_id: formulas[1].id,
        batch_code: 'BE001-2024',
        production_date: yesterday,
        quantity_ml: 300.00,
        remaining_ml: 300.00,
        total_cost: 89.70,
        cost_per_ml: 0.299,
        status: 'Em maceração',
        maceration_start: yesterday,
        maceration_end: macerationEnd,
        notes: 'Lote teste do Blue Elegance'
      }
    ]).returning('*')
    
    console.log(`✅ ${batches.length} lotes inseridos`)
    
    // ═══ MOVIMENTAÇÕES DOS LOTES ═══
    const movements = []
    
    batches.forEach(batch => {
      movements.push({
        batch_id: batch.id,
        movement_type: 'production',
        quantity_ml: batch.quantity_ml,
        previous_ml: 0,
        current_ml: batch.quantity_ml,
        notes: `Produção inicial do lote ${batch.batch_code}`,
        operator: 'system'
      })
    })
    
    await knex('batch_movements').insert(movements)
    console.log(`✅ ${movements.length} movimentações de lote inseridas`)
    
    console.log('🎉 Dados de exemplo inseridos com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro ao inserir dados de exemplo:', error.message)
    throw error
  }
}