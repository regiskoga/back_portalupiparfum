const bcrypt = require('bcrypt')
const crypto = require('crypto')
const db = require('../db/connection')

/**
 * Login de usuário
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body
    
    // Validar campos
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email e senha são obrigatórios' 
      })
    }
    
    // Buscar usuário
    const user = await db('users')
      .where({ email })
      .first()
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Email ou senha incorretos' 
      })
    }
    
    // Verificar se está ativo
    if (!user.active) {
      return res.status(403).json({ 
        error: 'Usuário inativo. Entre em contato com o administrador.' 
      })
    }
    
    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    
    if (!passwordMatch) {
      return res.status(401).json({ 
        error: 'Email ou senha incorretos' 
      })
    }
    
    // Gerar token de sessão
    const token = crypto.randomBytes(64).toString('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 8) // 8 horas
    
    // Criar sessão
    await db('sessions').insert({
      user_id: user.id,
      token,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      expires_at: expiresAt
    })
    
    // Atualizar último login
    await db('users')
      .where({ id: user.id })
      .update({ last_login: db.fn.now() })
    
    // Buscar permissões do perfil
    const permissions = await db('profile_screen_permissions')
      .where({ profile: user.profile })
    
    // Retornar dados do usuário (sem senha)
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        must_change_password: user.must_change_password || false
      },
      permissions,
      expiresAt,
      must_change_password: user.must_change_password || false
    })
    
  } catch (error) {
    console.error('Erro no login:', error)
    res.status(500).json({ error: 'Erro ao fazer login' })
  }
}

/**
 * Logout de usuário
 */
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (token) {
      await db('sessions').where({ token }).del()
    }
    
    res.json({ success: true, message: 'Logout realizado com sucesso' })
    
  } catch (error) {
    console.error('Erro no logout:', error)
    res.status(500).json({ error: 'Erro ao fazer logout' })
  }
}

/**
 * Verificar sessão
 */
exports.verifySession = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' })
    }
    
    // Buscar sessão
    const session = await db('sessions')
      .where({ token })
      .where('expires_at', '>', db.fn.now())
      .first()
    
    if (!session) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada' })
    }
    
    // Buscar usuário
    const user = await db('users')
      .where({ id: session.user_id, active: true })
      .first()
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' })
    }
    
    // Buscar permissões
    const permissions = await db('profile_screen_permissions')
      .where({ profile: user.profile })
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profile
      },
      permissions
    })
    
  } catch (error) {
    console.error('Erro ao verificar sessão:', error)
    res.status(500).json({ error: 'Erro ao verificar sessão' })
  }
}

/**
 * Alterar senha (com suporte para primeiro login)
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, isFirstLogin } = req.body
    const userId = req.user.id // Vem do middleware de autenticação
    
    // Validar campos
    if (!newPassword) {
      return res.status(400).json({ 
        error: 'Nova senha é obrigatória' 
      })
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'A nova senha deve ter no mínimo 6 caracteres' 
      })
    }
    
    // Buscar usuário
    const user = await db('users').where({ id: userId }).first()
    
    // Se não for primeiro login, verificar senha atual
    if (!isFirstLogin) {
      if (!currentPassword) {
        return res.status(400).json({ 
          error: 'Senha atual é obrigatória' 
        })
      }
      
      const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash)
      
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Senha atual incorreta' })
      }
    }
    
    // Hash da nova senha
    const newPasswordHash = await bcrypt.hash(newPassword, 10)
    
    // Atualizar senha e remover flag de troca obrigatória
    await db('users')
      .where({ id: userId })
      .update({ 
        password_hash: newPasswordHash,
        must_change_password: false,
        password_changed_at: db.fn.now(),
        updated_at: db.fn.now()
      })
    
    res.json({ 
      success: true, 
      message: 'Senha alterada com sucesso' 
    })
    
  } catch (error) {
    console.error('Erro ao alterar senha:', error)
    res.status(500).json({ error: 'Erro ao alterar senha' })
  }
}
