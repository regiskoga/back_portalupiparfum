/**
 * Migration: add 'Lost' status to orders check constraint
 * Nova fase terminal "Perdido / Avariado" (pedido extraviado/quebrado) — pode ser
 * marcada de qualquer fase e NÃO devolve estoque (a mercadoria se perdeu).
 * Recria a constraint preservando todos os valores atuais (inclui o legado
 * 'Finalizado' p/ não invalidar linhas existentes) + 'Lost'.
 */

exports.up = function (knex) {
  return knex.raw(`
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
      CHECK (status IN ('Pending','Confirmed','In Production','Ready','Shipped','Delivered','Cancelled','Finalizado','Lost'));
  `)
}

exports.down = function (knex) {
  return knex.raw(`
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
      CHECK (status IN ('Pending','Confirmed','In Production','Ready','Shipped','Delivered','Cancelled','Finalizado'));
  `)
}
