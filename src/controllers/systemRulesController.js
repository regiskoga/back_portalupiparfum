/**
 * Controller: Sistema de Regras Configuráveis
 * Gerencia regras de negócio, histórico e notificações
 */

const { db } = require('../models/db');
const { validationResult } = require('express-validator');

class SystemRulesController {
  
  // Listar todas as regras com filtros e busca
  async index(req, res) {
    try {
      const { 
        category, 
        search, 
        active_only = 'true',
        page = 1, 
        limit = 50 
      } = req.query;

      let query = db('system_rules')
        .select([
          'id', 'key', 'category', 'title', 'description',
          'config', 'numeric_value', 'text_value', 
          'is_active', 'is_editable', 'version',
          'created_at', 'updated_at'
        ]);

      // Filtros
      if (category) {
        query = query.where('category', category);
      }

      if (active_only === 'true') {
        query = query.where('is_active', true);
      }

      if (search) {
        query = query.where(function() {
          this.where('title', 'ilike', `%${search}%`)
              .orWhere('description', 'ilike', `%${search}%`)
              .orWhere('key', 'ilike', `%${search}%`);
        });
      }

      // Paginação
      const offset = (page - 1) * limit;
      const totalQuery = query.clone();
      const total = await totalQuery.count('* as count').first();
      
      const rules = await query
        .orderBy('category')
        .orderBy('title')
        .limit(limit)
        .offset(offset);

      // Agrupar por categoria
      const rulesByCategory = rules.reduce((acc, rule) => {
        if (!acc[rule.category]) {
          acc[rule.category] = [];
        }
        acc[rule.category].push(rule);
        return acc;
      }, {});

      res.json({
        data: rules,
        grouped: rulesByCategory,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(total.count),
          totalPages: Math.ceil(total.count / limit)
        }
      });

    } catch (error) {
      console.error('Erro ao listar regras:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  }

  // Buscar regra específica por ID ou key
  async show(req, res) {
    try {
      const { id } = req.params;
      
      let query = db('system_rules');
      
      // Buscar por ID numérico ou por key
      if (isNaN(id)) {
        query = query.where('key', id);
      } else {
        query = query.where('id', id);
      }

      const rule = await query.first();

      if (!rule) {
        return res.status(404).json({ 
          error: 'Regra não encontrada' 
        });
      }

      // Buscar histórico da regra
      const history = await db('system_rules_history')
        .where('rule_id', rule.id)
        .orderBy('changed_at', 'desc')
        .limit(10);

      res.json({
        data: rule,
        history: history
      });

    } catch (error) {
      console.error('Erro ao buscar regra:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  }

  // Criar nova regra (apenas admin)
  async store(req, res) {
    try {
      // Validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Dados inválidos', 
          details: errors.array() 
        });
      }

      const {
        key,
        category,
        title,
        description,
        config,
        numeric_value,
        text_value,
        is_editable = true
      } = req.body;

      // Verificar se key já existe
      const existingRule = await db('system_rules')
        .where('key', key)
        .first();

      if (existingRule) {
        return res.status(409).json({
          error: 'Chave da regra já existe',
          details: `A chave '${key}' já está em uso`
        });
      }

      // Inserir regra
      const [ruleId] = await db('system_rules').insert({
        key,
        category,
        title,
        description,
        config: config ? JSON.stringify(config) : null,
        numeric_value,
        text_value,
        is_editable,
        version: 1,
        created_by: req.user?.id || null, // TODO: implementar auth
        updated_by: req.user?.id || null
      }).returning('id');

      // Registrar no histórico
      await db('system_rules_history').insert({
        rule_id: ruleId,
        action: 'CREATE',
        old_values: null,
        new_values: JSON.stringify({
          key, category, title, description,
          numeric_value, text_value
        }),
        change_reason: 'Regra criada via interface administrativa',
        changed_by: req.user?.id || null
      });

      // Criar notificação
      await this.createNotification(ruleId, 'RULE_CREATED', 
        `Nova regra criada: ${title}`,
        `A regra "${title}" foi criada na categoria ${category}`
      );

      // Buscar regra criada
      const newRule = await db('system_rules')
        .where('id', ruleId)
        .first();

      res.status(201).json({
        message: 'Regra criada com sucesso',
        data: newRule
      });

    } catch (error) {
      console.error('Erro ao criar regra:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  }

  // Atualizar regra existente (apenas admin)
  async update(req, res) {
    try {
      const { id } = req.params;
      
      // Validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Dados inválidos', 
          details: errors.array() 
        });
      }

      // Buscar regra atual
      const currentRule = await db('system_rules')
        .where('id', id)
        .first();

      if (!currentRule) {
        return res.status(404).json({ 
          error: 'Regra não encontrada' 
        });
      }

      if (!currentRule.is_editable) {
        return res.status(403).json({
          error: 'Regra não editável',
          details: 'Esta regra é essencial para o funcionamento do sistema e não pode ser modificada'
        });
      }

      const {
        title,
        description,
        config,
        numeric_value,
        text_value,
        change_reason
      } = req.body;

      // Preparar dados para atualização
      const updateData = {
        title: title || currentRule.title,
        description: description || currentRule.description,
        config: config ? JSON.stringify(config) : currentRule.config,
        numeric_value: numeric_value !== undefined ? numeric_value : currentRule.numeric_value,
        text_value: text_value || currentRule.text_value,
        version: currentRule.version + 1,
        updated_by: req.user?.id || null
      };

      // Atualizar regra
      await db('system_rules')
        .where('id', id)
        .update(updateData);

      // Registrar no histórico
      await db('system_rules_history').insert({
        rule_id: id,
        action: 'UPDATE',
        old_values: JSON.stringify({
          title: currentRule.title,
          description: currentRule.description,
          numeric_value: currentRule.numeric_value,
          text_value: currentRule.text_value,
          version: currentRule.version
        }),
        new_values: JSON.stringify({
          title: updateData.title,
          description: updateData.description,
          numeric_value: updateData.numeric_value,
          text_value: updateData.text_value,
          version: updateData.version
        }),
        change_reason: change_reason || 'Regra atualizada via interface administrativa',
        changed_by: req.user?.id || null
      });

      // Criar notificação
      await this.createNotification(id, 'RULE_UPDATED',
        `Regra atualizada: ${updateData.title}`,
        `A regra "${updateData.title}" foi modificada. Versão: ${updateData.version}`
      );

      // Buscar regra atualizada
      const updatedRule = await db('system_rules')
        .where('id', id)
        .first();

      res.json({
        message: 'Regra atualizada com sucesso',
        data: updatedRule
      });

    } catch (error) {
      console.error('Erro ao atualizar regra:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  }

  // Ativar/Desativar regra
  async toggleActive(req, res) {
    try {
      const { id } = req.params;
      const { change_reason } = req.body;

      const rule = await db('system_rules')
        .where('id', id)
        .first();

      if (!rule) {
        return res.status(404).json({ 
          error: 'Regra não encontrada' 
        });
      }

      if (!rule.is_editable) {
        return res.status(403).json({
          error: 'Regra não pode ser desativada',
          details: 'Esta regra é essencial para o funcionamento do sistema'
        });
      }

      const newStatus = !rule.is_active;
      const action = newStatus ? 'ACTIVATE' : 'DEACTIVATE';

      // Atualizar status
      await db('system_rules')
        .where('id', id)
        .update({
          is_active: newStatus,
          updated_by: req.user?.id || null
        });

      // Registrar no histórico
      await db('system_rules_history').insert({
        rule_id: id,
        action: action,
        old_values: JSON.stringify({ is_active: rule.is_active }),
        new_values: JSON.stringify({ is_active: newStatus }),
        change_reason: change_reason || `Regra ${newStatus ? 'ativada' : 'desativada'} via interface`,
        changed_by: req.user?.id || null
      });

      // Criar notificação
      await this.createNotification(id, 'RULE_UPDATED',
        `Regra ${newStatus ? 'ativada' : 'desativada'}: ${rule.title}`,
        `A regra "${rule.title}" foi ${newStatus ? 'ativada' : 'desativada'}`
      );

      res.json({
        message: `Regra ${newStatus ? 'ativada' : 'desativada'} com sucesso`,
        data: { is_active: newStatus }
      });

    } catch (error) {
      console.error('Erro ao alterar status da regra:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  }

  // Listar histórico de uma regra
  async history(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const offset = (page - 1) * limit;

      const history = await db('system_rules_history')
        .where('rule_id', id)
        .orderBy('changed_at', 'desc')
        .limit(limit)
        .offset(offset);

      const total = await db('system_rules_history')
        .where('rule_id', id)
        .count('* as count')
        .first();

      res.json({
        data: history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(total.count),
          totalPages: Math.ceil(total.count / limit)
        }
      });

    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  }

  // Listar notificações
  async notifications(req, res) {
    try {
      const { unread_only = 'false', page = 1, limit = 20 } = req.query;

      let query = db('system_rules_notifications as n')
        .leftJoin('system_rules as r', 'n.rule_id', 'r.id')
        .select([
          'n.id', 'n.type', 'n.title', 'n.message', 
          'n.metadata', 'n.is_read', 'n.created_at',
          'r.key as rule_key', 'r.category as rule_category'
        ]);

      if (unread_only === 'true') {
        query = query.where('n.is_read', false);
      }

      const offset = (page - 1) * limit;
      
      const notifications = await query
        .orderBy('n.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const total = await db('system_rules_notifications')
        .count('* as count')
        .first();

      res.json({
        data: notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(total.count),
          totalPages: Math.ceil(total.count / limit)
        }
      });

    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  }

  // Marcar notificação como lida
  async markNotificationRead(req, res) {
    try {
      const { id } = req.params;

      await db('system_rules_notifications')
        .where('id', id)
        .update({ is_read: true });

      res.json({
        message: 'Notificação marcada como lida'
      });

    } catch (error) {
      console.error('Erro ao marcar notificação:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  }

  // Buscar valor de uma regra específica (para uso interno do sistema)
  async getRuleValue(req, res) {
    try {
      const { key } = req.params;

      const rule = await db('system_rules')
        .where('key', key)
        .where('is_active', true)
        .first();

      if (!rule) {
        return res.status(404).json({
          error: 'Regra não encontrada ou inativa'
        });
      }

      res.json({
        key: rule.key,
        numeric_value: rule.numeric_value,
        text_value: rule.text_value,
        config: rule.config ? JSON.parse(rule.config) : null
      });

    } catch (error) {
      console.error('Erro ao buscar valor da regra:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  }

  // Método auxiliar para criar notificações
  async createNotification(ruleId, type, title, message, metadata = null) {
    try {
      await db('system_rules_notifications').insert({
        rule_id: ruleId,
        type: type,
        title: title,
        message: message,
        metadata: metadata ? JSON.stringify(metadata) : null,
        user_id: null // null = notificação para todos
      });
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
    }
  }

  // Estatísticas das regras
  async stats(req, res) {
    try {
      const stats = await db('system_rules')
        .select('category')
        .count('* as total')
        .sum(db.raw('CASE WHEN is_active THEN 1 ELSE 0 END as active'))
        .sum(db.raw('CASE WHEN is_editable THEN 1 ELSE 0 END as editable'))
        .groupBy('category');

      const totalRules = await db('system_rules')
        .count('* as total')
        .first();

      const recentChanges = await db('system_rules_history')
        .where('changed_at', '>=', db.raw("NOW() - INTERVAL '7 days'"))
        .count('* as total')
        .first();

      const unreadNotifications = await db('system_rules_notifications')
        .where('is_read', false)
        .count('* as total')
        .first();

      res.json({
        by_category: stats,
        totals: {
          total_rules: parseInt(totalRules.total),
          recent_changes: parseInt(recentChanges.total),
          unread_notifications: parseInt(unreadNotifications.total)
        }
      });

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: error.message 
      });
    }
  }
}

module.exports = new SystemRulesController();