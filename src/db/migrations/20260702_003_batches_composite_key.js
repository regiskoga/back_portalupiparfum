/**
 * Migration: troca UNIQUE(batch_code) por UNIQUE(batch_code, product_id).
 *
 * Motivação: no domínio do cliente, "Lote 1" existe para cada projeto
 * (Lote 1 do Wulong Cha, Lote 1 do Naxos, etc.). O código do lote
 * sozinho não é único — só é único dentro de um projeto.
 *
 * Efeito:
 *   - Dois batches com mesmo batch_code em produtos DIFERENTES → permitido
 *   - Dois batches com mesmo batch_code no MESMO produto → bloqueado
 *   - Batches sem product_id (null): PostgreSQL trata múltiplos NULLs como
 *     distintos por padrão, então múltiplos batches com batch_code igual
 *     e product_id null convivem sem colisão.
 *
 * PK continua sendo `id` (integer). Só o UNIQUE foi trocado.
 */

exports.up = async function (knex) {
  // Encontra o nome real do constraint de unique de batch_code
  // (Knex costuma nomear como "batches_batch_code_unique")
  await knex.raw(`
    ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_batch_code_unique;
    ALTER TABLE batches ADD CONSTRAINT batches_batch_code_product_id_unique
      UNIQUE (batch_code, product_id);
  `)
}

exports.down = async function (knex) {
  await knex.raw(`
    ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_batch_code_product_id_unique;
    ALTER TABLE batches ADD CONSTRAINT batches_batch_code_unique UNIQUE (batch_code);
  `)
}
