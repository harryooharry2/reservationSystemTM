const faker = require('faker');

// Helper functions for Artillery testing
function generateTestData() {
  return {
    randomString: () => faker.lorem.word(),
    randomEmail: () => faker.internet.email(),
    randomPhoneNumber: () => faker.phone.phoneNumber(),
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    isoTimestamp: () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    },
    randomTime: () => {
      const hours = Math.floor(Math.random() * 12) + 11; // 11 AM to 10 PM
      const minutes = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    },
  };
}

// Custom response validation
function validateResponse(response, context, events, done) {
  // Check response time
  if (response.timings.dns > 100) {
    events.emit('customMetric', 'dns_slow', response.timings.dns);
  }

  if (response.timings.firstByte > 500) {
    events.emit('customMetric', 'first_byte_slow', response.timings.firstByte);
  }

  if (response.timings.download > 1000) {
    events.emit('customMetric', 'download_slow', response.timings.download);
  }

  // Check response size
  if (response.body && response.body.length > 100000) {
    events.emit('customMetric', 'large_response', response.body.length);
  }

  // Validate JSON responses
  if (
    response.headers['content-type'] &&
    response.headers['content-type'].includes('application/json')
  ) {
    try {
      JSON.parse(response.body);
    } catch (e) {
      events.emit('customMetric', 'invalid_json', 1);
    }
  }

  return done();
}

// Authentication helper
function setAuthToken(requestParams, context, events, done) {
  if (context.vars.authToken) {
    requestParams.headers = requestParams.headers || {};
    requestParams.headers['Authorization'] = `Bearer ${context.vars.authToken}`;
  }
  return done();
}

// Rate limiting simulation
function simulateRateLimit(requestParams, context, events, done) {
  // Add random delays to simulate real user behavior
  const delay = Math.random() * 2000; // 0-2 seconds
  setTimeout(() => {
    return done();
  }, delay);
}

// Error handling
function handleErrors(err, requestParams, context, events, done) {
  if (err) {
    events.emit('customMetric', 'request_error', 1);
    console.error('Request error:', err.message);
  }
  return done();
}

// Performance monitoring
function monitorPerformance(requestParams, context, events, done) {
  const startTime = Date.now();

  return function (response) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Track response times
    events.emit('customMetric', 'response_time', duration);

    // Track slow responses
    if (duration > 1000) {
      events.emit('customMetric', 'slow_response', duration);
    }

    // Track error rates
    if (response.statusCode >= 400) {
      events.emit('customMetric', 'error_rate', 1);
    }

    return done();
  };
}

// Database connection monitoring
function checkDatabaseHealth(requestParams, context, events, done) {
  // This would typically check database connection pool status
  // For now, we'll simulate it
  const dbHealth = Math.random() > 0.1; // 90% healthy

  if (!dbHealth) {
    events.emit('customMetric', 'database_unhealthy', 1);
  }

  return done();
}

// Memory usage monitoring
function checkMemoryUsage(requestParams, context, events, done) {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

  if (heapUsedMB > 500) {
    // 500MB threshold
    events.emit('customMetric', 'high_memory_usage', heapUsedMB);
  }

  return done();
}

// Export functions for Artillery
module.exports = {
  generateTestData,
  validateResponse,
  setAuthToken,
  simulateRateLimit,
  handleErrors,
  monitorPerformance,
  checkDatabaseHealth,
  checkMemoryUsage,
};
