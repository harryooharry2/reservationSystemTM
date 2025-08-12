const axios = require('axios');
const crypto = require('crypto');

// Security test configuration
const SECURITY_CONFIG = {
  baseURL: 'http://localhost:3000',
  timeout: 5000,
  testUser: {
    email: 'test@example.com',
    password: 'testpassword',
  },
  adminUser: {
    email: 'admin@example.com',
    password: 'adminpassword',
  },
};

// Security test results
const securityResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  vulnerabilities: [],
  startTime: null,
  endTime: null,
};

/**
 * Log security test result
 */
function logResult(testName, passed, details = '') {
  securityResults.totalTests++;
  if (passed) {
    securityResults.passedTests++;
    console.log(`✅ ${testName}: PASSED`);
  } else {
    securityResults.failedTests++;
    securityResults.vulnerabilities.push({ testName, details });
    console.log(`❌ ${testName}: FAILED - ${details}`);
  }
}

/**
 * Test 1: SQL Injection Prevention
 */
async function testSQLInjection() {
  console.log('\n🔍 Testing SQL Injection Prevention');
  console.log('='.repeat(50));

  const sqlInjectionPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
    "admin'--",
    "1' OR '1' = '1' --",
  ];

  for (const payload of sqlInjectionPayloads) {
    try {
      const response = await axios.post(
        `${SECURITY_CONFIG.baseURL}/api/auth/login`,
        {
          email: payload,
          password: payload,
        }
      );

      // If we get a successful response with SQL injection payload, it's a vulnerability
      if (response.status === 200 && response.data.token) {
        logResult(
          `SQL Injection (${payload})`,
          false,
          'Authentication bypassed with SQL injection'
        );
        return false;
      }
    } catch (error) {
      // Expected behavior - should reject SQL injection attempts
      if (error.response && error.response.status === 400) {
        logResult(`SQL Injection (${payload})`, true);
      } else {
        logResult(
          `SQL Injection (${payload})`,
          false,
          `Unexpected response: ${error.response?.status}`
        );
      }
    }
  }

  return true;
}

/**
 * Test 2: XSS Prevention
 */
async function testXSS() {
  console.log('\n🔍 Testing XSS Prevention');
  console.log('='.repeat(50));

  const xssPayloads = [
    '<script>alert("XSS")</script>',
    'javascript:alert("XSS")',
    '<img src="x" onerror="alert(\'XSS\')">',
    '"><script>alert("XSS")</script>',
    '&#60;script&#62;alert("XSS")&#60;/script&#62;',
  ];

  for (const payload of xssPayloads) {
    try {
      const response = await axios.post(
        `${SECURITY_CONFIG.baseURL}/api/auth/register`,
        {
          name: payload,
          email: `test${Date.now()}@example.com`,
          password: 'testpassword123',
        }
      );

      // Check if XSS payload is reflected in response
      const responseText = JSON.stringify(response.data);
      if (
        responseText.includes(payload) &&
        !responseText.includes('&lt;') &&
        !responseText.includes('&gt;')
      ) {
        logResult(
          `XSS (${payload})`,
          false,
          'XSS payload reflected without sanitization'
        );
        return false;
      }
    } catch (error) {
      // Expected behavior - should reject or sanitize XSS attempts
      if (error.response && error.response.status === 400) {
        logResult(`XSS (${payload})`, true);
      } else {
        logResult(
          `XSS (${payload})`,
          false,
          `Unexpected response: ${error.response?.status}`
        );
      }
    }
  }

  return true;
}

/**
 * Test 3: Authentication Bypass
 */
async function testAuthenticationBypass() {
  console.log('\n🔍 Testing Authentication Bypass');
  console.log('='.repeat(50));

  // Test accessing protected endpoints without authentication
  const protectedEndpoints = [
    '/api/admin/dashboard',
    '/api/users/profile',
    '/api/reservations',
    '/api/tables',
  ];

  for (const endpoint of protectedEndpoints) {
    try {
      const response = await axios.get(`${SECURITY_CONFIG.baseURL}${endpoint}`);

      // If we can access protected endpoint without auth, it's a vulnerability
      if (response.status === 200) {
        logResult(
          `Auth Bypass (${endpoint})`,
          false,
          'Protected endpoint accessible without authentication'
        );
        return false;
      }
    } catch (error) {
      // Expected behavior - should require authentication
      if (
        error.response &&
        (error.response.status === 401 || error.response.status === 403)
      ) {
        logResult(`Auth Bypass (${endpoint})`, true);
      } else {
        logResult(
          `Auth Bypass (${endpoint})`,
          false,
          `Unexpected response: ${error.response?.status}`
        );
      }
    }
  }

  return true;
}

/**
 * Test 4: Authorization Testing
 */
async function testAuthorization() {
  console.log('\n🔍 Testing Authorization');
  console.log('='.repeat(50));

  // First, login as regular user
  let userToken;
  try {
    const loginResponse = await axios.post(
      `${SECURITY_CONFIG.baseURL}/api/auth/login`,
      {
        email: SECURITY_CONFIG.testUser.email,
        password: SECURITY_CONFIG.testUser.password,
      }
    );
    userToken = loginResponse.data.token;
  } catch (error) {
    logResult(
      'Authorization Test Setup',
      false,
      'Could not login as test user'
    );
    return false;
  }

  // Test accessing admin endpoints with regular user token
  const adminEndpoints = [
    '/api/admin/dashboard',
    '/api/admin/users',
    '/api/admin/analytics',
  ];

  for (const endpoint of adminEndpoints) {
    try {
      const response = await axios.get(
        `${SECURITY_CONFIG.baseURL}${endpoint}`,
        {
          headers: { Authorization: `Bearer ${userToken}` },
        }
      );

      // If regular user can access admin endpoints, it's a vulnerability
      if (response.status === 200) {
        logResult(
          `Authorization (${endpoint})`,
          false,
          'Regular user can access admin endpoint'
        );
        return false;
      }
    } catch (error) {
      // Expected behavior - should deny access
      if (error.response && error.response.status === 403) {
        logResult(`Authorization (${endpoint})`, true);
      } else {
        logResult(
          `Authorization (${endpoint})`,
          false,
          `Unexpected response: ${error.response?.status}`
        );
      }
    }
  }

  return true;
}

/**
 * Test 5: Input Validation
 */
async function testInputValidation() {
  console.log('\n🔍 Testing Input Validation');
  console.log('='.repeat(50));

  const invalidInputs = [
    { email: 'invalid-email', password: 'testpassword' },
    { email: 'test@example.com', password: '123' }, // Too short
    { email: 'a'.repeat(1000) + '@example.com', password: 'testpassword' }, // Too long
    { email: 'test@example.com', password: 'a'.repeat(1000) }, // Too long
  ];

  for (const input of invalidInputs) {
    try {
      const response = await axios.post(
        `${SECURITY_CONFIG.baseURL}/api/auth/register`,
        input
      );

      // If invalid input is accepted, it's a vulnerability
      if (response.status === 201) {
        logResult(
          `Input Validation (${JSON.stringify(input)})`,
          false,
          'Invalid input accepted'
        );
        return false;
      }
    } catch (error) {
      // Expected behavior - should reject invalid input
      if (error.response && error.response.status === 400) {
        logResult(`Input Validation (${JSON.stringify(input)})`, true);
      } else {
        logResult(
          `Input Validation (${JSON.stringify(input)})`,
          false,
          `Unexpected response: ${error.response?.status}`
        );
      }
    }
  }

  return true;
}

/**
 * Test 6: Rate Limiting
 */
async function testRateLimiting() {
  console.log('\n🔍 Testing Rate Limiting');
  console.log('='.repeat(50));

  const requests = [];

  // Make multiple rapid requests
  for (let i = 0; i < 20; i++) {
    requests.push(
      axios
        .post(`${SECURITY_CONFIG.baseURL}/api/auth/login`, {
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .catch((error) => error.response)
    );
  }

  const responses = await Promise.all(requests);
  const rateLimited = responses.filter((r) => r && r.status === 429);

  if (rateLimited.length > 0) {
    logResult(
      'Rate Limiting',
      true,
      `${rateLimited.length} requests were rate limited`
    );
  } else {
    logResult('Rate Limiting', false, 'No rate limiting detected');
    return false;
  }

  return true;
}

/**
 * Test 7: CSRF Protection
 */
async function testCSRFProtection() {
  console.log('\n🔍 Testing CSRF Protection');
  console.log('='.repeat(50));

  try {
    // Test if endpoints accept requests without proper CSRF tokens
    const response = await axios.post(
      `${SECURITY_CONFIG.baseURL}/api/auth/logout`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest', // Simulate AJAX request
        },
      }
    );

    // If logout succeeds without proper CSRF protection, it might be vulnerable
    if (response.status === 200) {
      logResult(
        'CSRF Protection',
        false,
        'Endpoint might be vulnerable to CSRF'
      );
      return false;
    }
  } catch (error) {
    // Expected behavior - should require proper CSRF protection
    if (error.response && error.response.status === 403) {
      logResult('CSRF Protection', true);
    } else {
      logResult(
        'CSRF Protection',
        false,
        `Unexpected response: ${error.response?.status}`
      );
    }
  }

  return true;
}

/**
 * Test 8: Security Headers
 */
async function testSecurityHeaders() {
  console.log('\n🔍 Testing Security Headers');
  console.log('='.repeat(50));

  try {
    const response = await axios.get(`${SECURITY_CONFIG.baseURL}/api/health`);
    const headers = response.headers;

    const requiredHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'strict-transport-security',
      'content-security-policy',
    ];

    let allHeadersPresent = true;

    for (const header of requiredHeaders) {
      if (headers[header]) {
        logResult(`Security Header (${header})`, true);
      } else {
        logResult(
          `Security Header (${header})`,
          false,
          'Missing security header'
        );
        allHeadersPresent = false;
      }
    }

    return allHeadersPresent;
  } catch (error) {
    logResult(
      'Security Headers',
      false,
      `Could not test headers: ${error.message}`
    );
    return false;
  }
}

/**
 * Test 9: JWT Token Security
 */
async function testJWTSecurity() {
  console.log('\n🔍 Testing JWT Token Security');
  console.log('='.repeat(50));

  try {
    // Login to get a token
    const loginResponse = await axios.post(
      `${SECURITY_CONFIG.baseURL}/api/auth/login`,
      {
        email: SECURITY_CONFIG.testUser.email,
        password: SECURITY_CONFIG.testUser.password,
      }
    );

    const token = loginResponse.data.token;

    if (!token) {
      logResult('JWT Token Generation', false, 'No token received');
      return false;
    }

    // Test token structure
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      logResult('JWT Token Structure', false, 'Invalid JWT structure');
      return false;
    }

    // Test with modified token
    const modifiedToken = tokenParts[0] + '.' + tokenParts[1] + '.modified';
    try {
      await axios.get(`${SECURITY_CONFIG.baseURL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${modifiedToken}` },
      });
      logResult('JWT Token Validation', false, 'Modified token was accepted');
      return false;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        logResult('JWT Token Validation', true);
      } else {
        logResult(
          'JWT Token Validation',
          false,
          `Unexpected response: ${error.response?.status}`
        );
      }
    }

    return true;
  } catch (error) {
    logResult('JWT Token Security', false, `Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 10: Data Exposure
 */
async function testDataExposure() {
  console.log('\n🔍 Testing Data Exposure');
  console.log('='.repeat(50));

  try {
    const response = await axios.get(`${SECURITY_CONFIG.baseURL}/api/health`);
    const data = response.data;

    // Check for sensitive data exposure
    const sensitiveFields = ['password', 'secret', 'key', 'token', 'private'];
    let sensitiveDataExposed = false;

    const checkObject = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (
          sensitiveFields.some((field) => key.toLowerCase().includes(field))
        ) {
          if (typeof value === 'string' && value.length > 0) {
            logResult(
              `Data Exposure (${currentPath})`,
              false,
              'Sensitive data exposed'
            );
            sensitiveDataExposed = true;
          }
        }

        if (typeof value === 'object' && value !== null) {
          checkObject(value, currentPath);
        }
      }
    };

    checkObject(data);

    if (!sensitiveDataExposed) {
      logResult('Data Exposure', true);
    }

    return !sensitiveDataExposed;
  } catch (error) {
    logResult('Data Exposure', false, `Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Run all security tests
 */
async function runSecurityTests() {
  console.log('🔒 Starting Security Testing');
  console.log('='.repeat(50));
  console.log(`Base URL: ${SECURITY_CONFIG.baseURL}`);
  console.log(`Timeout: ${SECURITY_CONFIG.timeout}ms`);

  securityResults.startTime = Date.now();

  const tests = [
    testSQLInjection,
    testXSS,
    testAuthenticationBypass,
    testAuthorization,
    testInputValidation,
    testRateLimiting,
    testCSRFProtection,
    testSecurityHeaders,
    testJWTSecurity,
    testDataExposure,
  ];

  for (const test of tests) {
    try {
      await test();
    } catch (error) {
      console.error(`❌ Test failed with error: ${error.message}`);
    }
  }

  securityResults.endTime = Date.now();

  // Generate security report
  generateSecurityReport();
}

/**
 * Generate security report
 */
function generateSecurityReport() {
  console.log('\n📊 Security Testing Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${securityResults.totalTests}`);
  console.log(`Passed: ${securityResults.passedTests}`);
  console.log(`Failed: ${securityResults.failedTests}`);
  console.log(
    `Success Rate: ${((securityResults.passedTests / securityResults.totalTests) * 100).toFixed(2)}%`
  );
  console.log(
    `Total Time: ${(securityResults.endTime - securityResults.startTime) / 1000}s`
  );

  if (securityResults.vulnerabilities.length > 0) {
    console.log('\n🚨 Vulnerabilities Found:');
    console.log('='.repeat(50));
    securityResults.vulnerabilities.forEach((vuln, index) => {
      console.log(`${index + 1}. ${vuln.testName}: ${vuln.details}`);
    });
  }

  console.log('\n💡 Security Recommendations');
  console.log('='.repeat(50));

  if (securityResults.failedTests > 0) {
    console.log('⚠️  Security vulnerabilities detected. Consider:');
    console.log('   - Implementing proper input validation');
    console.log('   - Adding security headers');
    console.log('   - Strengthening authentication/authorization');
    console.log('   - Implementing CSRF protection');
    console.log('   - Adding rate limiting');
  } else {
    console.log('✅ No security vulnerabilities detected!');
    console.log('   - Continue monitoring for new threats');
    console.log('   - Keep dependencies updated');
    console.log('   - Regular security audits recommended');
  }
}

// Main execution
async function main() {
  try {
    // Check if server is running
    try {
      await axios.get(`${SECURITY_CONFIG.baseURL}/api/health`, {
        timeout: 2000,
      });
      console.log('✅ Server is running and accessible');
    } catch (error) {
      console.error(
        '❌ Server is not accessible. Please start the server first.'
      );
      process.exit(1);
    }

    // Run security tests
    await runSecurityTests();

    console.log('\n🎉 Security testing completed!');
  } catch (error) {
    console.error('❌ Security test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runSecurityTests,
  testSQLInjection,
  testXSS,
  testAuthenticationBypass,
  testAuthorization,
  testInputValidation,
  testRateLimiting,
  testCSRFProtection,
  testSecurityHeaders,
  testJWTSecurity,
  testDataExposure,
  generateSecurityReport,
};
