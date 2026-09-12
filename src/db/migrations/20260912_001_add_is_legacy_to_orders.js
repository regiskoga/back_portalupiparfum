/**
 * Pedidos antigos (histórico anterior ao sistema), carregados por planilha.
 *
 * Ficam na MESMA tabela `orders` em vez de tabela própria: os relatórios de
 * Mais Vendidos e Maiores Clientes precisam somá-los junto com os pedidos do
 * sistema, e duplicar a lógica de cálculo em duas fontes é como os totais
 * passam a divergir. A separação é de TELA (Comercial → Pedidos Antigos) e de
 * filtro, não de armazenamento.
 *
 * Aditiva: coluna com default false, nenhum pedido existente muda de
 * comportamento.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.boolean('is_legacy').notNullable().defaultTo(false)
    table.index('is_legacy')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.dropIndex('is_legacy')
    table.dropColumn('is_legacy')
  })
}
