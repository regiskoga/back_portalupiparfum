/**
 * Seed: Kits and Coupons
 * Popula kits e cupons de exemplo
 */

exports.seed = async function(knex) {
  console.log('⏭️  Seed de kits e cupons desabilitado.')
  return
  // Verificar se já existem dados
  const existingKits = await knex('kits').count('* as count').first()
  const existingCoupons = await knex('coupons').count('* as count').first()

  // Só inserir se não existir
  if (parseInt(existingKits.count) === 0) {
    // ─── Kits ─────────────────────────────────────────────────────────────────
    await knex('kits').insert([
    {
      id: 1,
      name: 'Kit 3x15ml',
      description: 'Kit com 3 frascos de 15ml com desconto especial',
      quantity: 3,
      volume_ml: 15,
      discount_percentage: 10,
      active: true
    },
    {
      id: 2,
      name: 'Kit 2x30ml',
      description: 'Kit com 2 frascos de 30ml com desconto especial',
      quantity: 2,
      volume_ml: 30,
      discount_percentage: 15,
      active: true
    },
    {
      id: 3,
      name: 'Kit Descoberta 5x3ml',
      description: 'Kit descoberta com 5 miniaturas de 3ml',
      quantity: 5,
      volume_ml: 3,
      discount_percentage: 5,
      active: true
    },
    {
      id: 4,
      name: 'Kit Luxo 3x30ml',
      description: 'Kit luxo com 3 frascos de 30ml',
      quantity: 3,
      volume_ml: 30,
      discount_percentage: 20,
      active: true
    }
  ])
  }

  if (parseInt(existingCoupons.count) === 0) {
    // ─── Cupons ───────────────────────────────────────────────────────────────
    const now = new Date()
    const futureDate = new Date()
    futureDate.setMonth(futureDate.getMonth() + 3) // 3 meses no futuro

    await knex('coupons').insert([
    {
      id: 1,
      code: 'BEMVINDO10',
      description: 'Cupom de boas-vindas - 10% de desconto',
      type: 'Percentage',
      discount_value: 10,
      min_order_value: 50,
      max_uses: 100,
      current_uses: 0,
      active: true,
      valid_from: now,
      valid_until: futureDate
    },
    {
      id: 2,
      code: 'PRIMEIRACOMPRA',
      description: 'Primeira compra - R$ 20 de desconto',
      type: 'Fixed Amount',
      discount_value: 20,
      min_order_value: 100,
      max_uses: 50,
      current_uses: 0,
      active: true,
      valid_from: now,
      valid_until: futureDate
    },
    {
      id: 3,
      code: 'LEVE3PAGUE2',
      description: 'Leve 3 pague 2',
      type: 'Buy X Get Y',
      discount_value: 0,
      min_items: 3,
      free_items: 1,
      min_order_value: 0,
      max_uses: null, // Ilimitado
      current_uses: 0,
      active: true,
      valid_from: now,
      valid_until: futureDate
    },
    {
      id: 4,
      code: 'VERAO2026',
      description: 'Promoção de verão - 15% de desconto',
      type: 'Percentage',
      discount_value: 15,
      min_order_value: 150,
      max_uses: 200,
      current_uses: 0,
      active: true,
      valid_from: now,
      valid_until: futureDate
    },
    {
      id: 5,
      code: 'FRETEGRATIS',
      description: 'Frete grátis em compras acima de R$ 200',
      type: 'Fixed Amount',
      discount_value: 30, // Valor médio do frete
      min_order_value: 200,
      max_uses: null,
      current_uses: 0,
      active: true,
      valid_from: now,
      valid_until: futureDate
    },
    {
      id: 6,
      code: 'VIP20',
      description: 'Cupom VIP - 20% de desconto',
      type: 'Percentage',
      discount_value: 20,
      min_order_value: 300,
      max_uses: 20,
      current_uses: 0,
      active: true,
      valid_from: now,
      valid_until: futureDate
    }
  ])
  }

  console.log('✅ Kits e cupons criados com sucesso!')
}
