const fs = require('fs').promises;
const path = require('path');

// Security event types
const SECURITY_EVENTS = {
  AUTH_FAILURE: 'AUTH_FAILURE',
  RATE_LIMIT: 'RATE_LIMIT',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  VALIDATION_FAILURE: 'VALIDATION_FAILURE',
  CORS_VIOLATION: 'CORS_VIOLATION',
  SQL_INJECTION_ATTEMPT: 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT: 'XSS_ATTEMPT',
  BRUTE_FORCE: 'BRUTE_FORCE',
  UNUSUAL_PATTERN: 'UNUSUAL_PATTERN',
};

// Security monitoring configuration
const SECURITY_CONFIG = {
  logFile: path.join(__dirname, '../../logs/security.log'),
  maxLogSize: 10 * 1024 * 1024, // 10MB
  alertThresholds: {
    authFailures: 5, // Alert after 5 auth failures per IP
    rateLimitViolations: 3, // Alert after 3 rate limit violations per IP
    suspiciousPatterns: 2, // Alert after 2 suspicious patterns per IP
  },
  ipTracking: new Map(), // Track IP-based events
  alertCooldown: 5 * 60 * 1000, // 5 minutes between alerts for same IP
};

// IP tracking for security monitoring
const ipEventCounts = new Map();
const ipAlertTimestamps = new Map();

// Security event logger
const logSecurityEvent = async (eventType, details) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    eventType,
    details,
    severity: getEventSeverity(eventType),
  };

  try {
    // Ensure logs directory exists
    const logsDir = path.dirname(SECURITY_CONFIG.logFile);
    await fs.mkdir(logsDir, { recursive: true });

    // Append to security log
    await fs.appendFile(
      SECURITY_CONFIG.logFile,
      JSON.stringify(logEntry) + '\n',
      'utf8'
    );

    // Check log file size and rotate if necessary
    await checkAndRotateLog();

    // Track IP-based events
    if (details.ip) {
      trackIPEvent(details.ip, eventType);
    }

    // Check for security alerts
    await checkSecurityAlerts(details.ip, eventType);

    console.log(`🔒 Security Event [${eventType}]:`, logEntry);
  } catch (error) {
    console.error('Error logging security event:', error);
  }
};

// Get event severity level
const getEventSeverity = (eventType) => {
  const severityLevels = {
    [SECURITY_EVENTS.AUTH_FAILURE]: 'medium',
    [SECURITY_EVENTS.RATE_LIMIT]: 'low',
    [SECURITY_EVENTS.SUSPICIOUS_ACTIVITY]: 'high',
    [SECURITY_EVENTS.TOKEN_REVOKED]: 'medium',
    [SECURITY_EVENTS.VALIDATION_FAILURE]: 'low',
    [SECURITY_EVENTS.CORS_VIOLATION]: 'medium',
    [SECURITY_EVENTS.SQL_INJECTION_ATTEMPT]: 'critical',
    [SECURITY_EVENTS.XSS_ATTEMPT]: 'critical',
    [SECURITY_EVENTS.BRUTE_FORCE]: 'high',
    [SECURITY_EVENTS.UNUSUAL_PATTERN]: 'medium',
  };
  return severityLevels[eventType] || 'low';
};

// Track IP-based events
const trackIPEvent = (ip, eventType) => {
  if (!ipEventCounts.has(ip)) {
    ipEventCounts.set(ip, new Map());
  }

  const ipEvents = ipEventCounts.get(ip);
  const currentCount = ipEvents.get(eventType) || 0;
  ipEvents.set(eventType, currentCount + 1);

  // Clean up old entries (keep only last hour)
  setTimeout(
    () => {
      if (ipEventCounts.has(ip)) {
        const events = ipEventCounts.get(ip);
        events.delete(eventType);
        if (events.size === 0) {
          ipEventCounts.delete(ip);
        }
      }
    },
    60 * 60 * 1000
  ); // 1 hour
};

// Check for security alerts
const checkSecurityAlerts = async (ip, eventType) => {
  if (!ip) return;

  const now = Date.now();
  const lastAlert = ipAlertTimestamps.get(ip) || 0;

  // Check cooldown period
  if (now - lastAlert < SECURITY_CONFIG.alertCooldown) {
    return;
  }

  const ipEvents = ipEventCounts.get(ip);
  if (!ipEvents) return;

  let shouldAlert = false;
  let alertReason = '';

  // Check auth failure threshold
  const authFailures = ipEvents.get(SECURITY_EVENTS.AUTH_FAILURE) || 0;
  if (authFailures >= SECURITY_CONFIG.alertThresholds.authFailures) {
    shouldAlert = true;
    alertReason = `Multiple authentication failures (${authFailures})`;
  }

  // Check rate limit violations
  const rateLimitViolations = ipEvents.get(SECURITY_EVENTS.RATE_LIMIT) || 0;
  if (
    rateLimitViolations >= SECURITY_CONFIG.alertThresholds.rateLimitViolations
  ) {
    shouldAlert = true;
    alertReason = `Multiple rate limit violations (${rateLimitViolations})`;
  }

  // Check for suspicious patterns
  const suspiciousPatterns =
    ipEvents.get(SECURITY_EVENTS.SUSPICIOUS_ACTIVITY) || 0;
  if (
    suspiciousPatterns >= SECURITY_CONFIG.alertThresholds.suspiciousPatterns
  ) {
    shouldAlert = true;
    alertReason = `Suspicious activity patterns detected (${suspiciousPatterns})`;
  }

  if (shouldAlert) {
    await triggerSecurityAlert(ip, alertReason, ipEvents);
    ipAlertTimestamps.set(ip, now);
  }
};

// Trigger security alert
const triggerSecurityAlert = async (ip, reason, events) => {
  const alert = {
    timestamp: new Date().toISOString(),
    type: 'SECURITY_ALERT',
    ip,
    reason,
    eventCounts: Object.fromEntries(events),
    severity: 'high',
  };

  try {
    // Log alert
    await fs.appendFile(
      SECURITY_CONFIG.logFile,
      JSON.stringify(alert) + '\n',
      'utf8'
    );

    // Console alert
    console.log('🚨 SECURITY ALERT:', alert);

    // In production, you would send alerts to:
    // - Email notifications
    // - Slack/Discord webhooks
    // - Security monitoring services
    // - SIEM systems
  } catch (error) {
    console.error('Error triggering security alert:', error);
  }
};

// Check and rotate log file
const checkAndRotateLog = async () => {
  try {
    const stats = await fs.stat(SECURITY_CONFIG.logFile);

    if (stats.size > SECURITY_CONFIG.maxLogSize) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `${SECURITY_CONFIG.logFile}.${timestamp}`;

      await fs.rename(SECURITY_CONFIG.logFile, backupFile);
      console.log(`📁 Security log rotated: ${backupFile}`);
    }
  } catch (error) {
    // File doesn't exist yet, which is fine
  }
};

// Input sanitization checker
const detectMaliciousInput = (input) => {
  if (typeof input !== 'string') return false;

  const patterns = {
    sqlInjection:
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b)/i,
    xss: /(<script|javascript:|vbscript:|onload=|onerror=|onclick=)/i,
    pathTraversal: /(\.\.\/|\.\.\\)/,
    commandInjection: /(\b(cmd|command|exec|system|eval|function)\b)/i,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(input)) {
      return { type, pattern: input };
    }
  }

  return false;
};

// Security monitoring middleware
const securityMonitoring = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  // Override res.send to capture response data
  res.send = function (data) {
    const duration = Date.now() - startTime;

    // Check for suspicious patterns
    const suspiciousPatterns = [];

    // Check request body for malicious input
    if (req.body) {
      const bodyStr = JSON.stringify(req.body);
      const maliciousInput = detectMaliciousInput(bodyStr);
      if (maliciousInput) {
        suspiciousPatterns.push({
          type: maliciousInput.type,
          source: 'request_body',
          pattern: maliciousInput.pattern,
        });
      }
    }

    // Check query parameters
    if (req.query) {
      const queryStr = JSON.stringify(req.query);
      const maliciousInput = detectMaliciousInput(queryStr);
      if (maliciousInput) {
        suspiciousPatterns.push({
          type: maliciousInput.type,
          source: 'query_params',
          pattern: maliciousInput.pattern,
        });
      }
    }

    // Log suspicious patterns
    if (suspiciousPatterns.length > 0) {
      logSecurityEvent(SECURITY_EVENTS.SUSPICIOUS_ACTIVITY, {
        ip: req.ip,
        method: req.method,
        path: req.path,
        patterns: suspiciousPatterns,
        userAgent: req.get('User-Agent'),
      });
    }

    // Log slow requests
    if (duration > 5000) {
      // 5 seconds
      logSecurityEvent(SECURITY_EVENTS.UNUSUAL_PATTERN, {
        ip: req.ip,
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        type: 'slow_request',
      });
    }

    // Call original send
    return originalSend.call(this, data);
  };

  next();
};

// Export security monitoring functions
module.exports = {
  logSecurityEvent,
  securityMonitoring,
  detectMaliciousInput,
  SECURITY_EVENTS,
  SECURITY_CONFIG,
};
