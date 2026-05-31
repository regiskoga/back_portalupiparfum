/**
 * Migration: Corrige insumos com quantity_available = 0 mas is_open = true.
 * Esses registros ficaram em limbo quando o auto-fechamento não disparou.
 */

exports.up = async function (knex) {
  await knex('supplies')
    .where('is_open', true)
    .where('quantity_available', '<=', 0)
    .update({ is_open: false, quantity_available: 0 })
}

exports.down = function () {}
