const {getDb} = require('../models/db')
const db = getDb()

const clientes = [
  { nome:'Ana Beatriz Souza',    cpf_cnpj:'123.456.789-00', telefone:'(11) 9 9111-0001', email:'ana@email.com',     endereco:'Rua das Rosas, 45',    cidade:'São Paulo',    uf:'SP', cep:'01310-100', observacoes:'Prefere fragrâncias florais' },
  { nome:'Carlos Eduardo Lima',  cpf_cnpj:'234.567.890-11', telefone:'(11) 9 9222-0002', email:'carlos@email.com',  endereco:'Av. Paulista, 1000',   cidade:'São Paulo',    uf:'SP', cep:'01310-200', observacoes:'Cliente VIP' },
  { nome:'Fernanda Costa',       cpf_cnpj:'345.678.901-22', telefone:'(21) 9 9333-0003', email:'fernanda@email.com',endereco:'Rua Ipanema, 200',     cidade:'Rio de Janeiro',uf:'RJ', cep:'22420-030', observacoes:'' },
  { nome:'Boutique Élégance',    cpf_cnpj:'12.345.678/0001-99', telefone:'(11) 3333-0004', email:'compras@elegance.com', endereco:'Shopping Iguatemi, L42', cidade:'São Paulo', uf:'SP', cep:'01451-000', observacoes:'Revenda  pedidos mensais' },
  { nome:'Mariana Oliveira',     cpf_cnpj:'456.789.012-33', telefone:'(31) 9 9444-0005', email:'mari@email.com',    endereco:'Rua Savassi, 88',      cidade:'Belo Horizonte',uf:'MG', cep:'30130-170', observacoes:'Alérgica a almíscar sintético' },
]

const ins = db.prepare('INSERT INTO clientes (nome,cpf_cnpj,telefone,email,endereco,cidade,uf,cep,observacoes) VALUES (?,?,?,?,?,?,?,?,?)')
const ids = clientes.map(c => {
  const r = ins.run(c.nome,c.cpf_cnpj,c.telefone,c.email,c.endereco,c.cidade,c.uf,c.cep,c.observacoes)
  return r.lastInsertRowid
})

// Pedidos
const insPed = db.prepare('INSERT INTO pedidos (cliente_id,codigo,status,canal,desconto,frete,observacoes) VALUES (?,?,?,?,?,?,?)')
const insItem = db.prepare('INSERT INTO pedido_itens (pedido_id,produto_nome,produto_ref,quantidade,preco_unitario) VALUES (?,?,?,?,?)')

const pedidos = [
  { cid:ids[0], codigo:'PED-0001', status:'Entregue',    canal:'WhatsApp',   desconto:0,    frete:15,  obs:'Embalagem presente', itens:[
    { nome:'Eau de Parfum Lavanda 50ml', ref:'EDP-LAV-50', qtd:2, preco:189.90 },
    { nome:'Sabonete Artesanal Rosa',    ref:'SAB-ROS-01', qtd:3, preco:28.50  },
  ]},
  { cid:ids[0], codigo:'PED-0002', status:'Pendente',    canal:'Instagram',  desconto:10,   frete:0,   obs:'', itens:[
    { nome:'Perfume Oud Noir 100ml',     ref:'EDP-OUD-100', qtd:1, preco:420.00 },
  ]},
  { cid:ids[1], codigo:'PED-0003', status:'Entregue',    canal:'Loja física',desconto:50,   frete:0,   obs:'Desconto fidelidade', itens:[
    { nome:'Coleção Verão 3x30ml',       ref:'COL-VER-3',  qtd:1, preco:350.00 },
    { nome:'Difusor Ambiente Bambu',     ref:'DIF-BAM-01', qtd:2, preco:95.00  },
  ]},
  { cid:ids[1], codigo:'PED-0004', status:'Em produção', canal:'Site',       desconto:0,    frete:20,  obs:'Personalização gravada', itens:[
    { nome:'Perfume Exclusivo 100ml',    ref:'EXC-001',    qtd:1, preco:680.00 },
  ]},
  { cid:ids[2], codigo:'PED-0005', status:'Enviado',     canal:'WhatsApp',   desconto:0,    frete:18,  obs:'', itens:[
    { nome:'Eau de Toilette Cítrico 75ml',ref:'EDT-CIT-75',qtd:1, preco:145.00 },
    { nome:'Body Splash 200ml',          ref:'BSP-001',    qtd:2, preco:65.00  },
  ]},
  { cid:ids[3], codigo:'PED-0006', status:'Confirmado',  canal:'Site',       desconto:200,  frete:0,   obs:'Pedido mensal revenda', itens:[
    { nome:'Eau de Parfum Lavanda 50ml', ref:'EDP-LAV-50', qtd:10, preco:160.00 },
    { nome:'Eau de Parfum Rosa 50ml',    ref:'EDP-ROS-50', qtd:10, preco:160.00 },
    { nome:'Perfume Oud Noir 100ml',     ref:'EDP-OUD-100',qtd:5,  preco:380.00 },
  ]},
  { cid:ids[4], codigo:'PED-0007', status:'Entregue',    canal:'Indicação',  desconto:0,    frete:12,  obs:'Sem almíscar', itens:[
    { nome:'Perfume Floral Sem Almíscar 50ml', ref:'EDP-FLO-50', qtd:1, preco:210.00 },
  ]},
]

pedidos.forEach(p => {
  const r = insPed.run(p.cid, p.codigo, p.status, p.canal, p.desconto, p.frete, p.obs)
  p.itens.forEach(i => insItem.run(r.lastInsertRowid, i.nome, i.ref, i.qtd, i.preco))
})

console.log(`Seed: ${clientes.length} clientes, ${pedidos.length} pedidos`)
