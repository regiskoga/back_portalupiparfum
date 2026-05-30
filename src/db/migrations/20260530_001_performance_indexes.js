/**
 * Performance: índices compostos e simples para consultas frequentes.
 * Usa CREATE INDEX IF NOT EXISTS para ser idempotente.
 */
exports.up = function (knex) {
  return knex.raw(`
    -- order_items: product_id é chave de subquery em products.list() e committed_ml
    CREATE INDEX IF NOT EXISTS idx_order_items_product_id
      ON order_items(product_id);

    -- orders: índice composto para filtro de status + ordenação por data
    CREATE INDEX IF NOT EXISTS idx_orders_status_created
      ON orders(status, created_at DESC);

    -- orders: range de datas usado em dashboard e relatórios
    CREATE INDEX IF NOT EXISTS idx_orders_created_at
      ON orders(created_at DESC);

    -- batches: product_id para joins de dashboard e consulta de lotes
    CREATE INDEX IF NOT EXISTS idx_batches_product_id
      ON batches(product_id);

    -- batches: índice composto para queries de lotes prontos/maceração com saldo
    CREATE INDEX IF NOT EXISTS idx_batches_status_remaining
      ON batches(status, remaining_ml);

    -- supplies: campos de filtro usados em insumos e alertas
    CREATE INDEX IF NOT EXISTS idx_supplies_is_formula_ingredient
      ON supplies(is_formula_ingredient);

    CREATE INDEX IF NOT EXISTS idx_supplies_is_open
      ON supplies(is_open);

    CREATE INDEX IF NOT EXISTS idx_supplies_receipt_status
      ON supplies(receipt_status);

    CREATE INDEX IF NOT EXISTS idx_supplies_quantity_available
      ON supplies(quantity_available);

    -- bottlings: saldo disponível para linkBottling e dropdown
    CREATE INDEX IF NOT EXISTS idx_bottlings_quantity_available
      ON bottlings(quantity_available);

    CREATE INDEX IF NOT EXISTS idx_bottlings_active
      ON bottlings(active);
  `)
}

exports.down = function (knex) {
  return knex.raw(`
    DROP INDEX IF EXISTS idx_order_items_product_id;
    DROP INDEX IF EXISTS idx_orders_status_created;
    DROP INDEX IF EXISTS idx_orders_created_at;
    DROP INDEX IF EXISTS idx_batches_product_id;
    DROP INDEX IF EXISTS idx_batches_status_remaining;
    DROP INDEX IF EXISTS idx_supplies_is_formula_ingredient;
    DROP INDEX IF EXISTS idx_supplies_is_open;
    DROP INDEX IF EXISTS idx_supplies_receipt_status;
    DROP INDEX IF EXISTS idx_supplies_quantity_available;
    DROP INDEX IF EXISTS idx_bottlings_quantity_available;
    DROP INDEX IF EXISTS idx_bottlings_active;
  `)
}
