exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE batch_movements
    DROP CONSTRAINT IF EXISTS batch_movements_movement_type_check
  `)
  await knex.raw(`
    ALTER TABLE batch_movements
    ADD CONSTRAINT batch_movements_movement_type_check
    CHECK (movement_type IN (
      'production',
      'bottling',
      'loss',
      'donation',
      'transfer_out',
      'transfer_in',
      'adjustment',
      'maceration_start',
      'maceration_complete',
      'chorinho',
      'bottling_reversal'
    ))
  `)
}

exports.down = async function (knex) {
  await knex.raw(`
    ALTER TABLE batch_movements
    DROP CONSTRAINT IF EXISTS batch_movements_movement_type_check
  `)
  await knex.raw(`
    ALTER TABLE batch_movements
    ADD CONSTRAINT batch_movements_movement_type_check
    CHECK (movement_type IN (
      'production',
      'bottling',
      'loss',
      'donation',
      'transfer_out',
      'transfer_in',
      'adjustment'
    ))
  `)
}
