const axios = require('axios')

const BASE = 'https://api.fragella.com/api/v1'

function getKey() {
  const key = process.env.FRAGELLA_API_KEY
  if (!key) throw new Error('FRAGELLA_API_KEY não configurada nas variáveis de ambiente')
  return key
}

function joinArray(arr) {
  if (!arr || !Array.isArray(arr)) return ''
  return arr.join(', ')
}

function extractAccords(accords) {
  if (!accords || !Array.isArray(accords)) return ''
  return accords
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
    .map(a => a.accord || a.name || a)
    .filter(Boolean)
    .join(', ')
}

function deriveDayNight(occasionRanking) {
  if (!occasionRanking || typeof occasionRanking !== 'object') return null
  const night = occasionRanking['Night Out'] ?? occasionRanking['Noite'] ?? 0
  const daily = occasionRanking['Daily']     ?? occasionRanking['Dia']   ?? 0
  if (night > daily) return 'Noite'
  if (daily > night) return 'Dia'
  return 'Ambos'
}

async function lookup(inspirationName, inspirationBrand) {
  if (!inspirationName) throw new Error('Nome do perfume original é necessário para a busca')

  const query = [inspirationBrand, inspirationName].filter(Boolean).join(' ')

  const { data } = await axios.get(`${BASE}/fragrances`, {
    params:  { search: query, limit: 5 },
    headers: { 'x-api-key': getKey() },
    timeout: 10000,
  })

  const results = Array.isArray(data) ? data : (data.results || data.data || [])
  if (results.length === 0) return null

  // Prefere resultado com marca correspondente, senão usa o primeiro
  const match = results.find(r =>
    inspirationBrand &&
    (r.Brand || '').toLowerCase().includes(inspirationBrand.toLowerCase())
  ) || results[0]

  return {
    found:          true,
    fragrance_name: match.Name  || match.name  || inspirationName,
    brand:          match.Brand || match.brand || inspirationBrand,
    suggestions: {
      top_notes:         joinArray(match.Top    || match.top_notes),
      heart_notes:       joinArray(match.Middle || match.heart_notes),
      base_notes:        joinArray(match.Base   || match.base_notes),
      main_accords:      extractAccords(match['Main Accords'] || match.accords),
      launch_year:       match.Year || match.year || null,
      day_night_profile: deriveDayNight(match['Occasion Ranking'] || match.occasion_ranking),
    },
  }
}

module.exports = { lookup }
