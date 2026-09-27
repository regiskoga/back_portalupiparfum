/**
 * Rodapé do resumo do pedido (WhatsApp) como parâmetro editável.
 *
 * O resumo que vai para o cliente tem duas metades: a calculada (itens,
 * subtotal, desconto, cupom, frete, total, status) e um rodapé de texto fixo
 * — formas de pagamento, chaves Pix, prazos. O rodapé estava escrito na mão
 * dentro de `frontend/crud/src/pages/vendas.js`, então cada ajuste de chave Pix
 * ou de prazo exigia alteração de código e deploy.
 *
 * Aqui ele passa a morar em `parameters`, e aparece sozinho na tela
 * Sistema → Parâmetros. `parameters.value` já é `text`, então aceita o texto
 * multilinha sem mudança de schema.
 *
 * Aditiva e reversível: só insere uma linha. O front tem o mesmo texto como
 * padrão embutido, então se este parâmetro não existir (ou vier vazio) a
 * mensagem continua saindo exatamente como hoje.
 */

// ⚠️ Cópia byte-a-byte do bloco que estava em vendas.js (as linhas entre
// "Pagamento:" e "Status:"). Não editar aqui para mudar a mensagem — o valor
// vivo é o da tela de Parâmetros; isto é só o ponto de partida.
const RODAPE = [
  'Formas de pagamento:',
  '',
  '* Chaves Pix:',
  'rafaelportalupi@yahoo.com.br',
  'ou',
  'Portalupiparfum@gmail.com',
  '',
  '* Cartão via link de pagamento - taxas de parcelamento do cartão fica a cargo do cliente.',
  '',
  'Assim que o pagamento for confirmado, seu pedido seguirá para preparação e envio.',
  '',
  'Prazo para envio:',
  '',
  '* Pronta entrega: até 4 dias úteis após confirmação do pagamento',
  '* Para fragrância em produção ou que precisam de novo lote, o envio será realizado assim que o perfume estiver pronto.',
].join('\n')

exports.up = async function (knex) {
  const existe = await knex('parameters').where('key', 'order_summary_footer').first()
  if (existe) return

  await knex('parameters').insert({
    key:   'order_summary_footer',
    value: RODAPE,
    label: 'Rodapé do resumo do pedido (WhatsApp)',
    description: 'Texto fixo que vai depois do total, no resumo enviado ao cliente: '
      + 'formas de pagamento, chaves Pix e prazos de envio. Os itens, descontos, frete e '
      + 'total continuam sendo calculados pelo sistema. Se ficar em branco, o sistema usa o texto padrão.',
  })
}

exports.down = async function (knex) {
  await knex('parameters').where('key', 'order_summary_footer').del()
}
