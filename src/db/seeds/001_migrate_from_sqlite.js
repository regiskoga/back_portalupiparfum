/**
 * Seed: Dados de exemplo para PostgreSQL
 * (Migração SQLite desabilitada)
 */

exports.seed = async function(knex) {
  console.log('⚠️  Seed de migração SQLite desabilitado.')
  console.log('   Inserindo dados de exemplo...')

  // Guard: não re-inserir se já existem dados
  const { count } = await knex('suppliers').count('* as count').first()
  if (parseInt(count) > 0) {
    console.log('⏭️  Fornecedores já existem — seed 001 ignorado.')
    return
  }

  await knex('suppliers').insert([
    { name: 'Aromax Essências', tax_id: '12.345.678/0001-90', contact: 'Carlos Silva', email: 'carlos@aromax.com.br', phone: '(11) 9 8888-0001', address: 'Rua das Flores, 123 - São Paulo/SP', type: 'Essence' },
    { name: 'QuimiBase LTDA', tax_id: '98.765.432/0001-10', contact: 'Ana Ferreira', email: 'ana@quimibase.com.br', phone: '(11) 9 7777-0002', address: 'Av. Industrial, 456 - Guarulhos/SP', type: 'Chemical' },
    { name: 'EmbalMax', tax_id: '11.222.333/0001-44', contact: 'Pedro Souza', email: 'pedro@embalmax.com.br', phone: '(11) 9 6666-0003', address: 'Rua do Comércio, 789 - Osasco/SP', type: 'Packaging' },
    { name: 'Frasco & Cia', tax_id: '55.666.777/0001-88', contact: 'Lucia Rocha', email: 'lucia@frasccia.com.br', phone: '(11) 9 5555-0004', address: 'Alameda Santos, 321 - São Paulo/SP', type: 'Bottle' },
    { name: 'RótuloArt', tax_id: '33.444.555/0001-22', contact: 'Marcos Lima', email: 'marcos@rotuloart.com.br', phone: '(11) 9 4444-0005', address: 'Rua Gráfica, 654 - Santo André/SP', type: 'Label' }
  ])

  console.log('✅ Dados de exemplo inseridos com sucesso!')
  return
}