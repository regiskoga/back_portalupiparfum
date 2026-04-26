const { getDb } = require('../models/db')

const db = getDb()

// ─── Limpa dados existentes (mantém fornecedores do seed inicial) ─────────────
db.exec('DELETE FROM insumos')

// ─── Busca IDs dos fornecedores ───────────────────────────────────────────────
const fornecedores = db.prepare('SELECT id, nome FROM fornecedores').all()
const fid = {}
fornecedores.forEach(f => {
  if (f.nome.includes('Aromax'))   fid.aromax   = f.id
  if (f.nome.includes('QuimiBase'))fid.quimi    = f.id
  if (f.nome.includes('EmbalMax')) fid.embal    = f.id
  if (f.nome.includes('Frasco'))   fid.frasco   = f.id
  if (f.nome.includes('Rótulo'))   fid.rotulo   = f.id
})

// ─── Dados de insumos ─────────────────────────────────────────────────────────
const insumos = [
  // Essências — Aromax
  { nome: 'Óleo essencial de lavanda',       tipo: 'Essência',   fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 500,   valor_total_pago: 320.00,  lote: 'LOT-2024-001', observacoes: 'Grau cosmético, origem francesa' },
  { nome: 'Óleo essencial de bergamota',     tipo: 'Essência',   fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 250,   valor_total_pago: 210.50,  lote: 'LOT-2024-002', observacoes: 'Alta concentração, nota de topo' },
  { nome: 'Óleo essencial de sândalo',       tipo: 'Essência',   fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 100,   valor_total_pago: 480.00,  lote: 'LOT-2024-003', observacoes: 'Nota de fundo, fixador natural' },
  { nome: 'Absoluto de jasmim',              tipo: 'Essência',   fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 50,    valor_total_pago: 890.00,  lote: 'LOT-2024-004', observacoes: 'Extrato absoluto premium' },
  { nome: 'Óleo essencial de rosa búlgara',  tipo: 'Essência',   fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 30,    valor_total_pago: 1250.00, lote: 'LOT-2024-005', observacoes: 'Rosa damascena, colheita 2024' },
  { nome: 'Óleo essencial de patchouli',     tipo: 'Essência',   fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 300,   valor_total_pago: 195.00,  lote: 'LOT-2024-006', observacoes: '' },
  { nome: 'Óleo essencial de cedro',         tipo: 'Essência',   fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 400,   valor_total_pago: 160.00,  lote: 'LOT-2024-007', observacoes: 'Cedro virgínia, nota amadeirada' },
  { nome: 'Absoluto de baunilha',            tipo: 'Essência',   fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 200,   valor_total_pago: 540.00,  lote: 'LOT-2024-008', observacoes: 'Vanilla planifolia, Madagascar' },
  { nome: 'Óleo essencial de neroli',        tipo: 'Essência',   fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 80,    valor_total_pago: 720.00,  lote: 'LOT-2024-009', observacoes: 'Flor de laranjeira amarga' },
  { nome: 'Óleo essencial de ylang-ylang',   tipo: 'Essência',   fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 150,   valor_total_pago: 285.00,  lote: 'LOT-2024-010', observacoes: 'Extra grau I' },

  // Bases — Aromax
  { nome: 'Base alcoólica neutra 96°',       tipo: 'Base',       fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 5000,  valor_total_pago: 380.00,  lote: 'LOT-2024-011', observacoes: 'Álcool etílico desnaturado' },
  { nome: 'Base aquosa desmineralizada',     tipo: 'Base',       fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 10000, valor_total_pago: 120.00,  lote: 'LOT-2024-012', observacoes: '' },
  { nome: 'Base fixadora amber',             tipo: 'Base',       fornecedor_id: fid.aromax, unidade: 'ml',      quantidade_comprada: 1000,  valor_total_pago: 450.00,  lote: 'LOT-2024-013', observacoes: 'Aumenta longevidade da fragrância' },

  // Químicos — QuimiBase
  { nome: 'Iso E Super',                     tipo: 'Químico',    fornecedor_id: fid.quimi,  unidade: 'ml',      quantidade_comprada: 500,   valor_total_pago: 620.00,  lote: 'LOT-2024-014', observacoes: 'Aroma amadeirado sintético, amplificador' },
  { nome: 'Hedione',                         tipo: 'Químico',    fornecedor_id: fid.quimi,  unidade: 'ml',      quantidade_comprada: 300,   valor_total_pago: 390.00,  lote: 'LOT-2024-015', observacoes: 'Nota floral jasmim, difusor' },
  { nome: 'Ambroxan',                        tipo: 'Químico',    fornecedor_id: fid.quimi,  unidade: 'g',       quantidade_comprada: 100,   valor_total_pago: 980.00,  lote: 'LOT-2024-016', observacoes: 'Âmbar sintético premium, fixador' },
  { nome: 'Galaxolide 50% IPM',              tipo: 'Químico',    fornecedor_id: fid.quimi,  unidade: 'ml',      quantidade_comprada: 500,   valor_total_pago: 310.00,  lote: 'LOT-2024-017', observacoes: 'Almíscar sintético' },
  { nome: 'Linalool',                        tipo: 'Químico',    fornecedor_id: fid.quimi,  unidade: 'ml',      quantidade_comprada: 1000,  valor_total_pago: 280.00,  lote: 'LOT-2024-018', observacoes: 'Componente floral-lavanda' },
  { nome: 'Citronelol',                      tipo: 'Químico',    fornecedor_id: fid.quimi,  unidade: 'ml',      quantidade_comprada: 500,   valor_total_pago: 195.00,  lote: 'LOT-2024-019', observacoes: 'Rosa-cítrico' },
  { nome: 'Eugenol',                         tipo: 'Químico',    fornecedor_id: fid.quimi,  unidade: 'ml',      quantidade_comprada: 250,   valor_total_pago: 145.00,  lote: 'LOT-2024-020', observacoes: 'Cravo, especiaria' },
  { nome: 'Benzyl alcohol',                  tipo: 'Químico',    fornecedor_id: fid.quimi,  unidade: 'ml',      quantidade_comprada: 1000,  valor_total_pago: 160.00,  lote: 'LOT-2024-021', observacoes: 'Solvente e fixador' },
  { nome: 'DPG — Dipropilenoglicol',         tipo: 'Químico',    fornecedor_id: fid.quimi,  unidade: 'ml',      quantidade_comprada: 2000,  valor_total_pago: 220.00,  lote: 'LOT-2024-022', observacoes: 'Diluente e carreador' },

  // Embalagens — EmbalMax
  { nome: 'Caixa kraft 50ml personalizada',  tipo: 'Embalagem',  fornecedor_id: fid.embal,  unidade: 'unidade', quantidade_comprada: 500,   valor_total_pago: 875.00,  lote: 'LOT-2024-023', observacoes: 'Impressão dourada, fechamento magnético' },
  { nome: 'Caixa rígida 100ml premium',      tipo: 'Embalagem',  fornecedor_id: fid.embal,  unidade: 'unidade', quantidade_comprada: 300,   valor_total_pago: 1050.00, lote: 'LOT-2024-024', observacoes: 'Veludo interno preto' },
  { nome: 'Saco organza dourado P',          tipo: 'Embalagem',  fornecedor_id: fid.embal,  unidade: 'unidade', quantidade_comprada: 1000,  valor_total_pago: 320.00,  lote: 'LOT-2024-025', observacoes: '10x15cm' },
  { nome: 'Fita cetim dourada 1cm',          tipo: 'Embalagem',  fornecedor_id: fid.embal,  unidade: 'unidade', quantidade_comprada: 200,   valor_total_pago: 180.00,  lote: 'LOT-2024-026', observacoes: 'Rolo 50m cada' },

  // Frascos — Frasco & Cia
  { nome: 'Frasco vidro Boston 50ml',        tipo: 'Frasco',     fornecedor_id: fid.frasco, unidade: 'unidade', quantidade_comprada: 500,   valor_total_pago: 1250.00, lote: 'LOT-2024-027', observacoes: 'Vidro âmbar, tampa preta' },
  { nome: 'Frasco vidro Flacon 100ml',       tipo: 'Frasco',     fornecedor_id: fid.frasco, unidade: 'unidade', quantidade_comprada: 300,   valor_total_pago: 1380.00, lote: 'LOT-2024-028', observacoes: 'Cristal transparente, spray dourado' },
  { nome: 'Frasco vidro Atomizador 30ml',    tipo: 'Frasco',     fornecedor_id: fid.frasco, unidade: 'unidade', quantidade_comprada: 800,   valor_total_pago: 1440.00, lote: 'LOT-2024-029', observacoes: 'Viagem, spray fino' },
  { nome: 'Frasco roll-on 10ml',             tipo: 'Frasco',     fornecedor_id: fid.frasco, unidade: 'unidade', quantidade_comprada: 1000,  valor_total_pago: 850.00,  lote: 'LOT-2024-030', observacoes: 'Esfera aço inox' },
  { nome: 'Frasco decant 5ml',               tipo: 'Frasco',     fornecedor_id: fid.frasco, unidade: 'unidade', quantidade_comprada: 2000,  valor_total_pago: 900.00,  lote: 'LOT-2024-031', observacoes: 'Spray mini, amostras' },

  // Rótulos — RótuloArt
  { nome: 'Rótulo adesivo frente 50ml',      tipo: 'Rótulo',     fornecedor_id: fid.rotulo, unidade: 'unidade', quantidade_comprada: 1000,  valor_total_pago: 480.00,  lote: 'LOT-2024-032', observacoes: 'Papel couché 120g, laminação fosca' },
  { nome: 'Rótulo adesivo frente 100ml',     tipo: 'Rótulo',     fornecedor_id: fid.rotulo, unidade: 'unidade', quantidade_comprada: 600,   valor_total_pago: 390.00,  lote: 'LOT-2024-033', observacoes: 'Hot stamping dourado' },
  { nome: 'Rótulo traseiro INCI 50ml',       tipo: 'Rótulo',     fornecedor_id: fid.rotulo, unidade: 'unidade', quantidade_comprada: 1000,  valor_total_pago: 280.00,  lote: 'LOT-2024-034', observacoes: 'Lista INCI completa, QR code' },
  { nome: 'Rótulo traseiro INCI 100ml',      tipo: 'Rótulo',     fornecedor_id: fid.rotulo, unidade: 'unidade', quantidade_comprada: 600,   valor_total_pago: 210.00,  lote: 'LOT-2024-035', observacoes: '' },
  { nome: 'Etiqueta lacre dourada',          tipo: 'Rótulo',     fornecedor_id: fid.rotulo, unidade: 'unidade', quantidade_comprada: 2000,  valor_total_pago: 340.00,  lote: 'LOT-2024-036', observacoes: 'Holográfica, anti-falsificação' },
]

// ─── Insere tudo ──────────────────────────────────────────────────────────────
const insert = db.prepare(`
  INSERT INTO insumos (nome, tipo, fornecedor_id, unidade, quantidade_comprada, valor_total_pago, lote, observacoes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

let ok = 0
insumos.forEach(i => {
  try {
    insert.run(i.nome, i.tipo, i.fornecedor_id, i.unidade, i.quantidade_comprada, i.valor_total_pago, i.lote, i.observacoes)
    ok++
  } catch (e) {
    console.error(`  ✗ ${i.nome}: ${e.message}`)
  }
})

console.log(`\n✦ Seed concluído — ${ok}/${insumos.length} insumos inseridos\n`)

// ─── Resumo por tipo ──────────────────────────────────────────────────────────
const resumo = db.prepare(`
  SELECT tipo, COUNT(*) as qtd, ROUND(SUM(valor_total_pago),2) as total
  FROM insumos GROUP BY tipo ORDER BY total DESC
`).all()

console.log('  Tipo          Qtd   Valor total')
console.log('  ' + '─'.repeat(38))
resumo.forEach(r => {
  console.log(`  ${r.tipo.padEnd(14)} ${String(r.qtd).padStart(3)}   R$ ${r.total.toFixed(2)}`)
})
console.log()
