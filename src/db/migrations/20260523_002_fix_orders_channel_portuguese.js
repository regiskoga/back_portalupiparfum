/**
 * Migration: Atualiza constraint de channel em orders para valores em português
 * Frontend envia: WhatsApp, Instagram, Loja física, Site, Indicação, Outro
 */

exports.up = function (knex) {
  return knex.raw(`
    UPDATE orders SET channel = 'Loja física' WHERE channel = 'Physical Store';
    UPDATE orders SET channel = 'Site'        WHERE channel = 'Website';
    UPDATE orders SET channel = 'Indicação'   WHERE channel = 'Referral';
    UPDATE orders SET channel = 'Outro'       WHERE channel = 'Other';

    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_channel_check;
    ALTER TABLE orders ADD CONSTRAINT orders_channel_check
      CHECK (channel IN ('', 'WhatsApp', 'Instagram', 'Loja física', 'Site', 'Indicação', 'Outro'));
  `)
}

exports.down = function (knex) {
  return knex.raw(`
    UPDATE orders SET channel = 'Physical Store' WHERE channel = 'Loja física';
    UPDATE orders SET channel = 'Website'        WHERE channel = 'Site';
    UPDATE orders SET channel = 'Referral'       WHERE channel = 'Indicação';
    UPDATE orders SET channel = 'Other'          WHERE channel = 'Outro';

    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_channel_check;
    ALTER TABLE orders ADD CONSTRAINT orders_channel_check
      CHECK (channel IN ('', 'Physical Store', 'WhatsApp', 'Instagram', 'Website', 'Referral', 'Other'));
  `)
}
