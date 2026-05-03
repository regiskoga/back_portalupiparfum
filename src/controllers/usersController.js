const bcrypt = require('bcrypt')
const db = require('../db/connection')

/**
 * Listar usuários (apenas ADM)
 */
exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query
    const offset = (page - 1) * limit
    
    // Base query para filtros
    let baseQuery = db('users')
    
    // Filtro de busca
    if (search) {
      baseQuery = baseQuery.where(function() {
        this.where('name', 'like', `%${search}%`)
          .orWhere('email', 'like', `%${search}%`)
      })
    }
    
    // Contar total (sem select de colunas)
    const [{ count }] = await baseQuery.clone().count('* as count')
    
    // Buscar usuários com paginação
    const users = await baseQuery
      .clone()
      .select('id', 'name', 'email', 'profile', 'active', 'last_login', 'created_at')
      .orderBy('name', 'asc')
      .limit(limit)
      .offset(offset)
    
    res.json({
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        totalPages: Math.ceil(count / limit)
      }
    })
    
  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    res.status(500).json({ error: 'Erro ao listar usuários' })
  }
}

/**
 * Buscar usuário por ID
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params
    
    const user = await db('users')
      .select('id', 'name', 'email', 'profile', 'active', 'last_login', 'created_at')
      .where({ id })
      .first()
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }
    
    res.json(user)
    
  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
    res.status(500).json({ error: 'Erro ao buscar usuário' })
  }
}

/**
 * Criar usuário (apenas ADM)
 */
exports.create = async (req, res) => {
  try {
    console.log('📝 Iniciando criação de usuário...')
    console.log('📝 Body recebido:', JSON.stringify(req.body, null, 2))
    
    const { name, email, password, profile } = req.body
    
    // Validar campos
    if (!name || !email || !password || !profile) {
      console.log('❌ Validação falhou: campos obrigatórios faltando')
      return res.status(400).json({ 
        error: 'Nome, email, senha e perfil são obrigatórios' 
      })
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.log('❌ Validação falhou: email inválido')
      return res.status(400).json({ error: 'Email inválido' })
    }
    
    // Validar senha
    if (password.length < 6) {
      console.log('❌ Validação falhou: senha muito curta')
      return res.status(400).json({ 
        error: 'A senha deve ter no mínimo 6 caracteres' 
      })
    }
    
    // Validar perfil
    const validProfiles = ['ADM', 'GERENTE', 'OPERADOR', 'VISUALIZADOR']
    if (!validProfiles.includes(profile)) {
      console.log('❌ Validação falhou: perfil inválido')
      return res.status(400).json({ error: 'Perfil inválido' })
    }
    
    console.log('✅ Validações passaram')
    
    // Verificar se email já existe
    console.log('🔍 Verificando se email já existe...')
    const existingUser = await db('users').where({ email }).first()
    if (existingUser) {
      console.log('❌ Email já cadastrado')
      return res.status(409).json({ error: 'Email já cadastrado' })
    }
    
    console.log('✅ Email disponível')
    
    // Hash da senha
    console.log('🔐 Gerando hash da senha...')
    const passwordHash = await bcrypt.hash(password, 10)
    console.log('✅ Hash gerado')
    
    // Inserir usuário
    console.log('💾 Inserindo usuário no banco...')
    const userData = {
      name,
      email,
      password_hash: passwordHash,
      profile,
      active: true,
      must_change_password: true
    }
    console.log('💾 Dados a inserir:', JSON.stringify(userData, null, 2))

    await db('users').insert(userData)
    console.log('✅ Usuário inserido')

    // Buscar usuário criado pelo email (compatível com PostgreSQL e SQLite)
    console.log('🔍 Buscando usuário criado...')
    const newUser = await db('users')
      .select('id', 'name', 'email', 'profile', 'active', 'must_change_password', 'created_at')
      .where({ email })
      .first()

    console.log('✅ Usuário criado com sucesso:', newUser)
    res.status(201).json(newUser)
    
  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    res.status(500).json({ error: 'Erro ao criar usuário' })
  }
}

/**
 * Atualizar usuário (apenas ADM)
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, profile, active } = req.body
    
    // Verificar se usuário existe
    const user = await db('users').where({ id }).first()
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }
    
    // Validar email se foi alterado
    if (email && email !== user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Email inválido' })
      }
      
      const existingUser = await db('users').where({ email }).first()
      if (existingUser) {
        return res.status(409).json({ error: 'Email já cadastrado' })
      }
    }
    
    // Validar perfil
    if (profile) {
      const validProfiles = ['ADM', 'GERENTE', 'OPERADOR', 'VISUALIZADOR']
      if (!validProfiles.includes(profile)) {
        return res.status(400).json({ error: 'Perfil inválido' })
      }
    }
    
    // Atualizar usuário
    const updates = {}
    if (name) updates.name = name
    if (email) updates.email = email
    if (profile) updates.profile = profile
    if (typeof active === 'boolean') updates.active = active
    updates.updated_at = db.fn.now()
    
    await db('users').where({ id }).update(updates)
    
    // Buscar usuário atualizado
    const updatedUser = await db('users')
      .select('id', 'name', 'email', 'profile', 'active', 'created_at', 'updated_at')
      .where({ id })
      .first()
    
    res.json(updatedUser)
    
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
    res.status(500).json({ error: 'Erro ao atualizar usuário' })
  }
}

/**
 * Deletar usuário (apenas ADM)
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params
    
    // Verificar se usuário existe
    const user = await db('users').where({ id }).first()
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }
    
    // Não permitir deletar o próprio usuário
    if (parseInt(id) === req.user.id) {
      return res.status(403).json({ 
        error: 'Você não pode deletar seu próprio usuário' 
      })
    }
    
    // Deletar usuário (sessões serão deletadas em cascata)
    await db('users').where({ id }).del()
    
    res.json({ 
      success: true, 
      message: 'Usuário deletado com sucesso' 
    })
    
  } catch (error) {
    console.error('Erro ao deletar usuário:', error)
    res.status(500).json({ error: 'Erro ao deletar usuário' })
  }
}

/**
 * Resetar senha de usuário (apenas ADM)
 */
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params
    const { newPassword } = req.body
    
    // Validar senha
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'A nova senha deve ter no mínimo 6 caracteres' 
      })
    }
    
    // Verificar se usuário existe
    const user = await db('users').where({ id }).first()
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }
    
    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 10)
    
    // Atualizar senha
    await db('users')
      .where({ id })
      .update({ 
        password_hash: passwordHash,
        updated_at: db.fn.now()
      })
    
    // Invalidar todas as sessões do usuário
    await db('sessions').where({ user_id: id }).del()
    
    res.json({ 
      success: true, 
      message: 'Senha resetada com sucesso. O usuário precisará fazer login novamente.' 
    })
    
  } catch (error) {
    console.error('Erro ao resetar senha:', error)
    res.status(500).json({ error: 'Erro ao resetar senha' })
  }
}
