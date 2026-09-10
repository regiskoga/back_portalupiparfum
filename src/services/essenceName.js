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

module.exports = { parseEssenceName, essenceLabel, ESSENCE_NAME_RX }
