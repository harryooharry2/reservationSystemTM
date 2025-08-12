const axios = require('axios');
const { performance } = require('perf_hooks');

// QA test configuration
const QA_CONFIG = {
  baseURL: 'http://localhost:3000',
  timeout: 5000,
  testUser: {
    email: 'test@example.com',
    password: 'testpassword',
  },
};

// QA test results
const qaResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  issues: [],
  startTime: null,
  endTime: null,
};

/**
 * Log QA test result
 */
function logResult(testName, passed, details = '') {
  qaResults.totalTests++;
  if (passed) {
    qaResults.passedTests++;
    console.log(`✅ ${testName}: PASSED`);
  } else {
    qaResults.failedTests++;
    qaResults.issues.push({ testName, details });
    console.log(`❌ ${testName}: FAILED - ${details}`);
  }
}

/**
 * Test 1: Error Handling
 */
async function testErrorHandling() {
  console.log('\n🔍 Testing Error Handling');
  console.log('='.repeat(50));

  const errorScenarios = [
    {
      name: 'Invalid JSON',
      method: 'post',
      url: '/api/auth/login',
      data: 'invalid json',
      expectedStatus: 400,
    },
    {
      name: 'Missing Required Fields',
      method: 'post',
      url: '/api/auth/register',
      data: { email: 'test@example.com' }, // Missing password
      expectedStatus: 400,
    },
    {
      name: 'Non-existent Endpoint',
      method: 'get',
      url: '/api/nonexistent',
      expectedStatus: 404,
    },
    {
      name: 'Invalid HTTP Method',
      method: 'patch',
      url: '/api/health',
      expectedStatus: 405,
    },
  ];

  for (const scenario of errorScenarios) {
    try {
      const config = {
        method: scenario.method,
        url: `${QA_CONFIG.baseURL}${scenario.url}`,
        timeout: QA_CONFIG.timeout,
      };

      if (scenario.data) {
        if (typeof scenario.data === 'string') {
          config.headers = { 'Content-Type': 'application/json' };
          config.data = scenario.data;
        } else {
          config.data = scenario.data;
        }
      }

      const response = await axios(config);

      if (response.status === scenario.expectedStatus) {
        logResult(`Error Handling (${scenario.name})`, true);
      } else {
        logResult(
          `Error Handling (${scenario.name})`,
          false,
          `Expected ${scenario.expectedStatus}, got ${response.status}`
        );
      }
    } catch (error) {
      if (error.response && error.response.status === scenario.expectedStatus) {
        logResult(`Error Handling (${scenario.name})`, true);
      } else {
        logResult(
          `Error Handling (${scenario.name})`,
          false,
          `Expected ${scenario.expectedStatus}, got ${error.response?.status || 'network error'}`
        );
      }
    }
  }

  return true;
}

/**
 * Test 2: Response Format Consistency
 */
async function testResponseFormat() {
  console.log('\n🔍 Testing Response Format Consistency');
  console.log('='.repeat(50));

  const endpoints = ['/api/health', '/api/monitoring/status'];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${QA_CONFIG.baseURL}${endpoint}`);

      // Check if response is valid JSON
      if (typeof response.data === 'object') {
        logResult(`Response Format (${endpoint})`, true);
      } else {
        logResult(
          `Response Format (${endpoint})`,
          false,
          'Response is not valid JSON object'
        );
      }

      // Check for consistent error response format
      if (response.data.error) {
        if (response.data.message && response.data.status) {
          logResult(`Error Format (${endpoint})`, true);
        } else {
          logResult(
            `Error Format (${endpoint})`,
            false,
            'Error response missing required fields'
          );
        }
      }
    } catch (error) {
      logResult(
        `Response Format (${endpoint})`,
        false,
        `Request failed: ${error.message}`
      );
    }
  }

  return true;
}

/**
 * Test 3: API Documentation Compliance
 */
async function testAPIDocumentation() {
  console.log('\n🔍 Testing API Documentation Compliance');
  console.log('='.repeat(50));

  try {
    const response = await axios.get(`${QA_CONFIG.baseURL}/api`);
    const apiInfo = response.data;

    // Check if API provides comprehensive information
    const requiredFields = ['message', 'version', 'status', 'endpoints'];
    let allFieldsPresent = true;

    for (const field of requiredFields) {
      if (!apiInfo[field]) {
        logResult(
          `API Documentation (${field})`,
          false,
          `Missing required field: ${field}`
        );
        allFieldsPresent = false;
      } else {
        logResult(`API Documentation (${field})`, true);
      }
    }

    // Check if endpoints are documented
    if (apiInfo.endpoints && Object.keys(apiInfo.endpoints).length > 0) {
      logResult('API Documentation (endpoints)', true);
    } else {
      logResult(
        'API Documentation (endpoints)',
        false,
        'No endpoints documented'
      );
    }

    return allFieldsPresent;
  } catch (error) {
    logResult(
      'API Documentation',
      false,
      `Could not access API info: ${error.message}`
    );
    return false;
  }
}

/**
 * Test 4: Performance Thresholds
 */
async function testPerformanceThresholds() {
  console.log('\n🔍 Testing Performance Thresholds');
  console.log('='.repeat(50));

  const endpoints = ['/api/health', '/api/monitoring/status'];

  const performanceThresholds = {
    maxResponseTime: 1000, // 1 second
    maxResponseSize: 100000, // 100KB
  };

  for (const endpoint of endpoints) {
    const start = performance.now();

    try {
      const response = await axios.get(`${QA_CONFIG.baseURL}${endpoint}`);
      const end = performance.now();
      const responseTime = end - start;

      // Check response time
      if (responseTime <= performanceThresholds.maxResponseTime) {
        logResult(`Performance (${endpoint} - response time)`, true);
      } else {
        logResult(
          `Performance (${endpoint} - response time)`,
          false,
          `Response time ${responseTime.toFixed(2)}ms exceeds threshold ${performanceThresholds.maxResponseTime}ms`
        );
      }

      // Check response size
      const responseSize = JSON.stringify(response.data).length;
      if (responseSize <= performanceThresholds.maxResponseSize) {
        logResult(`Performance (${endpoint} - response size)`, true);
      } else {
        logResult(
          `Performance (${endpoint} - response size)`,
          false,
          `Response size ${responseSize} bytes exceeds threshold ${performanceThresholds.maxResponseSize} bytes`
        );
      }
    } catch (error) {
      logResult(
        `Performance (${endpoint})`,
        false,
        `Request failed: ${error.message}`
      );
    }
  }

  return true;
}

/**
 * Test 5: Data Validation
 */
async function testDataValidation() {
  console.log('\n🔍 Testing Data Validation');
  console.log('='.repeat(50));

  const validationTests = [
    {
      name: 'Email Format Validation',
      endpoint: '/api/auth/register',
      data: {
        name: 'Test User',
        email: 'invalid-email-format',
        password: 'testpassword123',
      },
      expectedStatus: 400,
    },
    {
      name: 'Password Strength Validation',
      endpoint: '/api/auth/register',
      data: {
        name: 'Test User',
        email: 'test@example.com',
        password: '123', // Too weak
      },
      expectedStatus: 400,
    },
    {
      name: 'Required Fields Validation',
      endpoint: '/api/auth/login',
      data: {
        email: 'test@example.com',
        // Missing password
      },
      expectedStatus: 400,
    },
  ];

  for (const test of validationTests) {
    try {
      const response = await axios.post(
        `${QA_CONFIG.baseURL}${test.endpoint}`,
        test.data
      );

      if (response.status === test.expectedStatus) {
        logResult(`Data Validation (${test.name})`, true);
      } else {
        logResult(
          `Data Validation (${test.name})`,
          false,
          `Expected ${test.expectedStatus}, got ${response.status}`
        );
      }
    } catch (error) {
      if (error.response && error.response.status === test.expectedStatus) {
        logResult(`Data Validation (${test.name})`, true);
      } else {
        logResult(
          `Data Validation (${test.name})`,
          false,
          `Expected ${test.expectedStatus}, got ${error.response?.status || 'network error'}`
        );
      }
    }
  }

  return true;
}

/**
 * Test 6: Business Logic Validation
 */
async function testBusinessLogic() {
  console.log('\n🔍 Testing Business Logic Validation');
  console.log('='.repeat(50));

  // Test reservation business rules
  const businessLogicTests = [
    {
      name: 'Reservation Time Validation',
      endpoint: '/api/reservations',
      data: {
        tableId: 1,
        date: '2023-01-01',
        time: '23:00', // Outside business hours
        guests: 4,
      },
      expectedStatus: 400,
    },
    {
      name: 'Reservation Date Validation',
      endpoint: '/api/reservations',
      data: {
        tableId: 1,
        date: '2020-01-01', // Past date
        time: '19:00',
        guests: 4,
      },
      expectedStatus: 400,
    },
    {
      name: 'Guest Count Validation',
      endpoint: '/api/reservations',
      data: {
        tableId: 1,
        date: '2024-12-31',
        time: '19:00',
        guests: 20, // Too many guests
      },
      expectedStatus: 400,
    },
  ];

  for (const test of businessLogicTests) {
    try {
      const response = await axios.post(
        `${QA_CONFIG.baseURL}${test.endpoint}`,
        test.data
      );

      if (response.status === test.expectedStatus) {
        logResult(`Business Logic (${test.name})`, true);
      } else {
        logResult(
          `Business Logic (${test.name})`,
          false,
          `Expected ${test.expectedStatus}, got ${response.status}`
        );
      }
    } catch (error) {
      if (error.response && error.response.status === test.expectedStatus) {
        logResult(`Business Logic (${test.name})`, true);
      } else {
        logResult(
          `Business Logic (${test.name})`,
          false,
          `Expected ${test.expectedStatus}, got ${error.response?.status || 'network error'}`
        );
      }
    }
  }

  return true;
}

/**
 * Test 7: Accessibility Compliance
 */
async function testAccessibility() {
  console.log('\n🔍 Testing Accessibility Compliance');
  console.log('='.repeat(50));

  // Test if API provides accessibility information
  try {
    const response = await axios.get(`${QA_CONFIG.baseURL}/api/health`);
    const data = response.data;

    // Check if error messages are descriptive
    if (data.error && data.message && data.message.length > 10) {
      logResult('Accessibility (Error Messages)', true);
    } else {
      logResult(
        'Accessibility (Error Messages)',
        false,
        'Error messages not descriptive enough'
      );
    }

    // Check if API provides clear status information
    if (data.status && typeof data.status === 'string') {
      logResult('Accessibility (Status Information)', true);
    } else {
      logResult(
        'Accessibility (Status Information)',
        false,
        'Status information not clear'
      );
    }

    return true;
  } catch (error) {
    logResult(
      'Accessibility',
      false,
      `Could not test accessibility: ${error.message}`
    );
    return false;
  }
}

/**
 * Test 8: Internationalization Support
 */
async function testInternationalization() {
  console.log('\n🔍 Testing Internationalization Support');
  console.log('='.repeat(50));

  // Test if API supports different languages
  try {
    const response = await axios.get(`${QA_CONFIG.baseURL}/api/health`, {
      headers: {
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });

    // Check if API responds appropriately to language headers
    if (response.status === 200) {
      logResult('Internationalization (Language Headers)', true);
    } else {
      logResult(
        'Internationalization (Language Headers)',
        false,
        'API does not handle language headers properly'
      );
    }

    return true;
  } catch (error) {
    logResult(
      'Internationalization',
      false,
      `Could not test internationalization: ${error.message}`
    );
    return false;
  }
}

/**
 * Test 9: API Versioning
 */
async function testAPIVersioning() {
  console.log('\n🔍 Testing API Versioning');
  console.log('='.repeat(50));

  try {
    const response = await axios.get(`${QA_CONFIG.baseURL}/api`);
    const apiInfo = response.data;

    // Check if API version is specified
    if (apiInfo.version && typeof apiInfo.version === 'string') {
      logResult('API Versioning (Version Specified)', true);
    } else {
      logResult(
        'API Versioning (Version Specified)',
        false,
        'API version not specified'
      );
    }

    // Check if version follows semantic versioning
    if (apiInfo.version && /^\d+\.\d+\.\d+$/.test(apiInfo.version)) {
      logResult('API Versioning (Semantic Versioning)', true);
    } else {
      logResult(
        'API Versioning (Semantic Versioning)',
        false,
        'Version does not follow semantic versioning'
      );
    }

    return true;
  } catch (error) {
    logResult(
      'API Versioning',
      false,
      `Could not test API versioning: ${error.message}`
    );
    return false;
  }
}

/**
 * Test 10: Monitoring and Observability
 */
async function testMonitoring() {
  console.log('\n🔍 Testing Monitoring and Observability');
  console.log('='.repeat(50));

  try {
    const response = await axios.get(
      `${QA_CONFIG.baseURL}/api/monitoring/status`
    );
    const monitoringData = response.data;

    // Check if monitoring endpoint provides comprehensive data
    const requiredMonitoringFields = [
      'status',
      'timestamp',
      'system',
      'database',
      'websocket',
    ];
    let allFieldsPresent = true;

    for (const field of requiredMonitoringFields) {
      if (monitoringData[field]) {
        logResult(`Monitoring (${field})`, true);
      } else {
        logResult(
          `Monitoring (${field})`,
          false,
          `Missing monitoring field: ${field}`
        );
        allFieldsPresent = false;
      }
    }

    // Check if system metrics are provided
    if (monitoringData.system && monitoringData.system.uptime) {
      logResult('Monitoring (System Metrics)', true);
    } else {
      logResult(
        'Monitoring (System Metrics)',
        false,
        'System metrics not provided'
      );
    }

    return allFieldsPresent;
  } catch (error) {
    logResult(
      'Monitoring',
      false,
      `Could not test monitoring: ${error.message}`
    );
    return false;
  }
}

/**
 * Run all QA tests
 */
async function runQATests() {
  console.log('🎯 Starting Quality Assurance Testing');
  console.log('='.repeat(50));
  console.log(`Base URL: ${QA_CONFIG.baseURL}`);
  console.log(`Timeout: ${QA_CONFIG.timeout}ms`);

  qaResults.startTime = Date.now();

  const tests = [
    testErrorHandling,
    testResponseFormat,
    testAPIDocumentation,
    testPerformanceThresholds,
    testDataValidation,
    testBusinessLogic,
    testAccessibility,
    testInternationalization,
    testAPIVersioning,
    testMonitoring,
  ];

  for (const test of tests) {
    try {
      await test();
    } catch (error) {
      console.error(`❌ Test failed with error: ${error.message}`);
    }
  }

  qaResults.endTime = Date.now();

  // Generate QA report
  generateQAReport();
}

/**
 * Generate QA report
 */
function generateQAReport() {
  console.log('\n📊 Quality Assurance Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${qaResults.totalTests}`);
  console.log(`Passed: ${qaResults.passedTests}`);
  console.log(`Failed: ${qaResults.failedTests}`);
  console.log(
    `Success Rate: ${((qaResults.passedTests / qaResults.totalTests) * 100).toFixed(2)}%`
  );
  console.log(
    `Total Time: ${(qaResults.endTime - qaResults.startTime) / 1000}s`
  );

  if (qaResults.issues.length > 0) {
    console.log('\n🚨 Issues Found:');
    console.log('='.repeat(50));
    qaResults.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.testName}: ${issue.details}`);
    });
  }

  console.log('\n💡 Quality Assurance Recommendations');
  console.log('='.repeat(50));

  if (qaResults.failedTests > 0) {
    console.log('⚠️  Quality issues detected. Consider:');
    console.log('   - Improving error handling and validation');
    console.log('   - Enhancing API documentation');
    console.log('   - Optimizing performance');
    console.log('   - Adding accessibility features');
    console.log('   - Implementing internationalization');
  } else {
    console.log('✅ No quality issues detected!');
    console.log('   - Continue monitoring for regressions');
    console.log('   - Regular QA testing recommended');
    console.log('   - User feedback collection encouraged');
  }
}

// Main execution
async function main() {
  try {
    // Check if server is running
    try {
      await axios.get(`${QA_CONFIG.baseURL}/api/health`, { timeout: 2000 });
      console.log('✅ Server is running and accessible');
    } catch (error) {
      console.error(
        '❌ Server is not accessible. Please start the server first.'
      );
      process.exit(1);
    }

    // Run QA tests
    await runQATests();

    console.log('\n🎉 Quality assurance testing completed!');
  } catch (error) {
    console.error('❌ QA test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runQATests,
  testErrorHandling,
  testResponseFormat,
  testAPIDocumentation,
  testPerformanceThresholds,
  testDataValidation,
  testBusinessLogic,
  testAccessibility,
  testInternationalization,
  testAPIVersioning,
  testMonitoring,
  generateQAReport,
};
