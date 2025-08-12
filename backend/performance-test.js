const axios = require('axios');
const { performance } = require('perf_hooks');

// Performance test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:3000',
  concurrentRequests: 10,
  totalRequests: 100,
  endpoints: [
    '/api/health',
    '/api/monitoring/status',
    '/api/tables',
    '/api/reservations',
  ],
  timeout: 5000,
};

// Performance metrics
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: [],
  startTime: null,
  endTime: null,
};

/**
 * Make a single request and measure performance
 */
async function makeRequest(endpoint) {
  const start = performance.now();

  try {
    const response = await axios.get(`${TEST_CONFIG.baseURL}${endpoint}`, {
      timeout: TEST_CONFIG.timeout,
    });

    const end = performance.now();
    const duration = end - start;

    metrics.totalRequests++;
    metrics.successfulRequests++;
    metrics.responseTimes.push(duration);

    return {
      success: true,
      duration,
      statusCode: response.status,
      endpoint,
    };
  } catch (error) {
    const end = performance.now();
    const duration = end - start;

    metrics.totalRequests++;
    metrics.failedRequests++;
    metrics.errors.push({
      endpoint,
      error: error.message,
      duration,
    });

    return {
      success: false,
      duration,
      error: error.message,
      endpoint,
    };
  }
}

/**
 * Run concurrent requests
 */
async function runConcurrentRequests(endpoint, count) {
  const promises = [];

  for (let i = 0; i < count; i++) {
    promises.push(makeRequest(endpoint));
  }

  return Promise.all(promises);
}

/**
 * Calculate performance statistics
 */
function calculateStats() {
  const responseTimes = metrics.responseTimes.sort((a, b) => a - b);
  const totalTime = metrics.endTime - metrics.startTime;

  return {
    totalRequests: metrics.totalRequests,
    successfulRequests: metrics.successfulRequests,
    failedRequests: metrics.failedRequests,
    successRate:
      ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) +
      '%',
    totalTime: totalTime.toFixed(2) + 'ms',
    averageResponseTime:
      (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(
        2
      ) + 'ms',
    minResponseTime: responseTimes[0]?.toFixed(2) + 'ms' || 'N/A',
    maxResponseTime:
      responseTimes[responseTimes.length - 1]?.toFixed(2) + 'ms' || 'N/A',
    p50ResponseTime:
      responseTimes[Math.floor(responseTimes.length * 0.5)]?.toFixed(2) +
        'ms' || 'N/A',
    p95ResponseTime:
      responseTimes[Math.floor(responseTimes.length * 0.95)]?.toFixed(2) +
        'ms' || 'N/A',
    p99ResponseTime:
      responseTimes[Math.floor(responseTimes.length * 0.99)]?.toFixed(2) +
        'ms' || 'N/A',
    requestsPerSecond: (metrics.totalRequests / (totalTime / 1000)).toFixed(2),
  };
}

/**
 * Run performance test for a specific endpoint
 */
async function testEndpoint(endpoint) {
  console.log(`\n🚀 Testing endpoint: ${endpoint}`);
  console.log('='.repeat(50));

  const results = await runConcurrentRequests(
    endpoint,
    TEST_CONFIG.totalRequests
  );

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Successful requests: ${successful.length}`);
  console.log(`❌ Failed requests: ${failed.length}`);

  if (successful.length > 0) {
    const avgTime =
      successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    console.log(`⏱️  Average response time: ${avgTime.toFixed(2)}ms`);
  }

  if (failed.length > 0) {
    console.log('❌ Errors:');
    failed.forEach((f) => {
      console.log(`   - ${f.error}`);
    });
  }

  return results;
}

/**
 * Run comprehensive performance test
 */
async function runPerformanceTest() {
  console.log('🎯 Starting Performance Test');
  console.log('='.repeat(50));
  console.log(`Base URL: ${TEST_CONFIG.baseURL}`);
  console.log(`Concurrent requests: ${TEST_CONFIG.concurrentRequests}`);
  console.log(`Total requests per endpoint: ${TEST_CONFIG.totalRequests}`);
  console.log(`Timeout: ${TEST_CONFIG.timeout}ms`);

  metrics.startTime = performance.now();

  // Test each endpoint
  for (const endpoint of TEST_CONFIG.endpoints) {
    await testEndpoint(endpoint);
  }

  metrics.endTime = performance.now();

  // Calculate overall statistics
  const stats = calculateStats();

  console.log('\n📊 Overall Performance Summary');
  console.log('='.repeat(50));
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Success Rate: ${stats.successRate}`);
  console.log(`Total Time: ${stats.totalTime}`);
  console.log(`Requests/Second: ${stats.requestsPerSecond}`);
  console.log(`Average Response Time: ${stats.averageResponseTime}`);
  console.log(`P50 Response Time: ${stats.p50ResponseTime}`);
  console.log(`P95 Response Time: ${stats.p95ResponseTime}`);
  console.log(`P99 Response Time: ${stats.p99ResponseTime}`);

  // Performance recommendations
  console.log('\n💡 Performance Recommendations');
  console.log('='.repeat(50));

  const avgResponseTime = parseFloat(stats.averageResponseTime);
  if (avgResponseTime > 500) {
    console.log('⚠️  Average response time is high (>500ms). Consider:');
    console.log('   - Implementing caching');
    console.log('   - Optimizing database queries');
    console.log('   - Adding compression');
  }

  const p95ResponseTime = parseFloat(stats.p95ResponseTime);
  if (p95ResponseTime > 1000) {
    console.log('⚠️  P95 response time is high (>1000ms). Consider:');
    console.log('   - Database query optimization');
    console.log('   - Connection pooling');
    console.log('   - Response size reduction');
  }

  const successRate = parseFloat(stats.successRate);
  if (successRate < 95) {
    console.log('⚠️  Success rate is low (<95%). Consider:');
    console.log('   - Error handling improvements');
    console.log('   - Timeout adjustments');
    console.log('   - Rate limiting review');
  }

  const rps = parseFloat(stats.requestsPerSecond);
  if (rps < 10) {
    console.log('⚠️  Requests per second is low (<10). Consider:');
    console.log('   - Server optimization');
    console.log('   - Load balancing');
    console.log('   - Horizontal scaling');
  }

  return stats;
}

/**
 * Run load test
 */
async function runLoadTest() {
  console.log('\n🔥 Starting Load Test');
  console.log('='.repeat(50));

  const loadLevels = [1, 5, 10, 20, 50];

  for (const load of loadLevels) {
    console.log(`\n📈 Testing with ${load} concurrent requests...`);

    const start = performance.now();
    const results = await runConcurrentRequests('/api/health', load);
    const end = performance.now();

    const successful = results.filter((r) => r.success);
    const avgTime =
      successful.length > 0
        ? successful.reduce((sum, r) => sum + r.duration, 0) / successful.length
        : 0;

    console.log(`   ✅ Success: ${successful.length}/${load}`);
    console.log(`   ⏱️  Average time: ${avgTime.toFixed(2)}ms`);
    console.log(`   🚀 Total time: ${(end - start).toFixed(2)}ms`);
  }
}

/**
 * Run stress test
 */
async function runStressTest() {
  console.log('\n💥 Starting Stress Test');
  console.log('='.repeat(50));

  const stressLevels = [100, 200, 500, 1000];

  for (const stress of stressLevels) {
    console.log(`\n💣 Testing with ${stress} requests...`);

    const start = performance.now();
    const results = await runConcurrentRequests('/api/health', stress);
    const end = performance.now();

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`   ✅ Success: ${successful.length}/${stress}`);
    console.log(`   ❌ Failed: ${failed.length}/${stress}`);
    console.log(`   ⏱️  Total time: ${(end - start).toFixed(2)}ms`);

    if (failed.length > 0) {
      console.log(
        `   🚨 Failure rate: ${((failed.length / stress) * 100).toFixed(2)}%`
      );
    }
  }
}

// Main execution
async function main() {
  try {
    // Check if server is running
    try {
      await axios.get(`${TEST_CONFIG.baseURL}/api/health`, { timeout: 2000 });
      console.log('✅ Server is running and accessible');
    } catch (error) {
      console.error(
        '❌ Server is not accessible. Please start the server first.'
      );
      process.exit(1);
    }

    // Run performance test
    await runPerformanceTest();

    // Run load test
    await runLoadTest();

    // Run stress test
    await runStressTest();

    console.log('\n🎉 Performance testing completed!');
  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runPerformanceTest,
  runLoadTest,
  runStressTest,
  makeRequest,
  calculateStats,
};
