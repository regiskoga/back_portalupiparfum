// Confere em produção se a migration do `site_price` está registrada e se a
// coluna existe de fato. Só LÊ.
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })
const knex = require('knex')(require('../knexfile').development)

;(async () => {
  try {
    const mig = await knex('knex_migrations')
      .where('name', 'like', '%site_price%')
      .select('id', 'name', 'batch', 'migration_time')
    console.log('knex_migrations:', mig.length ? JSON.stringify(mig, null, 2) : '(nenhuma)')

    const col = await knex('information_schema.columns')
      .where('table_name', 'price_lists')
      .whereIn('column_name', ['price', 'site_price'])
      .select('column_name', 'data_type', 'numeric_precision', 'numeric_scale', 'is_nullable')
    console.log('\ncolunas de price_lists:')
    for (const c of col) {
      console.log(`  ${c.column_name.padEnd(12)} ${c.data_type}(${c.numeric_precision},${c.numeric_scale})  nullable=${c.is_nullable}`)
    }

    const [{ n: total }]   = await knex('price_lists').count('* as n')
    const [{ n: comSite }] = await knex('price_lists').whereNotNull('site_price').count('* as n')
    console.log(`\nprice_lists: ${total} linhas, ${comSite} com site_price preenchido`)

    const [{ n: pub }] = await knex('products')
      .where('active', true).whereNotNull('catalog_status').count('* as n')
    console.log(`products publicados (active + catalog_status): ${pub}`)
  } catch (e) {
    console.error('ERRO:', e.message)
    process.exitCode = 1
  } finally {
    await knex.destroy()
  }
})()
