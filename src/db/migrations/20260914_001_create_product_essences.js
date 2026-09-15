/**
 * Vínculo ESSÊNCIA ↔ PROJETO (pedido do cliente: "criar um botão de vincular ao
 * projeto" na tela de Estoque de Essências).
 *
 * Até aqui esse vínculo não existia no banco. Os relatórios adivinhavam por duas
 * heurísticas: as essências realmente consumidas em lotes do projeto (certo, mas
 * só existe depois de produzir) e o nome da essência batendo com a inspiração do
 * projeto (estimativa). Esta tabela é o vínculo declarado pelo usuário.
 *
 * ── Por que a chave é a IDENTIDADE da essência, e não `supplies.id` ───────────
 * Cada linha de `supplies` é uma COMPRA. A mesma essência aparece em várias
 * compras (518 linhas para 415 essências distintas em produção), e a tela de
 * Estoque de Essências já trabalha agrupada por marca + essência. Apontar para
 * um `supply_id` amarraria o vínculo a uma compra específica e a próxima compra
 * da mesma essência nasceria sem vínculo.
 *
 * `essence_key` = norm(marca) || '||' || norm(essência), com `norm` removendo
 * acento, caixa e pontuação — o mesmo tratamento que o resumo de essências usa
 * para agrupar. `brand`/`essence` guardam o texto como foi capturado, para a
 * tela e para diagnóstico.
 *
 * O laboratório (fornecedor) fica DE FORA da identidade de propósito: a mesma
 * essência comprada de dois laboratórios é a mesma essência para o projeto. Como
 * o resumo agrupa por marca+essência+laboratório, a mesma essência de dois labs
 * aparece em duas linhas e as duas mostram o mesmo vínculo — a tela avisa isso.
 *
 * Aditiva e reversível: tabela nova, nada é alterado no que já existe.
 */

exports.up = function (knex) {
  return knex.schema.createTable('product_essences', (table) => {
    table.increments('id').primary()
    table.integer('product_id').unsigned().notNullable()
      .references('id').inTable('products').onDelete('CASCADE')
    table.text('essence_key').notNullable()   // norm(marca)||norm(essência)
    table.text('brand').notNullable().defaultTo('')
    table.text('essence').notNullable().defaultTo('')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // Um projeto não vincula a mesma essência duas vezes.
    table.unique(['product_id', 'essence_key'])
    // Caminho de leitura da tela: essence_key → projetos (415 chaves de uma vez).
    table.index('essence_key')
    table.index('product_id')
  })
}

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('product_essences')
}
