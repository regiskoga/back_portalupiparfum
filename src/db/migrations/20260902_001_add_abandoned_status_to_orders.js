/**
 * Migration: add 'Abandoned' status to orders check constraint
 * Novo status "Carrinho abandonado" — pedido cancelado enquanto ainda estava em
 * Pendente (pré-pedido / carrinho). Distingue de um cancelamento de venda real.
 * Devolve estoque de brinde e estorna comissão igual ao cancelamento.
 * Recria a constraint preservando todos os valores atuais (inclui o legado
 * 'Finalizado' p/ não invalidar linhas existentes) + 'Abandoned'.
 */

exports.up = function (knex) {
  return knex.raw(`
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
      CHECK (status IN ('Pending','Confirmed','In Production','Ready','Shipped','Delivered','Cancelled','Finalizado','Lost','Abandoned'));
  `)
}

exports.down = function (knex) {
  return knex.raw(`
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
      CHECK (status IN ('Pending','Confirmed','In Production','Ready','Shipped','Delivered','Cancelled','Finalizado','Lost'));
  `)
}
