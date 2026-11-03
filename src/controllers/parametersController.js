const { invalidarCacheDoSegredo, PARAM_KEY: SYNC_SECRET_KEY } = require('../middleware/syncSecret')
const { invalidarCacheDePrecos, PARAM_KEY: PRECOS_SITE_KEY } = require('../services/precosSite')
const { db } = require('../models/db')

async function getAll (req, res) {
  try {
    const rows = await db('parameters').select('*').orderBy('key')
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function update (req, res) {
  try {
    const updates = req.body // { key: value, ... }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Body deve ser { key: value }' })
    }

    await db.transaction(async trx => {
      for (const [key, value] of Object.entries(updates)) {
        // Valor vazio nunca sobrescreve o que está gravado. Protege os parâmetros
        // de texto (ex. `order_summary_footer`, o rodapé do resumo do pedido) de
        // um cliente desatualizado que ainda renderize o campo como número e mande
        // "" no PUT — o que apagaria o texto inteiro. Nenhum parâmetro tem valor
        // vazio legítimo, então a regra vale para todos.
        if (String(value ?? '').trim() === '') continue
        await trx('parameters')
          .where('key', key)
          .update({ value: String(value), updated_at: trx.fn.now() })
      }
    })

    // O middleware de sincronizacao cacheia o segredo por 30s para nao fazer um
    // SELECT por requisicao. Se foi ele que mudou agora, zera o cache para o
    // valor novo valer na hora — senao quem acabou de colar o segredo na tela
    // leva meio minuto de 401 sem entender por que.
    if (Object.keys(updates).includes(SYNC_SECRET_KEY)) invalidarCacheDoSegredo()
    if (Object.keys(updates).includes(PRECOS_SITE_KEY)) invalidarCacheDePrecos()

    const rows = await db('parameters').select('*').orderBy('key')
    res.json(rows)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

module.exports = { getAll, update }
