// ─── Nome de essência ─────────────────────────────────────────────────────────
// As essências são cadastradas com marca e inspiração dentro do nome, no padrão
// "Marca Insp.: Mancera - Inspiração: Cedrat Boise". O banco tem as duas
// grafias ("Inspiração" e "Inpiração"), então o regex aceita as duas — hoje as
// 492 essências de produção casam.
//
// Usado pelo resumo de essências e pelas notificações, para não exibir o nome
// cru (que fica ilegível numa lista).
const ESSENCE_NAME_RX = /^\s*marca\s+insp\.?\s*:\s*(.+?)\s*-\s*ins?pira[çc][ãa]o\s*:\s*(.+?)\s*$/i

function parseEssenceName (name) {
  const m = String(name || '').match(ESSENCE_NAME_RX)
  if (m) return { brand: m[1].trim(), essence: m[2].trim() }
  return { brand: '', essence: String(name || '').trim() }
}

// "Mancera · Cedrat Boise" — rótulo curto para listas e notificações.
function essenceLabel (name) {
  const { brand, essence } = parseEssenceName(name)
  return brand ? `${brand} · ${essence}` : essence
}

// ─── Identidade da essência ───────────────────────────────────────────────────
// Cada linha de `supplies` é uma COMPRA; a mesma essência aparece em várias
// (518 compras para 415 essências distintas em produção). A identidade é
// marca + essência, sem acento, caixa nem pontuação — é a chave de
// `product_essences` (vínculo essência ↔ projeto) e viaja pronta para a tela,
// para o front não ter de repetir esta regra de normalização.
//
// O laboratório fica DE FORA de propósito: a mesma essência comprada de dois
// laboratórios é a mesma essência para o projeto.
const normEssence = s => (s == null ? '' : String(s))
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Chave de identidade: `essenceKey('Mancera', 'Cedrat Boise')` → 'mancera||cedrat boise' */
function essenceKey (brand, essence) {
  return `${normEssence(brand)}||${normEssence(essence)}`
}

/** Mesma chave a partir do nome cru do insumo. */
function essenceKeyFromName (name) {
  const { brand, essence } = parseEssenceName(name)
  return essenceKey(brand, essence)
}

module.exports = {
  parseEssenceName, essenceLabel, ESSENCE_NAME_RX,
  essenceKey, essenceKeyFromName, normEssence,
}
