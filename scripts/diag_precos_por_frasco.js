// Diagnóstico (08/11/2026): o que existe hoje como "preço por frasco" dentro do
// sistema — `packaging_types.suggested_price` — e como ele se compara ao
// parâmetro `precos_site` e à `price_lists`. Só LÊ.
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })
const knex = require('knex')(require('../knexfile').development)

;(async () => {
  try {
    const pt = await knex('packaging_types')
      .select('id', 'name', 'format',
        knex.raw('CAST(volume_ml AS float) as volume_ml'),
        knex.raw('CAST(suggested_price AS float) as suggested_price'),
        'active')
      .orderBy('volume_ml')
    console.log('packaging_types (Tipos de Embalagem):')
    for (const r of pt) {
      console.log(`  id=${String(r.id).padStart(3)} ${String(r.name).padEnd(22)} ${String(r.volume_ml).padStart(6)}ml  ` +
        `sugerido=${r.suggested_price === null ? '(null)' : r.suggested_price.toFixed(2).padStart(8)}  ` +
        `${r.format || ''} ${r.active ? '' : '[INATIVO]'}`)
    }

    const param = await knex('parameters').where('key', 'precos_site').first()
    console.log('\nparâmetro `precos_site` (bruto):')
    console.log((param && param.value ? String(param.value) : '(vazio)').split(/[\r\n]+/).map(l => '  ' + l).join('\n'))

    // Quantas linhas de price_lists existem por projeto — para saber se "lançar
    // valor no perfume" já é usado como exceção ou se é só a tabela repetida.
    const distintos = await knex('price_lists')
      .select(knex.raw('CAST(volume_ml AS float) as volume_ml'),
        knex.raw('CAST(price AS float) as price'))
      .count('* as n')
      .groupBy('volume_ml', 'price')
      .orderBy('volume_ml')
    console.log('\nprice_lists — TODOS os preços distintos já cadastrados (inclui vencidos):')
    for (const r of distintos) {
      console.log(`  ${String(r.volume_ml).padStart(6)}ml  ${r.price.toFixed(2).padStart(9)}  em ${r.n} linha(s)`)
    }
  } catch (e) {
    console.error('ERRO:', e.message)
    process.exitCode = 1
  } finally {
    await knex.destroy()
  }
})()
