/**
 * Migration one-shot: apaga TODOS os batches (lotes) da tela.
 * Solicitado pelo cliente para recomeçar a tela de Lotes do zero
 * após tentativas de importação com formato incorreto.
 *
 * Cascata:
 *   - batch_essences (RESTRICT — apaga primeiro)
 *   - bottling_batches (RESTRICT — apaga primeiro)
 *   - batch_transfers (RESTRICT — apaga primeiro)
 *   - bottling_orders (RESTRICT — apaga primeiro)
 *   - batch_movements (opcional — apaga se tabela existir)
 *   - batch_formula_items (opcional — apaga se tabela existir)
 *   - batches (última)
 *
 * Roda automaticamente no próximo deploy do Coolify.
 */

exports.up = async function (knex) {
  await knex.transaction(async (trx) => {
    const totalBatches = await trx('batches').count('* as t').first()
    const count = parseInt(totalBatches.t || 0)

    if (count === 0) {
      console.log('ℹ️  Nenhum batch pra apagar.')
      return
    }

    console.log(`🎯 Apagando ${count} batch(es) e todas as dependências…`)

    let beDeleted = 0, bbDeleted = 0, btDeleted = 0, boDeleted = 0, bmDeleted = 0, bfiDeleted = 0

    if (await trx.schema.hasTable('batch_essences')) {
      beDeleted = await trx('batch_essences').del()
    }
    if (await trx.schema.hasTable('bottling_batches')) {
      bbDeleted = await trx('bottling_batches').del()
    }
    if (await trx.schema.hasTable('batch_transfers')) {
      btDeleted = await trx('batch_transfers').del()
    }
    if (await trx.schema.hasTable('bottling_orders')) {
      boDeleted = await trx('bottling_orders').del()
    }
    if (await trx.schema.hasTable('batch_movements')) {
      bmDeleted = await trx('batch_movements').del()
    }
    if (await trx.schema.hasTable('batch_formula_items')) {
      bfiDeleted = await trx('batch_formula_items').del()
    }

    const batchesDeleted = await trx('batches').del()

    console.log(
      `✅ Limpeza de Lotes: ${batchesDeleted} batch(es), ` +
      `${beDeleted} batch_essence(s), ${bbDeleted} bottling_batch(es), ` +
      `${btDeleted} batch_transfer(s), ${boDeleted} bottling_order(s), ` +
      `${bmDeleted} batch_movement(s), ${bfiDeleted} batch_formula_item(s).`
    )
  })
}

exports.down = function () {
  // Sem reversão — dados foram apagados permanentemente.
}
