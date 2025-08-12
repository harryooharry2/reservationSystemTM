const os = require('os');
const fs = require('fs').promises;
const path = require('path');

// Monitoring configuration
const MONITORING_CONFIG = {
  logFile: path.join(__dirname, '../../logs/monitoring.log'),
  maxLogSize: 50 * 1024 * 1024, // 50MB
  alertThresholds: {
    cpuUsage: 80, // Alert if CPU usage > 80%
    memoryUsage: 85, // Alert if memory usage > 85%
    responseTime: 5000, // Alert if response time > 5 seconds
    errorRate: 5, // Alert if error rate > 5%
    diskUsage: 90, // Alert if disk usage > 90%
  },
  checkInterval: 60000, // Check every minute
  retentionDays: 30, // Keep logs for 30 days
};

// Performance metrics storage
const metrics = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    startTime: Date.now(),
  },
  responseTimes: [],
  errors: [],
  system: {
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    lastCheck: Date.now(),
  },
};

// Alert history to prevent spam
const alertHistory = new Map();

/**
 * Get system metrics
 */
async function getSystemMetrics() {
  try {
    // CPU usage
    const cpus = os.cpus();
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce(
      (acc, cpu) =>
        acc + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle,
      0
    );
    const cpuUsage = 100 - (totalIdle / totalTick) * 100;

    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

    // Disk usage (simplified - check logs directory)
    let diskUsage = 0;
    try {
      const logsDir = path.dirname(MONITORING_CONFIG.logFile);
      const stats = await fs.stat(logsDir);
      diskUsage = (stats.size / (1024 * 1024 * 1024)) * 100; // Convert to percentage
    } catch (error) {
      // If we can't check disk usage, assume it's fine
      diskUsage = 0;
    }

    return {
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage: Math.round(memoryUsage * 100) / 100,
      diskUsage: Math.round(diskUsage * 100) / 100,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Error getting system metrics:', error);
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      timestamp: Date.now(),
    };
  }
}

/**
 * Log monitoring data
 */
async function logMonitoringData(data) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...data,
    };

    // Ensure logs directory exists
    const logsDir = path.dirname(MONITORING_CONFIG.logFile);
    await fs.mkdir(logsDir, { recursive: true });

    // Append to monitoring log
    await fs.appendFile(
      MONITORING_CONFIG.logFile,
      JSON.stringify(logEntry) + '\n',
      'utf8'
    );

    // Check log file size and rotate if necessary
    const stats = await fs.stat(MONITORING_CONFIG.logFile);
    if (stats.size > MONITORING_CONFIG.maxLogSize) {
      await rotateLogFile();
    }
  } catch (error) {
    console.error('Error logging monitoring data:', error);
  }
}

/**
 * Rotate log file
 */
async function rotateLogFile() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${MONITORING_CONFIG.logFile}.${timestamp}`;

    await fs.rename(MONITORING_CONFIG.logFile, backupFile);
    console.log(`📁 Monitoring log rotated: ${backupFile}`);
  } catch (error) {
    console.error('Error rotating log file:', error);
  }
}

/**
 * Check for alerts
 */
async function checkAlerts(systemMetrics) {
  const alerts = [];

  // CPU usage alert
  if (systemMetrics.cpuUsage > MONITORING_CONFIG.alertThresholds.cpuUsage) {
    alerts.push({
      type: 'HIGH_CPU_USAGE',
      severity: 'warning',
      message: `CPU usage is ${systemMetrics.cpuUsage}% (threshold: ${MONITORING_CONFIG.alertThresholds.cpuUsage}%)`,
      value: systemMetrics.cpuUsage,
      threshold: MONITORING_CONFIG.alertThresholds.cpuUsage,
    });
  }

  // Memory usage alert
  if (
    systemMetrics.memoryUsage > MONITORING_CONFIG.alertThresholds.memoryUsage
  ) {
    alerts.push({
      type: 'HIGH_MEMORY_USAGE',
      severity: 'warning',
      message: `Memory usage is ${systemMetrics.memoryUsage}% (threshold: ${MONITORING_CONFIG.alertThresholds.memoryUsage}%)`,
      value: systemMetrics.memoryUsage,
      threshold: MONITORING_CONFIG.alertThresholds.memoryUsage,
    });
  }

  // Disk usage alert
  if (systemMetrics.diskUsage > MONITORING_CONFIG.alertThresholds.diskUsage) {
    alerts.push({
      type: 'HIGH_DISK_USAGE',
      severity: 'critical',
      message: `Disk usage is ${systemMetrics.diskUsage}% (threshold: ${MONITORING_CONFIG.alertThresholds.diskUsage}%)`,
      value: systemMetrics.diskUsage,
      threshold: MONITORING_CONFIG.alertThresholds.diskUsage,
    });
  }

  // Error rate alert
  const totalRequests = metrics.requests.total;
  if (totalRequests > 0) {
    const errorRate = (metrics.requests.failed / totalRequests) * 100;
    if (errorRate > MONITORING_CONFIG.alertThresholds.errorRate) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        severity: 'critical',
        message: `Error rate is ${errorRate.toFixed(2)}% (threshold: ${MONITORING_CONFIG.alertThresholds.errorRate}%)`,
        value: errorRate,
        threshold: MONITORING_CONFIG.alertThresholds.errorRate,
      });
    }
  }

  // Process alerts
  for (const alert of alerts) {
    await processAlert(alert);
  }
}

/**
 * Process an alert
 */
async function processAlert(alert) {
  const alertKey = `${alert.type}_${Math.floor(Date.now() / (5 * 60 * 1000))}`; // 5-minute window

  // Check if we've already alerted for this issue recently
  if (alertHistory.has(alertKey)) {
    return;
  }

  // Log the alert
  await logMonitoringData({
    type: 'ALERT',
    alert,
  });

  // Store alert in history
  alertHistory.set(alertKey, Date.now());

  // Clean up old alert history
  const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
  for (const [key, timestamp] of alertHistory.entries()) {
    if (timestamp < cutoff) {
      alertHistory.delete(key);
    }
  }

  // Log alert to console
  const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
  console.log(
    `${emoji} ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`
  );

  // In production, you would send alerts to:
  // - Email/SMS
  // - Slack/Discord
  // - PagerDuty
  // - Custom webhook
}

/**
 * Performance monitoring middleware
 */
function performanceMonitoring(req, res, next) {
  const startTime = Date.now();
  const originalSend = res.send;

  // Override res.send to capture response data
  res.send = function (data) {
    const duration = Date.now() - startTime;

    // Update metrics
    metrics.requests.total++;
    if (res.statusCode >= 200 && res.statusCode < 400) {
      metrics.requests.successful++;
    } else {
      metrics.requests.failed++;
      metrics.errors.push({
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        duration,
        timestamp: Date.now(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
    }

    // Store response time (keep last 100)
    metrics.responseTimes.push(duration);
    if (metrics.responseTimes.length > 100) {
      metrics.responseTimes.shift();
    }

    // Check for slow response alert
    if (duration > MONITORING_CONFIG.alertThresholds.responseTime) {
      const alert = {
        type: 'SLOW_RESPONSE',
        severity: 'warning',
        message: `Slow response: ${duration}ms for ${req.method} ${req.path}`,
        value: duration,
        threshold: MONITORING_CONFIG.alertThresholds.responseTime,
        path: req.path,
        method: req.method,
      };
      processAlert(alert);
    }

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * System monitoring function (runs periodically)
 */
async function systemMonitoring() {
  try {
    const systemMetrics = await getSystemMetrics();

    // Update system metrics
    metrics.system = {
      ...systemMetrics,
      lastCheck: Date.now(),
    };

    // Log system metrics
    await logMonitoringData({
      type: 'SYSTEM_METRICS',
      metrics: systemMetrics,
      applicationMetrics: {
        requests: metrics.requests,
        averageResponseTime:
          metrics.responseTimes.length > 0
            ? metrics.responseTimes.reduce((a, b) => a + b, 0) /
              metrics.responseTimes.length
            : 0,
        errorCount: metrics.errors.length,
      },
    });

    // Check for alerts
    await checkAlerts(systemMetrics);
  } catch (error) {
    console.error('Error in system monitoring:', error);
  }
}

/**
 * Get current metrics
 */
function getMetrics() {
  const averageResponseTime =
    metrics.responseTimes.length > 0
      ? metrics.responseTimes.reduce((a, b) => a + b, 0) /
        metrics.responseTimes.length
      : 0;

  const uptime = Date.now() - metrics.requests.startTime;
  const requestsPerMinute = (metrics.requests.total / (uptime / 60000)).toFixed(
    2
  );

  return {
    system: metrics.system,
    application: {
      uptime: {
        milliseconds: uptime,
        formatted: formatUptime(uptime),
      },
      requests: {
        ...metrics.requests,
        requestsPerMinute,
        successRate:
          metrics.requests.total > 0
            ? (
                (metrics.requests.successful / metrics.requests.total) *
                100
              ).toFixed(2) + '%'
            : '0%',
      },
      performance: {
        averageResponseTime: Math.round(averageResponseTime),
        recentErrors: metrics.errors.slice(-10), // Last 10 errors
      },
    },
    alerts: {
      thresholds: MONITORING_CONFIG.alertThresholds,
      activeAlerts: alertHistory.size,
    },
  };
}

/**
 * Format uptime
 */
function formatUptime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Clean up old logs
 */
async function cleanupOldLogs() {
  try {
    const logsDir = path.dirname(MONITORING_CONFIG.logFile);
    const files = await fs.readdir(logsDir);
    const cutoff =
      Date.now() - MONITORING_CONFIG.retentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.startsWith('monitoring.log.')) {
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() < cutoff) {
          await fs.unlink(filePath);
          console.log(`🗑️ Deleted old log file: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up old logs:', error);
  }
}

// Start monitoring
let monitoringInterval;
let cleanupInterval;

function startMonitoring() {
  // Run system monitoring every minute
  monitoringInterval = setInterval(
    systemMonitoring,
    MONITORING_CONFIG.checkInterval
  );

  // Clean up old logs daily
  cleanupInterval = setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

  console.log('📊 Monitoring system started');
}

function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  console.log('📊 Monitoring system stopped');
}

module.exports = {
  performanceMonitoring,
  systemMonitoring,
  getMetrics,
  startMonitoring,
  stopMonitoring,
  MONITORING_CONFIG,
};
