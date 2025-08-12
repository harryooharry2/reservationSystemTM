const express = require('express');
const { getMetrics, systemMonitoring } = require('../middleware/monitoring');
const { supabase } = require('../config/supabase');
const socketManager = require('../config/socket');

const router = express.Router();

// GET /api/monitoring/health - Basic health check
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const { data: dbCheck, error: dbError } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (dbError) {
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'failed',
          websocket: 'unknown',
        },
        error: dbError.message,
      });
    }

    // Check WebSocket connection
    const wsStatus =
      socketManager.getConnectedClientsInfo().length >= 0
        ? 'active'
        : 'inactive';

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        websocket: wsStatus,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// GET /api/monitoring/metrics - Detailed metrics
router.get('/metrics', async (req, res) => {
  try {
    const metrics = getMetrics();

    // Add database metrics
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: reservationCount } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true });

    const { count: tableCount } = await supabase
      .from('cafe_tables')
      .select('*', { count: 'exact', head: true });

    // Add WebSocket metrics
    const wsMetrics = {
      connectedClients: socketManager.getConnectedClientsInfo().length,
      activeRooms: socketManager.getActiveRooms().length,
      totalConnections: socketManager.getTotalConnections(),
    };

    res.json({
      ...metrics,
      database: {
        users: userCount || 0,
        reservations: reservationCount || 0,
        tables: tableCount || 0,
      },
      websocket: wsMetrics,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      details: error.message,
    });
  }
});

// GET /api/monitoring/status - System status
router.get('/status', async (req, res) => {
  try {
    const metrics = getMetrics();
    const { data: recentReservations } = await supabase
      .from('reservations')
      .select('id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: recentUsers } = await supabase
      .from('users')
      .select('id, role, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      system: {
        uptime: metrics.application.uptime.formatted,
        requests: metrics.application.requests,
        performance: metrics.application.performance,
      },
      database: {
        recentReservations: recentReservations || [],
        recentUsers: recentUsers || [],
        totalUsers: metrics.database?.users || 0,
        totalReservations: metrics.database?.reservations || 0,
      },
      websocket: {
        connectedClients: socketManager.getConnectedClientsInfo().length,
        activeRooms: socketManager.getActiveRooms(),
      },
      alerts: {
        active: metrics.alerts.activeAlerts,
        thresholds: metrics.alerts.thresholds,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get system status',
      details: error.message,
    });
  }
});

// POST /api/monitoring/check - Manual health check
router.post('/check', async (req, res) => {
  try {
    // Run system monitoring
    await systemMonitoring();

    // Get updated metrics
    const metrics = getMetrics();

    res.json({
      status: 'check_completed',
      timestamp: new Date().toISOString(),
      metrics: metrics.system,
      message: 'Health check completed successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Health check failed',
      details: error.message,
    });
  }
});

// GET /api/monitoring/logs - Get recent logs (admin only)
router.get('/logs', async (req, res) => {
  try {
    // In a real implementation, you would check admin permissions here
    const fs = require('fs').promises;
    const path = require('path');

    const logFile = path.join(__dirname, '../../logs/monitoring.log');

    try {
      const logContent = await fs.readFile(logFile, 'utf8');
      const lines = logContent.split('\n').filter((line) => line.trim());
      const recentLogs = lines.slice(-100); // Last 100 lines

      res.json({
        logs: recentLogs.map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return { raw: line };
          }
        }),
        totalLines: lines.length,
        showing: recentLogs.length,
      });
    } catch (fileError) {
      res.json({
        logs: [],
        message: 'No logs available',
        error: fileError.message,
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get logs',
      details: error.message,
    });
  }
});

// GET /api/monitoring/performance - Performance metrics
router.get('/performance', async (req, res) => {
  try {
    const metrics = getMetrics();

    // Calculate performance indicators
    const performance = {
      responseTime: {
        average: Math.round(
          metrics.application.performance.averageResponseTime
        ),
        p95: calculatePercentile(
          metrics.application.performance.responseTimes || [],
          95
        ),
        p99: calculatePercentile(
          metrics.application.performance.responseTimes || [],
          99
        ),
      },
      throughput: {
        requestsPerMinute: metrics.application.requests.requestsPerMinute,
        successRate: metrics.application.requests.successRate,
      },
      errors: {
        total: metrics.application.performance.recentErrors.length,
        rate:
          metrics.application.requests.total > 0
            ? (
                (metrics.application.requests.failed /
                  metrics.application.requests.total) *
                100
              ).toFixed(2) + '%'
            : '0%',
      },
      system: {
        cpu: metrics.system.cpuUsage + '%',
        memory: metrics.system.memoryUsage + '%',
        uptime: metrics.application.uptime.formatted,
      },
    };

    res.json({
      timestamp: new Date().toISOString(),
      performance,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get performance metrics',
      details: error.message,
    });
  }
});

// Helper function to calculate percentile
function calculatePercentile(values, percentile) {
  if (!values || values.length === 0) return 0;

  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

module.exports = router;
