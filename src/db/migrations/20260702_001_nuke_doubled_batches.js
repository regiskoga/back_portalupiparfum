/**
 * Migration one-shot: apaga batches criados pelo import bugado que
 * concatenou "Código do Lote" com "Projeto", gerando batch_code com
 * DOIS separadores " - " (Ex: "LOTE-00001 - Absolue Pour le Soir - Absolu Nocturne").
 *
 * Critério: batch_code LIKE '% - % - %' — só match quando existem ≥2
 * ocorrências de " - " no código. Batches originais (LOTE-00001, LOTE-00002…)
 * e batches novos importados após o fix (que têm no máximo um " - ")
 * são preservados.
 *
 * Também apaga as dependências em batch_essences, bottling_batches,
 * batch_transfers e bottling_orders — todas via CASCADE ou delete explícito.
 */

exports.up = async function (knex) {
  await knex.transaction(async (trx) => {
    // Encontra IDs dos batches com formato duplo
    const badBatches = await trx('batches')
      .whereRaw("batch_code LIKE '% - % - %'")
      .pluck('id')

    if (badBatches.length === 0) {
      console.log('ℹ️  Nenhum batch com formato duplo encontrado.')
      return
    }

    console.log(`🎯 Limpando ${badBatches.length} batch(es) com código no formato duplo…`)

    let beDeleted = 0
    let bbDeleted = 0
    let btDeleted = 0
    let boDeleted = 0

    if (await trx.schema.hasTable('batch_essences')) {
      beDeleted = await trx('batch_essences').whereIn('batch_id', badBatches).del()
    }
    if (await trx.schema.hasTable('bottling_batches')) {
      bbDeleted = await trx('bottling_batches').whereIn('batch_id', badBatches).del()
    }
    if (await trx.schema.hasTable('batch_transfers')) {
      btDeleted = await trx('batch_transfers')
        .whereIn('source_batch_id', badBatches)
        .orWhereIn('destination_batch_id', badBatches)
        .del()
    }
    if (await trx.schema.hasTable('bottling_orders')) {
      boDeleted = await trx('bottling_orders').whereIn('batch_id', badBatches).del()
    }

    const batchesDeleted = await trx('batches').whereIn('id', badBatches).del()

    console.log(
      `✅ Removidos: ${batchesDeleted} batch(es), ` +
      `${beDeleted} batch_essence(s), ${bbDeleted} bottling_batch(es), ` +
      `${btDeleted} batch_transfer(s), ${boDeleted} bottling_order(s).`
    )
  })
}

exports.down = function () {
  // Sem reversão — dados foram apagados permanentemente.
}
