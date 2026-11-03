/**
 * Preço do site por tamanho de frasco, como parâmetro editável.
 *
 * Nasce com os valores que a LOJA JÁ PRATICA em 02/11/2026 (45,90 / 69,90 /
 * 105,90 / 169,90), de propósito: assim, ligar a gravação de preço não muda
 * preço nenhum. Se nascesse vazia ou com os valores do sistema (37,90 ...), o
 * primeiro `sync` derrubaria o site em ~20% sem ninguém ter pedido.
 *
 * Os tamanhos saem de `packaging_types` (3, 15, 30, 50 e 100 ml ativos). O
 * 3 ml fica FORA: não existe variação de 3 ml na loja, e preço para um tamanho
 * que o site não vende só confundiria quem edita.
 *
 * Não confundir com `price_lists`: aquela é a tabela do SISTEMA, por projeto,
 * com vigência, usada pela tela de Vendas. Esta é a do SITE. Hoje elas
 * divergem ~20%, por decisão do dono. Ver `services/precosSite.js`.
 *
 * Aditiva e reversível.
 */

const VALOR_INICIAL = [
  '# Preço de venda no site, por tamanho de frasco.',
  '# Uma linha por tamanho:  <ml> = <preço>',
  '# Tamanho sem linha aqui NÃO tem o preço alterado no site.',
  '15 = 45,90',
  '30 = 69,90',
  '50 = 105,90',
  '100 = 169,90',
].join('\n')

exports.up = async function (knex) {
  const existe = await knex('parameters').where('key', 'precos_site').first()
  if (existe) return

  await knex('parameters').insert({
    key:   'precos_site',
    value: VALOR_INICIAL,
    label: 'Preços do site por tamanho de frasco (R$)',
    description: 'Preço que o site portalupiparfum.com.br cobra em cada tamanho de frasco. '
      + 'Uma linha por tamanho, no formato "15 = 45,90". Aceita vírgula ou ponto. '
      + 'Os tamanhos disponíveis são os de Cadastros → Tipos de Embalagem (hoje 15, 30, 50 e '
      + '100 ml; o frasco de 3 ml não é vendido no site). '
      + 'ATENÇÃO: isto NÃO é a tabela de preços do sistema (Preços), que é por projeto e é a '
      + 'usada para montar pedido na tela de Vendas. São tabelas separadas de propósito — hoje '
      + 'o site cobra cerca de 20% acima. '
      + 'Tamanho sem linha aqui fica com o preço que já está no site, sem alteração.',
  })
}

exports.down = async function (knex) {
  await knex('parameters').where('key', 'precos_site').del()
}
