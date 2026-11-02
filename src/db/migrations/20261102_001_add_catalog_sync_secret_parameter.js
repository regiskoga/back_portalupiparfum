/**
 * Segredo da sincronização com a loja, como parâmetro editável.
 *
 * Os endpoints `GET /api/public/catalog/stock` e
 * `POST /api/public/catalog/validate-cart` são chamados servidor-a-servidor
 * pelo PHP da loja WooCommerce e exigem um segredo compartilhado.
 *
 * A primeira versão lia só de `process.env.CATALOG_SYNC_SECRET`. Não serve:
 * quem opera o sistema não tem acesso ao painel do Coolify para criar variável
 * de ambiente, então o segredo ficaria permanentemente vazio e a sincronização
 * nunca sairia do 503. Aqui ele passa a morar em `parameters` e aparece sozinho
 * na tela Sistema → Parâmetros, editável sem deploy — mesmo caminho do
 * `order_summary_footer` (migration 20260927_001).
 *
 * Nasce VAZIO de propósito: o middleware trata vazio como "não configurado" e
 * segue respondendo 503. Assim esta migration não liga nada sozinha — quem liga
 * é a pessoa colando o segredo na tela, de caso pensado.
 *
 * A variável de ambiente continua funcionando e tem PRECEDÊNCIA: se um dia
 * alguém puder definir `CATALOG_SYNC_SECRET` no Coolify, esse valor manda, e o
 * segredo sai do banco. Ambiente é o lugar mais seguro; o parâmetro existe
 * porque é o único acessível hoje.
 *
 * Aditiva e reversível: insere uma linha, e o `down` remove.
 */

exports.up = async function (knex) {
  const existe = await knex('parameters').where('key', 'catalog_sync_secret').first()
  if (existe) return

  await knex('parameters').insert({
    key:   'catalog_sync_secret',
    value: '',
    label: 'Segredo de sincronização com a loja (site)',
    description: 'Senha compartilhada entre este sistema e o site portalupiparfum.com.br, '
      + 'usada para o site ler o estoque disponível e atualizar as quantidades dos perfumes. '
      + 'Cole aqui o MESMO valor configurado no site (constante PORTALUPI_SYNC_SECRET, no '
      + 'wp-config.php). Enquanto estiver em branco, a sincronização fica desligada — o site '
      + 'não consegue ler nada. Use um valor longo e aleatório, e não reaproveite senha de '
      + 'outro lugar.',
  })
}

exports.down = async function (knex) {
  await knex('parameters').where('key', 'catalog_sync_secret').del()
}
