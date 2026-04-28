# 🚀 Deploy do Sistema de Permissões

## 📋 Resumo

Implementação completa do sistema de permissões por perfil de usuário:

- **3 Perfis**: ADM, Vendedor, Visualizador
- **23 Telas** configuráveis com permissões granulares
- **Interface administrativa** para configuração
- **API completa** para gerenciamento

---

## 🗄️ Estrutura do Banco

### Novas Tabelas Criadas:

1. **`user_profiles`** - Perfis de usuário (ADM, Vendedor, Visualizador)
2. **`system_screens`** - Telas do sistema com categorização
3. **`profile_permissions`** - Permissões por perfil (view, create, edit, delete)

### Dados Iniciais:

- **3 perfis** pré-configurados
- **23 telas** categorizadas (Dashboard, Estoque, Produção, Comercial, Operações, Sistema)
- **Permissões padrão** por perfil

---

## 🚀 Como Fazer o Deploy

### Opção 1: Via API (Recomendado)

Após o deploy do código, execute:

```bash
POST https://seu-dominio.com/api/migrations/deploy
```

**Resposta esperada:**
```json
{
  "message": "Deploy executado com sucesso",
  "status": "deployed",
  "migrations": {
    "batch": 2,
    "executed": [
      "20260427_001_create_user_profiles.js",
      "20260427_002_create_system_screens.js", 
      "20260427_003_create_profile_permissions.js"
    ],
    "total": 28
  },
  "seeds": {
    "executed": [
      "20260427_001_user_profiles.js",
      "20260427_002_system_screens.js",
      "20260427_003_profile_permissions.js"
    ]
  }
}
```

### Opção 2: Via Script Node.js

No servidor, execute:

```bash
cd backend
npm run deploy:migrations
```

### Opção 3: Via Knex CLI

```bash
cd backend
npm run migrate:latest
npm run seed:run
```

---

## 🎯 Funcionalidades Implementadas

### Backend (API)

**Novos Endpoints:**
- `GET /api/user-permissions/profiles` - Listar perfis
- `GET /api/user-permissions/screens` - Listar telas
- `GET /api/user-permissions/profiles/:id/screens` - Telas com permissões
- `PUT /api/user-permissions/profiles/:id/permissions` - Atualizar permissões
- `GET /api/user-permissions/check/:profileId/:screenKey/:action` - Verificar permissão
- `POST /api/migrations/deploy` - Executar deploy das migrations

### Frontend

**Nova Página:**
- **Configuração de Perfis** (`/user-permissions`)
- Interface com dropdown de perfis
- Checkboxes para cada tela/permissão
- Agrupamento por categoria
- Salvamento via API

**Menu Lateral:**
- Nova seção "Sistema" com "Configuração de Perfis"

---

## 🔧 Como Usar

### 1. Acessar Configuração

1. Faça login no sistema
2. Vá em **Sistema > Configuração de Perfis**
3. Selecione um perfil no dropdown

### 2. Configurar Permissões

1. **Visualizar** - Permite ver a tela
2. **Criar** - Permite criar novos registros
3. **Editar** - Permite modificar registros
4. **Excluir** - Permite deletar registros

### 3. Salvar Configurações

1. Marque/desmarque as permissões desejadas
2. Clique em **"Salvar Configurações"**
3. Aguarde confirmação de sucesso

---

## 📊 Configuração Padrão dos Perfis

### ADM (Administrador)
- ✅ **Acesso total** a todas as telas
- ✅ **Todas as permissões** (view, create, edit, delete)
- ✅ **Configuração de perfis** (exclusivo)

### Vendedor
- ✅ **Dashboard**: Visão Geral, Vendas
- ✅ **Comercial**: Clientes, Pedidos, Kits, Cupons
- ✅ **Produtos**: Catálogo
- ✅ **Brindes**: Controle de brindes
- ❌ **Sem permissão** para deletar

### Visualizador
- ✅ **Dashboard**: Todas as abas
- ✅ **Estoque**: Insumos, Fornecedores (somente leitura)
- ✅ **Produção**: Produtos, Fórmulas, Lotes, Envases (somente leitura)
- ✅ **Clientes**: Consulta apenas
- ✅ **Rastreabilidade**: Consultas
- ❌ **Sem permissões** de criação, edição ou exclusão

---

## 🧪 Testes de Validação

### 1. Testar Conexão
```bash
GET /api/migrations/test
```

### 2. Verificar Status
```bash
GET /api/migrations/status
```

### 3. Listar Perfis
```bash
GET /api/user-permissions/profiles
```

### 4. Testar Permissão
```bash
GET /api/user-permissions/check/2/insumos/view
```

---

## 🔄 Próximos Passos

### Implementação de Autenticação
1. **Tabela de usuários** com campo `profile_id`
2. **Sistema de login** com JWT
3. **Middleware de autorização** nas rotas
4. **Controle no frontend** (esconder/mostrar menus)

### Melhorias Futuras
1. **Permissões por campo** (granularidade maior)
2. **Auditoria de permissões** (logs de mudanças)
3. **Perfis customizados** (além dos 3 padrão)
4. **Herança de permissões** (perfis hierárquicos)

---

## 📞 Suporte

### Logs Importantes
- **Backend**: Console do servidor mostra execução das migrations
- **Frontend**: DevTools > Console para erros de permissão
- **Banco**: Verificar tabelas `user_profiles`, `system_screens`, `profile_permissions`

### Troubleshooting
- **Erro de conexão**: Verificar `DATABASE_URL` no `.env`
- **Migration falha**: Verificar logs do servidor
- **Permissões não salvam**: Verificar network tab no DevTools

---

**Deploy preparado e pronto para produção! 🎉**

**Próximo passo**: Execute `POST /api/migrations/deploy` após o deploy do código.