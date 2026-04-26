# 🌸 Parfumerie Backend — API REST

API REST para o sistema de gestão de perfumaria com PostgreSQL.

## 🛠️ Tecnologias

- **Node.js 18+**
- **Express** — Framework web
- **PostgreSQL** + `Knex.js` — Banco de dados e query builder
- **Supabase** — Hosting PostgreSQL
- **express-validator** — Validação de dados
- **CORS** — Controle de acesso

## 📁 Estrutura

```
backend/
├── src/
│   ├── server.js              # Servidor Express
│   ├── models/
│   │   └── db.js             # Configuração Knex
│   ├── controllers/
│   │   ├── insumosController.js    # Supplies (inglês)
│   │   ├── fornecedoresController.js # Suppliers (inglês)
│   │   └── clientesController.js   # Customers (inglês)
│   ├── routes/
│   │   ├── insumos.js         # Supplies routes
│   │   ├── fornecedores.js    # Suppliers routes
│   │   └── clientes.js        # Customers routes
│   ├── middleware/
│   │   └── validate.js
│   └── db/
│       ├── migrations/        # Migrations Knex
│       └── seeds/            # Seeds para popular banco
├── knexfile.js               # Configuração Knex
├── .env                      # Variáveis de ambiente
└── package.json
```

## 🚀 Como Rodar

### Pré-requisitos
- Conta no [Supabase](https://supabase.com) ou PostgreSQL local

### Instalação

```bash
npm install
```

### Configuração

1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

2. Configure suas credenciais do Supabase no `.env`:
```env
DB_HOST=db.xxxxx.supabase.co
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD="sua_senha_aqui"
```

**⚠️ IMPORTANTE:** Nunca commite o arquivo `.env` com credenciais reais! O `.gitignore` já está configurado para protegê-lo.

3. Execute migrations e seeds:
```bash
npm run db:setup
```

### Desenvolvimento

```bash
npm start
```

A API estará disponível em `http://localhost:3001`

## 📡 API Endpoints

### Base URL
```
http://localhost:3001/api
```

### Supplies (Insumos)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/supplies` | Lista com paginação e filtros |
| GET | `/supplies/stats` | Estatísticas gerais |
| GET | `/supplies/:id` | Busca um insumo |
| POST | `/supplies` | Cria novo insumo |
| PUT | `/supplies/:id` | Atualiza insumo (completo) |
| PATCH | `/supplies/:id` | Atualiza insumo (parcial) |
| DELETE | `/supplies/:id` | Remove insumo |

#### Query Params (GET /supplies)
```
?busca=lavanda          # Busca por nome
?type=Essence           # Filtro por tipo
?supplier_id=1          # Filtro por fornecedor
?ordem=unit_cost        # Ordenação
?dir=ASC                # Direção (ASC/DESC)
?page=2                 # Página
?limit=20               # Itens por página
```

#### Exemplo — Criar Supply

```bash
curl -X POST http://localhost:3001/api/supplies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lavender Oil",
    "type": "Essence",
    "supplier_id": 1,
    "unit": "ml",
    "quantity_purchased": 500,
    "total_amount_paid": 250.00,
    "batch": "LOT-2024-001"
  }'
```

### Suppliers (Fornecedores)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/suppliers` | Lista todos |
| GET | `/suppliers/:id` | Busca um |
| POST | `/suppliers` | Cria |
| PATCH | `/suppliers/:id` | Atualiza |
| DELETE | `/suppliers/:id` | Remove |

### Customers (Clientes)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/customers` | Lista todos |
| GET | `/customers/:id` | Busca um |
| POST | `/customers` | Cria |
| PATCH | `/customers/:id` | Atualiza |
| DELETE | `/customers/:id` | Remove |
| GET | `/customers/:id/orders` | Lista pedidos do cliente |
| POST | `/customers/:id/orders` | Cria pedido |
| GET | `/customers/:id/orders/:orderId` | Busca pedido |
| PATCH | `/customers/:id/orders/:orderId` | Atualiza pedido |
| DELETE | `/customers/:id/orders/:orderId` | Remove pedido |

### Health Check

```bash
GET /api/health
```

Resposta:
```json
{
  "status": "ok",
  "ts": "2024-01-15T10:30:00.000Z"
}
```

## 🗄️ Banco de Dados

**PostgreSQL** hospedado no **Supabase** com schema em inglês.

### Scripts Disponíveis

```bash
npm run migrate:latest    # Executar migrations
npm run migrate:rollback  # Reverter migrations
npm run seed:run         # Popular banco com dados
npm run db:setup         # Setup completo (migrate + seed)
```

### Tabelas

#### suppliers
```sql
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  contact TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  type TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### supplies
```sql
CREATE TABLE supplies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Essence','Base','Chemical','Packaging','Bottle','Label')),
  supplier_id INTEGER REFERENCES suppliers(id),
  unit TEXT NOT NULL CHECK (unit IN ('ml','g','unit','unidade')),
  quantity_purchased DECIMAL(14,6) NOT NULL,
  total_amount_paid DECIMAL(14,2) NOT NULL,
  unit_cost DECIMAL(14,6) GENERATED ALWAYS AS (
    CASE WHEN quantity_purchased > 0 
    THEN ROUND(total_amount_paid / quantity_purchased, 6) 
    ELSE 0 END
  ) STORED,
  batch TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### customers
```sql
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### orders
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  code TEXT,
  status TEXT CHECK (status IN ('Pending','Confirmed','In Production','Shipped','Delivered','Cancelled')),
  channel TEXT,
  discount DECIMAL(14,2) DEFAULT 0,
  shipping DECIMAL(14,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### order_items
```sql
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_ref TEXT,
  quantity DECIMAL(14,6) NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔧 Configuração

### Variáveis de Ambiente

Configure no arquivo `.env` (copie de `.env.example`):

```env
# PostgreSQL/Supabase
DB_HOST=db.xxxxx.supabase.co
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD="sua_senha_aqui"

# Servidor
PORT=3001
NODE_ENV=development
```

**⚠️ SEGURANÇA:** O arquivo `.env` está no `.gitignore` e nunca deve ser commitado!

### CORS

Por padrão, a API aceita requisições de:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

Para modificar, edite `src/server.js`:

```javascript
app.use(cors({ 
  origin: ['http://localhost:3000', 'http://seu-dominio.com'] 
}))
```

## 🧪 Testes

```bash
# TODO: Implementar testes
npm test
```

## 📝 Logs

Todos os requests são logados no console:

```
[10:30:45] GET /api/supplies
[10:30:46] POST /api/suppliers
```

## 🔒 Segurança

- ✅ Validação de dados com `express-validator`
- ✅ CORS configurado
- ✅ Sanitização de inputs
- ✅ Foreign key constraints
- ✅ Check constraints para enums
- ⚠️ TODO: Implementar autenticação JWT
- ⚠️ TODO: Implementar rate limiting
- ⚠️ TODO: Implementar HTTPS

## 📄 Licença

MIT
