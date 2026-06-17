-- =============================================================
-- RESET DE DADOS PARA DEPLOY
-- Remove todos os dados operacionais (clientes, pedidos, lotes,
-- insumos, envases, etc.) e preserva os dados de sistema:
--   • users / sessions
--   • user_profiles / system_screens / profile_permissions
--   • parameters
--   • system_rules / system_rules_history / system_rules_notifications
--   • packaging_types / volume_discounts
--   • knex_migrations / knex_migrations_lock
--
-- Banco: PostgreSQL
-- Como rodar:
--   psql -h <host> -U <user> -d <database> -f reset_para_deploy.sql
-- =============================================================

BEGIN;

TRUNCATE TABLE
  -- Auditoria e logs
  activity_logs,

  -- Maceração
  maceration_checkins,

  -- Lotes
  batch_essences,
  batch_formula_items,
  batch_movements,
  batch_transfers,
  batches,

  -- Envases
  bottling_batches,
  bottlings,

  -- Pedidos
  order_item_bottlings,
  order_gifts,
  order_items,
  orders,

  -- Fila de produção automática
  bottling_orders,
  production_orders,
  purchase_orders,

  -- Pós-venda
  occurrences,
  customer_gifts,
  losses,
  donations,

  -- Produtos e produção
  price_lists,
  formula_items,
  formulas,
  products,

  -- Insumos e fornecedores
  supplies,
  suppliers,

  -- Clientes
  customers,

  -- Promoções
  coupons,
  kits

RESTART IDENTITY CASCADE;

COMMIT;
