/**
 * Desconto por pagamento no Pix: o percentual (parâmetro) e a parcela gravada
 * no pedido (coluna).
 *
 * Pedido do cliente em 12/11/2026: o resumo que vai para o comprador precisa
 * mostrar o abatimento do Pix discriminado, e a forma de pagamento precisa ser
 * escolhida ANTES de registrar o pagamento — senão o resumo sai com o total
 * errado.
 *
 * ── Por que o dinheiro NÃO mora nesta coluna ──────────────────────────────
 * `orders.pix_discount` é only-for-display: guarda QUANTO do desconto veio do
 * Pix, para o resumo poder escrever a linha "Desconto Pix (5%)". O valor em si
 * entra por dentro de `orders.discount`, exatamente como o "Desc./item" faz
 * desde 14/09/2026 (ver ajustaDescontoDoItem no ordersController).
 *
 * A alternativa — somar uma parcela nova na conta do total — obrigaria a mexer
 * nas SEIS fórmulas de total espalhadas pelo sistema (reportsController
 * topCustomers e balancete, vendas.js em quatro pontos, pedidos-antigos.js).
 * Esquecer uma delas daria relatório divergente em silêncio. Entrando por
 * dentro do `discount`, toda fórmula existente continua correta sem tocar em
 * nenhuma, e a base da comissão do parceiro (perfumes − desconto − cupom) já
 * cai sozinha — que é a regra decidida com o cliente.
 *
 * ⚠️ Quem lê `pix_discount` para montar total está contando duas vezes. Ele
 * serve para EXIBIR a composição, nunca para somar.
 *
 * Aditiva e reversível: coluna com default 0 (nenhum pedido existente muda de
 * valor) e um parâmetro novo, que aparece sozinho na tela de Parâmetros.
 * Nasce em '0' de propósito: subir a migration não pode alterar o preço de
 * nenhum pedido — o dono liga o desconto quando quiser, sem deploy.
 */

exports.up = async function (knex) {
  const temColuna = await knex.schema.hasColumn('orders', 'pix_discount')
  if (!temColuna) {
    await knex.schema.alterTable('orders', (table) => {
      table.decimal('pix_discount', 14, 2).notNullable().defaultTo(0)
    })
  }

  const existe = await knex('parameters').where('key', 'pix_discount_pct').first()
  if (existe) return

  await knex('parameters').insert({
    key:   'pix_discount_pct',
    value: '0',
    label: 'Desconto para pagamento no Pix (%)',
    description: 'Percentual abatido quando a forma de pagamento do pedido é Pix. '
      + 'Incide sobre o subtotal dos perfumes — não sobre o frete. Em 0 (zero) o '
      + 'desconto fica desligado e nada muda no pedido. O valor aparece discriminado '
      + 'no resumo enviado ao cliente e reduz a base da comissão do parceiro.',
  })
}

exports.down = async function (knex) {
  await knex('parameters').where('key', 'pix_discount_pct').del()
  const temColuna = await knex.schema.hasColumn('orders', 'pix_discount')
  if (temColuna) {
    await knex.schema.alterTable('orders', (table) => {
      table.dropColumn('pix_discount')
    })
  }
}
