/**
 * Migration: Fix quantity_available = 0 for open supplies that still have quantity_purchased > 0.
 * Supplies created between 20260519 (when column was added) and 20260524 (when create() was fixed)
 * were saved with quantity_available = 0 due to a missing field in the insert.
 * Open supplies that have quantity_purchased > 0 but quantity_available = 0 are broken data.
 */

exports.up = async function (knex) {
  await knex.raw(`
    UPDATE supplies
    SET quantity_available = quantity_purchased
    WHERE quantity_available = 0
      AND quantity_purchased > 0
      AND is_open = true
  `)
}

exports.down = function (knex) {
  // Cannot reliably reverse — only roll back by restoring a backup
}
