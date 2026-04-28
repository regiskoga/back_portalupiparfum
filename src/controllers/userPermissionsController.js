const knex = require('../db/connection')

// ─── Listar Perfis ────────────────────────────────────────────────────────────
exports.getProfiles = async (req, res) => {
  try {
    const profiles = await knex('user_profiles')
      .where('is_active', true)
      .orderBy('name')

    res.json({ data: profiles })
  } catch (error) {
    console.error('Erro ao buscar perfis:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

// ─── Listar Telas do Sistema ──────────────────────────────────────────────────
exports.getScreens = async (req, res) => {
  try {
    const screens = await knex('system_screens')
      .where('is_active', true)
      .orderBy(['category', 'sort_order', 'screen_name'])

    // Agrupar por categoria
    const grouped = screens.reduce((acc, screen) => {
      if (!acc[screen.category]) {
        acc[screen.category] = []
      }
      acc[screen.category].push(screen)
      return acc
    }, {})

    res.json({ data: grouped })
  } catch (error) {
    console.error('Erro ao buscar telas:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

// ─── Buscar Permissões de um Perfil ───────────────────────────────────────────
exports.getProfilePermissions = async (req, res) => {
  try {
    const { profileId } = req.params

    const permissions = await knex('profile_permissions as pp')
      .join('system_screens as ss', 'pp.screen_id', 'ss.id')
      .where('pp.profile_id', profileId)
      .select(
        'ss.id as screen_id',
        'ss.screen_key',
        'ss.screen_name',
        'ss.category',
        'pp.can_view',
        'pp.can_create',
        'pp.can_edit',
        'pp.can_delete'
      )
      .orderBy(['ss.category', 'ss.sort_order'])

    // Agrupar por categoria
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = []
      }
      acc[perm.category].push(perm)
      return acc
    }, {})

    res.json({ data: grouped })
  } catch (error) {
    console.error('Erro ao buscar permissões:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

// ─── Atualizar Permissões de um Perfil ────────────────────────────────────────
exports.updateProfilePermissions = async (req, res) => {
  try {
    const { profileId } = req.params
    const { permissions } = req.body

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissões devem ser um array' })
    }

    await knex.transaction(async (trx) => {
      // Remover permissões existentes
      await trx('profile_permissions').where('profile_id', profileId).del()

      // Inserir novas permissões
      const newPermissions = permissions.map(perm => ({
        profile_id: profileId,
        screen_id: perm.screen_id,
        can_view: perm.can_view || false,
        can_create: perm.can_create || false,
        can_edit: perm.can_edit || false,
        can_delete: perm.can_delete || false
      }))

      if (newPermissions.length > 0) {
        await trx('profile_permissions').insert(newPermissions)
      }
    })

    res.json({ message: 'Permissões atualizadas com sucesso' })
  } catch (error) {
    console.error('Erro ao atualizar permissões:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

// ─── Verificar Permissão Específica ───────────────────────────────────────────
exports.checkPermission = async (req, res) => {
  try {
    const { profileId, screenKey, action } = req.params

    const permission = await knex('profile_permissions as pp')
      .join('system_screens as ss', 'pp.screen_id', 'ss.id')
      .where('pp.profile_id', profileId)
      .where('ss.screen_key', screenKey)
      .select(`pp.can_${action}`)
      .first()

    const hasPermission = permission ? permission[`can_${action}`] : false

    res.json({ hasPermission })
  } catch (error) {
    console.error('Erro ao verificar permissão:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

// ─── Listar Todas as Telas com Status de Permissão ───────────────────────────
exports.getScreensWithPermissions = async (req, res) => {
  try {
    const { profileId } = req.params

    const screens = await knex('system_screens as ss')
      .leftJoin('profile_permissions as pp', function() {
        this.on('ss.id', '=', 'pp.screen_id')
            .andOn('pp.profile_id', '=', knex.raw('?', [profileId]))
      })
      .where('ss.is_active', true)
      .select(
        'ss.id',
        'ss.screen_key',
        'ss.screen_name',
        'ss.category',
        'ss.sort_order',
        knex.raw('COALESCE(pp.can_view, false) as can_view'),
        knex.raw('COALESCE(pp.can_create, false) as can_create'),
        knex.raw('COALESCE(pp.can_edit, false) as can_edit'),
        knex.raw('COALESCE(pp.can_delete, false) as can_delete')
      )
      .orderBy(['ss.category', 'ss.sort_order'])

    // Agrupar por categoria
    const grouped = screens.reduce((acc, screen) => {
      if (!acc[screen.category]) {
        acc[screen.category] = []
      }
      acc[screen.category].push(screen)
      return acc
    }, {})

    res.json({ data: grouped })
  } catch (error) {
    console.error('Erro ao buscar telas com permissões:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}