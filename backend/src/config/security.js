// Security configuration
const securityConfig = {
  // JWT Configuration
  jwt: {
    secret:
      process.env.JWT_SECRET ||
      'your-super-secret-jwt-key-change-in-production-2024',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      'your-super-secret-refresh-key-change-in-production-2024',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    auth: {
      max: parseInt(process.env.RATE_LIMIT_MAX_AUTH) || 20, // Increased from 5 to 20 for development
      message: 'Too many authentication attempts, please try again later.',
    },
    reservations: {
      max: parseInt(process.env.RATE_LIMIT_MAX_RESERVATIONS) || 20,
      message: 'Too many reservation requests, please try again later.',
    },
    general: {
      max: parseInt(process.env.RATE_LIMIT_MAX_GENERAL) || 100,
      message: 'Too many requests, please try again later.',
    },
  },

  // Cookie Configuration
  cookies: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: {
      accessToken: 15 * 60 * 1000, // 15 minutes
      refreshToken: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },

  // Security Headers
  headers: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://ywqtxsmbegcgoxdtvgzo.supabase.co'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : [
          'http://localhost:4321',
          'http://localhost:4322',
          'http://localhost:4323',
        ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },

  // Security Monitoring
  monitoring: {
    enabled: process.env.SECURITY_LOG_ENABLED !== 'false',
    alertEnabled: process.env.SECURITY_ALERT_ENABLED !== 'false',
    logLevel: process.env.SECURITY_LOG_LEVEL || 'info',
    alertThresholds: {
      authFailures: 5,
      rateLimitViolations: 3,
      suspiciousPatterns: 2,
    },
    alertCooldown: 5 * 60 * 1000, // 5 minutes
  },

  // Password Requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  },

  // Input Validation
  validation: {
    maxStringLength: 1000,
    maxArrayLength: 100,
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
  },

  // Session Management
  session: {
    maxConcurrentSessions: 5,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    rememberMeDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};

module.exports = securityConfig;
