// Preço de venda no SITE por projeto e volume, na mesma linha da tabela de
// preços (projeto + volume + vigência).
//
// Por que não reaproveitar `price`: `price` é o "Preço sugerido" da tela, o
// preço do SISTEMA, que a tela de Vendas usa para montar pedido. Em 08/11/2026
// ele estava em 37,90/57,90/87,90/137,90 nos 73 projetos com preço, contra
// 49,90/69,90/105,90/169,90 cobrados na loja — ~20% abaixo, por decisão do
// dono. Um canal não pode mandar no preço do outro.
//
// NULL = sem exceção: o site usa a tabela por frasco do parâmetro `precos_site`
// (ver services/precosSite.js). Nasce nulo em todas as linhas de propósito,
// para a migration não mover nenhum preço da loja ao subir.
exports.up = function (knex) {
  return knex.schema.alterTable('price_lists', (table) => {
    table.decimal('site_price', 14, 2).nullable()
  })
}

exports.down = function (knex) {
  return knex.schema.alterTable('price_lists', (table) => {
    table.dropColumn('site_price')
  })
}
