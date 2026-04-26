const { db } = require('../models/db')
const ActivityLogger = require('../services/activityLogger')

// ─── GET ENTITY LOGS ──────────────────────────────────────────────────────────
async function getEntityLogs(req, res) {
  try {
    const { entityType, entityId } = req.params
    const { limit = 50 } = req.query

    const logs = await ActivityLogger.getEntityLogs(entityType, parseInt(entityId), parseInt(limit))
    
    res.json({
      entity_type: entityType,
      entity_id: parseInt(entityId),
      total_logs: logs.length,
      logs
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── GET ACTIVITY LOGS ────────────────────────────────────────────────────────
async function getActivityLogs(req, res) {
  try {
    const { activityType } = req.params
    const { limit = 100 } = req.query

    const logs = await ActivityLogger.getActivityLogs(activityType, parseInt(limit))
    
    res.json({
      activity_type: activityType,
      total_logs: logs.length,
      logs
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── GET LOGS BY DATE RANGE ──────────────────────────────────────────────────
async function getLogsByDateRange(req, res) {
  try {
    const { startDate, endDate } = req.query
    const { limit = 500 } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }

    const logs = await ActivityLogger.getLogsByDateRange(startDate, endDate, parseInt(limit))
    
    res.json({
      start_date: startDate,
      end_date: endDate,
      total_logs: logs.length,
      logs
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── TRACE PRODUCT ORIGIN ────────────────────────────────────────────────────
async function traceProductOrigin(req, res) {
  try {
    const { bottlingId } = req.params

    const trace = await ActivityLogger.traceProductOrigin(parseInt(bottlingId))
    
    if (!trace) {
      return res.status(404).json({ error: 'Bottling not found' })
    }

    res.json({
      title: 'Rastreabilidade: Frasco → Origem',
      bottling_id: parseInt(bottlingId),
      trace
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── TRACE SUPPLY USAGE ──────────────────────────────────────────────────────
async function traceSupplyUsage(req, res) {
  try {
    const { supplyId } = req.params

    const trace = await ActivityLogger.traceSupplyUsage(parseInt(supplyId))
    
    if (!trace) {
      return res.status(404).json({ error: 'Supply not found' })
    }

    res.json({
      title: 'Rastreabilidade: Insumo → Destino',
      supply_id: parseInt(supplyId),
      trace
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── GET ACTIVITY STATS ───────────────────────────────────────────────────────
async function getActivityStats(req, res) {
  try {
    const { days = 30 } = req.query

    const stats = await ActivityLogger.getActivityStats(parseInt(days))
    
    res.json({
      period_days: parseInt(days),
      stats
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ─── LIST ALL LOGS ───────────────────────────────────────────────────────────
async function listLogs(req, res) {
  try {
    const { limit = 100, offset = 0, activityType, entityType } = req.query

    let query = db('activity_logs')

    if (activityType) {
      query = query.where('activity_type', activityType)
    }

    if (entityType) {
      query = query.where('entity_type', entityType)
    }

    const total = await query.clone().count('* as count').first()
    const logs = await query
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))

    res.json({
      total: parseInt(total.count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      logs
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

module.exports = {
  getEntityLogs,
  getActivityLogs,
  getLogsByDateRange,
  traceProductOrigin,
  traceSupplyUsage,
  getActivityStats,
  listLogs
}