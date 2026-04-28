-- ===================================================================
-- SISTEMA DE PERMISSÕES - CRIAÇÃO DAS TABELAS
-- ===================================================================

-- 1. Tabela de Perfis de Usuário
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Telas do Sistema
CREATE TABLE IF NOT EXISTS system_screens (
    id SERIAL PRIMARY KEY,
    screen_key TEXT NOT NULL UNIQUE,
    screen_name TEXT NOT NULL,
    category TEXT DEFAULT '',
    route TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Permissões por Perfil
CREATE TABLE IF NOT EXISTS profile_permissions (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    screen_id INTEGER NOT NULL REFERENCES system_screens(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(profile_id, screen_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_profile_permissions_profile_screen 
ON profile_permissions(profile_id, screen_id);

-- ===================================================================
-- DADOS INICIAIS
-- ===================================================================

-- Inserir perfis padrão
INSERT INTO user_profiles (id, name, description, is_active) VALUES
(1, 'ADM', 'Administrador - Acesso total ao sistema', true),
(2, 'Vendedor', 'Vendedor - Acesso comercial e clientes', true),
(3, 'Visualizador', 'Visualizador - Apenas leitura e relatórios', true)
ON CONFLICT (name) DO NOTHING;

-- Inserir telas do sistema
INSERT INTO system_screens (id, screen_key, screen_name, category, route, sort_order) VALUES
-- Dashboard
(1, 'dashboard-overview', 'Dashboard - Visão Geral', 'Dashboard', 'dashboard', 1),
(2, 'dashboard-production', 'Dashboard - Produção', 'Dashboard', 'dashboard', 2),
(3, 'dashboard-financial', 'Dashboard - Financeiro', 'Dashboard', 'dashboard', 3),
(4, 'dashboard-alerts', 'Dashboard - Alertas', 'Dashboard', 'dashboard', 4),
(5, 'dashboard-sales', 'Dashboard - Vendas', 'Dashboard', 'dashboard', 5),

-- Estoque
(10, 'insumos', 'Insumos', 'Estoque', 'insumos', 10),
(11, 'fornecedores', 'Fornecedores', 'Estoque', 'fornecedores', 11),

-- Produção
(20, 'produtos', 'Produtos', 'Produção', 'produtos', 20),
(21, 'formulas', 'Fórmulas', 'Produção', 'formulas', 21),
(22, 'lotes', 'Lotes', 'Produção', 'lotes', 22),
(23, 'envases', 'Envases', 'Produção', 'envases', 23),

-- Comercial
(30, 'clientes', 'Clientes', 'Comercial', 'clientes', 30),
(31, 'orders', 'Pedidos', 'Comercial', 'orders', 31),
(32, 'kits', 'Kits', 'Comercial', 'kits', 32),
(33, 'coupons', 'Cupons', 'Comercial', 'coupons', 33),

-- Operações
(40, 'losses', 'Perdas', 'Operações', 'losses', 40),
(41, 'donations', 'Doações', 'Operações', 'donations', 41),
(42, 'batch-transfers', 'Transferências de Lote', 'Operações', 'batch-transfers', 42),
(43, 'occurrences', 'Ocorrências', 'Operações', 'occurrences', 43),

-- Sistema
(50, 'traceability', 'Rastreabilidade', 'Sistema', 'traceability', 50),
(51, 'customer-gifts', 'Brindes de Cliente', 'Sistema', 'customer-gifts', 51),
(52, 'system-rules', 'Regras do Sistema', 'Sistema', 'system-rules', 52),
(53, 'user-permissions', 'Configuração de Perfis', 'Sistema', 'user-permissions', 53)
ON CONFLICT (screen_key) DO NOTHING;

-- ===================================================================
-- PERMISSÕES PADRÃO
-- ===================================================================

-- ADM - Acesso total a tudo
INSERT INTO profile_permissions (profile_id, screen_id, can_view, can_create, can_edit, can_delete)
SELECT 1, id, true, true, true, true 
FROM system_screens
ON CONFLICT (profile_id, screen_id) DO NOTHING;

-- Vendedor - Acesso comercial
INSERT INTO profile_permissions (profile_id, screen_id, can_view, can_create, can_edit, can_delete)
SELECT 2, id, true, true, true, false 
FROM system_screens 
WHERE screen_key IN (
    'dashboard-overview', 'dashboard-sales',
    'clientes', 'orders', 'kits', 'coupons',
    'produtos', 'customer-gifts'
)
ON CONFLICT (profile_id, screen_id) DO NOTHING;

-- Visualizador - Apenas leitura
INSERT INTO profile_permissions (profile_id, screen_id, can_view, can_create, can_edit, can_delete)
SELECT 3, id, true, false, false, false 
FROM system_screens 
WHERE screen_key IN (
    'dashboard-overview', 'dashboard-production', 'dashboard-financial', 'dashboard-sales',
    'insumos', 'fornecedores', 'produtos', 'formulas', 'lotes', 'envases',
    'clientes', 'traceability'
)
ON CONFLICT (profile_id, screen_id) DO NOTHING;

-- ===================================================================
-- VERIFICAÇÃO
-- ===================================================================

-- Verificar se tudo foi criado
SELECT 'user_profiles' as tabela, COUNT(*) as registros FROM user_profiles
UNION ALL
SELECT 'system_screens' as tabela, COUNT(*) as registros FROM system_screens
UNION ALL
SELECT 'profile_permissions' as tabela, COUNT(*) as registros FROM profile_permissions;

-- Mostrar configuração dos perfis
SELECT 
    up.name as perfil,
    ss.category,
    ss.screen_name,
    pp.can_view,
    pp.can_create,
    pp.can_edit,
    pp.can_delete
FROM profile_permissions pp
JOIN user_profiles up ON pp.profile_id = up.id
JOIN system_screens ss ON pp.screen_id = ss.id
ORDER BY up.name, ss.category, ss.sort_order;