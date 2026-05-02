const db = require('../db/connection')

/**
 * Middleware de autenticação
 * Verifica se o usuário está autenticado
 */
exports.authenticate = async (req, res, next) => {
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
    
    // Adicionar usuário ao request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      profile: user.profile
    }
    
    next()
    
  } catch (error) {
    console.error('Erro na autenticação:', error)
    res.status(500).json({ error: 'Erro ao verificar autenticação' })
  }
}

/**
 * Middleware de autorização por perfil
 * Verifica se o usuário tem o perfil necessário
 */
exports.authorize = (...allowedProfiles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' })
    }
    
    if (!allowedProfiles.includes(req.user.profile)) {
      return res.status(403).json({ 
        error: 'Você não tem permissão para acessar este recurso' 
      })
    }
    
    next()
  }
}

/**
 * Middleware de autorização por permissão de tela
 * Verifica se o usuário tem permissão para acessar uma tela específica
 */
exports.authorizeScreen = (screenKey, action = 'can_view') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' })
      }
      
      // Buscar permissão
      const permission = await db('profile_screen_permissions')
        .where({ 
          profile: req.user.profile,
          screen_key: screenKey
        })
        .first()
      
      if (!permission || !permission[action]) {
        return res.status(403).json({ 
          error: 'Você não tem permissão para realizar esta ação' 
        })
      }
      
      next()
      
    } catch (error) {
      console.error('Erro na autorização:', error)
      res.status(500).json({ error: 'Erro ao verificar permissões' })
    }
  }
}
