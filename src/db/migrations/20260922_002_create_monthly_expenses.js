/**
 * Migration: despesas lançadas à mão (Balancete Mensal).
 *
 * Pedido do cliente (21/09/2026, áudio): "colocar um botãozinho lá pra mim ir
 * adicionando outros, e eu vou incluindo novos itens digitando manualmente.
 * Por exemplo, eu compro frasco amber pra macerar os perfumes, em nenhum momento
 * cadastro isso; eu compro etiqueta da impressorinha, caixa de papelão pra
 * embalar, papel kraft, plástico bolha."
 *
 * Por que uma tabela nova em vez de virar `supplies`: `supplies` é CADASTRO DE
 * INSUMO — cada linha vira saldo, entra em fórmula, é abatida em lote/envase.
 * Caixa de papelão e papel kraft não têm saldo nem rastreabilidade; forçá-los
 * lá dentro sujaria o estoque e os relatórios de essência com linhas que não
 * são insumo. Aqui é só dinheiro que saiu, com data e descrição.
 *
 * `expense_date` em vez de uma competência "YYYY-MM": a tela agrupa por mês, mas
 * guardar a data permite mudar de ideia depois (semana, trimestre) sem migrar
 * dado. É a mesma escolha de `supplies.purchase_date`, com quem esta tabela soma.
 *
 * Genérica de propósito: se ele decidir lançar o álcool e a água desmineralizada
 * — que hoje ficam fora do cadastro por opção dele — cabem aqui como uma linha
 * por mês, sem tabela nem código novo.
 */

exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('monthly_expenses')
  if (exists) return

  await knex.schema.createTable('monthly_expenses', (table) => {
    table.increments('id').primary()
    table.date('expense_date').notNullable()
    table.string('description').notNullable()
    table.decimal('amount', 14, 2).notNullable().defaultTo(0)
    // Livre, não enum: a lista do que ele compra vai crescer e um enum exigiria
    // migration a cada item novo. A tela sugere as que já foram usadas.
    table.string('category').defaultTo('')
    table.text('notes').defaultTo('')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    table.index('expense_date')
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('monthly_expenses')
}
