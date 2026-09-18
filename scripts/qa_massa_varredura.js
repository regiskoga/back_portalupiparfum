#!/usr/bin/env node
/**
 * Massa da varredura completa (18/09/2026). Planta de proposito as armadilhas
 * conhecidas: SKU com 2+ itens de pedido, batch_code duplicado, envase real x
 * historico, lote em maceracao.
 * SO RODA CONTRA localhost:5433 — aborta em qualquer outro host.
 *   cd backend && DATABASE_URL= DB_HOST=localhost DB_PORT=5433 DB_NAME=parfumerie \
 *     DB_USER=postgres DB_PASSWORD=postgres NODE_ENV=development node scripts/qa_massa_varredura.js
 */
const cfg = require('../knexfile').development
const c = cfg.connection
if (!['localhost', '127.0.0.1'].includes(String(c.host)) || String(c.port) !== '5433') {
  console.error(`ABORTADO: alvo e ${c.host}:${c.port}, nao o sandbox localhost:5433`)
  process.exit(1)
}
const db = require('knex')(cfg)
const hoje = '2026-09-18'

;(async () => {
  const ids = {}
  const ins = async (t, row) => (await db(t).insert(row).returning('id'))[0].id

  ids.lab      = await ins('suppliers', { name: 'Laboratório 4', type: 'Laboratório' })
  ids.forn_ess = await ins('suppliers', { name: 'Aromax QA', type: 'Essência' })
  ids.forn_emb = await ins('suppliers', { name: 'Frasco & Cia QA', type: 'Embalagem' })

  ids.ess = await ins('supplies', {
    name: 'Marca Insp.: Marca QA - Inspiração: Perfume QA', type: 'Essence',
    supplier_id: ids.forn_ess, unit: 'ml', quantity_purchased: 500, quantity_available: 500, total_amount_paid: 1000, is_formula_ingredient: true, is_open: true, purchase_date: hoje })
  ids.alc = await ins('supplies', {
    name: 'Álcool de Cereais QA', type: 'Base', supplier_id: ids.forn_ess, unit: 'ml',
    quantity_purchased: 5000, quantity_available: 5000, total_amount_paid: 500,
    is_formula_ingredient: true, purchase_date: hoje })
  ids.agua = await ins('supplies', {
    name: 'Água Destilada QA', type: 'Base', supplier_id: ids.forn_ess, unit: 'ml',
    quantity_purchased: 5000, quantity_available: 5000, total_amount_paid: 50,
    is_formula_ingredient: true, purchase_date: hoje })
  ids.frasco = await ins('supplies', {
    name: 'Frasco 50ml QA', type: 'Bottle', supplier_id: ids.forn_emb, unit: 'unit',
    quantity_purchased: 100, quantity_available: 100, total_amount_paid: 300,
    bottle_type: '50ml', purchase_date: hoje })
  ids.rotulo = await ins('supplies', {
    name: 'Rótulo QA', type: 'Label', supplier_id: ids.forn_emb, unit: 'unit',
    quantity_purchased: 100, quantity_available: 100, total_amount_paid: 50, purchase_date: hoje })

  ids.p1 = await ins('products', { project_name: 'Aura QA', sku: 'PFM - 00001',
    inspiration_brand: 'Marca QA', inspiration_name: 'Perfume QA', gender: 'Unissex', active: true })
  ids.p2 = await ins('products', { project_name: 'Esgotado QA', sku: 'PFM - 00002',
    inspiration_brand: 'Marca QA', inspiration_name: 'Outro QA', gender: 'Masculino', active: true })
  ids.p3 = await ins('products', { project_name: 'Sem Lote QA', sku: 'PFM - 00003',
    inspiration_brand: 'Marca QA', inspiration_name: 'Terceiro QA', gender: 'Feminino', active: true })

  ids.f1 = await ins('formulas', { product_id: ids.p1, name: 'Fórmula QA 100%',
    total_percentage: 100, essence_percentage: 20, active: true })
  await db('formula_items').insert([
    { formula_id: ids.f1, supply_id: ids.alc,  percentage: 70, order_index: 1 },
    { formula_id: ids.f1, supply_id: ids.agua, percentage: 10, order_index: 2 }])
  // F2 soma 70 (50 essencia + 20 alcool): tem que ser recusada na validacao.
  ids.f2 = await ins('formulas', { product_id: ids.p2, name: 'Fórmula QA 70%',
    total_percentage: 70, essence_percentage: 50, active: true })
  await db('formula_items').insert([{ formula_id: ids.f2, supply_id: ids.alc, percentage: 20, order_index: 1 }])

  ids.c1 = await ins('customers', { name: 'Cliente QA Um', phone: '11999990001', city: 'São Paulo', state: 'SP' })
  ids.c2 = await ins('customers', { name: 'Cliente QA Dois', phone: '11999990002' })

  ids.parceiro = await ins('partners', { name: 'Parceiro QA', default_commission_rate: 10, active: true })
  ids.cup_ok = await ins('coupons', { code: 'QAVALIDO', type: 'Fixed Amount', discount_value: 10,
    active: true, valid_from: '2026-01-01', valid_until: '2027-12-31', partner_id: ids.parceiro })
  ids.cup_exp = await ins('coupons', { code: 'QAEXPIRADO', type: 'Fixed Amount', discount_value: 10,
    active: true, valid_from: '2025-01-01', valid_until: '2025-12-31' })

  console.log(JSON.stringify(ids, null, 2))
  await db.destroy()
})().catch(e => { console.error('ERRO:', e.message); process.exit(1) })
