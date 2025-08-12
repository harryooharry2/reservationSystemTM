# Monitoring and Alerting System

This document describes the comprehensive monitoring and alerting system implemented for the Cafe Reservation System.

## Overview

The monitoring system provides real-time visibility into:

- System performance and health
- Application metrics and errors
- Database status and performance
- WebSocket connections and activity
- Security events and alerts

## Monitoring Endpoints

### Health Checks

#### Basic Health Check

```bash
GET /health
```

Returns basic system health status.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-08-12T07:08:51.345Z",
  "uptime": 60.94207625,
  "environment": "development"
}
```

#### Detailed Health Check

```bash
GET /api/monitoring/health
```

Returns comprehensive health status including database and WebSocket checks.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-08-12T07:08:43.199Z",
  "checks": {
    "database": "connected",
    "websocket": "active"
  }
}
```

### Metrics and Performance

#### System Metrics

```bash
GET /api/monitoring/metrics
```

Returns detailed system and application metrics.

**Response:**

```json
{
  "system": {
    "cpuUsage": 13.25,
    "memoryUsage": 99.83,
    "diskUsage": 0,
    "timestamp": 1754982530918,
    "lastCheck": 1754982530918
  },
  "application": {
    "uptime": {
      "milliseconds": 75890,
      "formatted": "1m 15s"
    },
    "requests": {
      "total": 2,
      "successful": 1,
      "failed": 1,
      "startTime": 1754982470728,
      "requestsPerMinute": "1.58",
      "successRate": "50.00%"
    },
    "performance": {
      "averageResponseTime": 227,
      "recentErrors": [...]
    }
  },
  "database": {
    "users": 0,
    "reservations": 0,
    "tables": 8
  },
  "websocket": {
    "connectedClients": 0,
    "activeRooms": 0,
    "totalConnections": 0
  }
}
```

#### System Status

```bash
GET /api/monitoring/status
```

Returns comprehensive system status including recent activity.

**Response:**

```json
{
  "status": "operational",
  "timestamp": "2025-08-12T07:09:31.166Z",
  "system": {
    "uptime": "1m 39s",
    "requests": {...},
    "performance": {...}
  },
  "database": {
    "recentReservations": [],
    "recentUsers": [],
    "totalUsers": 0,
    "totalReservations": 0
  },
  "websocket": {
    "connectedClients": 0,
    "activeRooms": []
  },
  "alerts": {
    "active": 2,
    "thresholds": {...}
  }
}
```

#### Performance Metrics

```bash
GET /api/monitoring/performance
```

Returns detailed performance indicators.

**Response:**

```json
{
  "timestamp": "2025-08-12T07:09:31.166Z",
  "performance": {
    "responseTime": {
      "average": 626,
      "p95": 1000,
      "p99": 2000
    },
    "throughput": {
      "requestsPerMinute": "1.81",
      "successRate": "66.67%"
    },
    "errors": {
      "total": 1,
      "rate": "33.33%"
    },
    "system": {
      "cpu": "13.25%",
      "memory": "99.83%",
      "uptime": "1m 39s"
    }
  }
}
```

### Manual Health Check

```bash
POST /api/monitoring/check
```

Triggers a manual health check and returns updated metrics.

### Logs (Admin Only)

```bash
GET /api/monitoring/logs
```

Returns recent monitoring logs (last 100 entries).

## Alerting System

### Alert Thresholds

The system monitors the following thresholds:

- **CPU Usage**: 80% (warning)
- **Memory Usage**: 85% (warning)
- **Response Time**: 5 seconds (warning)
- **Error Rate**: 5% (critical)
- **Disk Usage**: 90% (critical)

### Alert Types

1. **HIGH_CPU_USAGE** - CPU usage exceeds threshold
2. **HIGH_MEMORY_USAGE** - Memory usage exceeds threshold
3. **HIGH_DISK_USAGE** - Disk usage exceeds threshold
4. **HIGH_ERROR_RATE** - Error rate exceeds threshold
5. **SLOW_RESPONSE** - Response time exceeds threshold

### Alert Processing

- Alerts are logged to monitoring logs
- Console output with severity indicators
- Alert history prevents spam (5-minute cooldown)
- In production, alerts can be sent to:
  - Email/SMS
  - Slack/Discord
  - PagerDuty
  - Custom webhooks

## Monitoring Configuration

### Environment Variables

```bash
# Monitoring thresholds
MONITORING_CPU_THRESHOLD=80
MONITORING_MEMORY_THRESHOLD=85
MONITORING_RESPONSE_TIME_THRESHOLD=5000
MONITORING_ERROR_RATE_THRESHOLD=5
MONITORING_DISK_THRESHOLD=90

# Monitoring intervals
MONITORING_CHECK_INTERVAL=60000
MONITORING_LOG_RETENTION_DAYS=30
MONITORING_MAX_LOG_SIZE=52428800
```

### Log Management

- **Log Location**: `logs/monitoring.log`
- **Max Log Size**: 50MB
- **Retention**: 30 days
- **Auto-rotation**: When size limit is reached
- **Cleanup**: Daily cleanup of old logs

## Production Monitoring Setup

### 1. External Monitoring Services

#### Uptime Monitoring

- **UptimeRobot**: Monitor `/health` endpoint
- **Pingdom**: Monitor `/api/monitoring/health` endpoint
- **StatusCake**: Monitor response times

#### Application Performance Monitoring (APM)

- **New Relic**: Application performance monitoring
- **DataDog**: Infrastructure and application monitoring
- **Sentry**: Error tracking and performance monitoring

### 2. Log Aggregation

#### Centralized Logging

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Fluentd**: Log collection and forwarding
- **Splunk**: Log analysis and monitoring

### 3. Alerting Channels

#### Email Alerts

```javascript
// Example email alert configuration
const emailAlert = {
  to: 'admin@cafe.com',
  subject: 'System Alert: High CPU Usage',
  body: 'CPU usage is 85% (threshold: 80%)',
};
```

#### Slack Integration

```javascript
// Example Slack webhook
const slackWebhook = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';
```

#### PagerDuty Integration

```javascript
// Example PagerDuty integration
const pagerDutyKey = 'YOUR_PAGERDUTY_API_KEY';
```

### 4. Dashboard Setup

#### Grafana Dashboard

Create dashboards for:

- System metrics (CPU, memory, disk)
- Application metrics (requests, response times, errors)
- Database metrics (connections, queries, performance)
- WebSocket metrics (connections, rooms, activity)

#### Custom Status Page

Create a public status page showing:

- System status
- Recent incidents
- Performance metrics
- Maintenance schedule

## Monitoring Best Practices

### 1. Threshold Tuning

- Start with conservative thresholds
- Adjust based on production patterns
- Monitor false positives and negatives
- Review thresholds monthly

### 2. Alert Fatigue Prevention

- Use appropriate severity levels
- Implement alert cooldowns
- Group related alerts
- Provide context in alert messages

### 3. Performance Optimization

- Monitor monitoring system impact
- Use efficient data collection
- Implement data retention policies
- Optimize log storage

### 4. Security Considerations

- Secure monitoring endpoints
- Encrypt sensitive metrics
- Implement access controls
- Audit monitoring access

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check for memory leaks
   - Review application logs
   - Monitor garbage collection
   - Consider scaling resources

2. **High CPU Usage**
   - Identify CPU-intensive operations
   - Check for infinite loops
   - Monitor database queries
   - Review caching strategies

3. **Slow Response Times**
   - Check database performance
   - Review network latency
   - Monitor external API calls
   - Analyze request patterns

4. **High Error Rates**
   - Check application logs
   - Monitor database connections
   - Review external dependencies
   - Analyze error patterns

### Debugging Commands

```bash
# Check system metrics
curl http://localhost:3000/api/monitoring/metrics

# Check recent logs
curl http://localhost:3000/api/monitoring/logs

# Trigger manual health check
curl -X POST http://localhost:3000/api/monitoring/check

# Check specific endpoint performance
curl -w "@curl-format.txt" http://localhost:3000/api/health
```

## Maintenance

### Daily Tasks

- Review monitoring alerts
- Check system metrics
- Verify log rotation
- Monitor error rates

### Weekly Tasks

- Analyze performance trends
- Review alert thresholds
- Check monitoring system health
- Update monitoring documentation

### Monthly Tasks

- Performance review
- Threshold optimization
- Monitoring system updates
- Capacity planning

## Support

For monitoring issues:

1. Check monitoring logs
2. Review system metrics
3. Verify alert configurations
4. Contact system administrator
