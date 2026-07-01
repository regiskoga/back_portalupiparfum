/**
 * Migration one-shot: apaga TODAS as essências (supplies type='Essence')
 * e todas as referências que as impedem (batch_essences, formula_items,
 * purchase_orders). Solicitado pelo cliente para começar do zero na
 * tela de Compras de Essências.
 *
 * Impacto:
 *   - batch_essences: apaga vínculos (RESTRICT quebraria sem isso)
 *   - formula_items: apaga vínculos com essências (RESTRICT)
 *   - purchase_orders: apaga ordens de compra de essências (RESTRICT)
 *   - supplies: apaga rows onde type='Essence'
 *   - bottlings.bottle_supply_id / label_supply_id não são afetados
 *     (essências não são frascos nem rótulos)
 */

exports.up = async function (knex) {
  await knex.transaction(async (trx) => {
    const essenceIds = await trx('supplies')
      .where('type', 'Essence')
      .pluck('id')

    if (essenceIds.length === 0) {
      console.log('ℹ️  Nenhuma essência para apagar.')
      return
    }

    // Ordem: dependências primeiro, essências depois.
    const beDeleted = await trx('batch_essences').whereIn('supply_id', essenceIds).del()
    const fiDeleted = await trx('formula_items').whereIn('supply_id', essenceIds).del()

    // purchase_orders só existe em bases mais antigas — verifica antes.
    let poDeleted = 0
    if (await trx.schema.hasTable('purchase_orders')) {
      poDeleted = await trx('purchase_orders').whereIn('supply_id', essenceIds).del()
    }

    const suppliesDeleted = await trx('supplies').whereIn('id', essenceIds).del()

    console.log(`✅ Limpeza de essências: ${suppliesDeleted} essência(s), ${beDeleted} batch_essence(s), ${fiDeleted} formula_item(s), ${poDeleted} purchase_order(s) apagados.`)
  })
}

exports.down = function () {
  // Não há como reverter — dados apagados permanentemente.
  // Se quiser voltar, restaure de backup.
}
