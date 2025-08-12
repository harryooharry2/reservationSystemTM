const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const securityConfig = require('../config/security');

// Rate limiting configurations
const authLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: securityConfig.rateLimit.auth.max,
  message: {
    error: securityConfig.rateLimit.auth.message,
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: securityConfig.rateLimit.auth.message,
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

const reservationLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: securityConfig.rateLimit.reservations.max,
  message: {
    error: securityConfig.rateLimit.reservations.message,
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: securityConfig.rateLimit.general.max,
  message: {
    error: securityConfig.rateLimit.general.message,
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helmet configuration for security headers
const helmetConfig = helmet({
  contentSecurityPolicy: securityConfig.headers.contentSecurityPolicy,
  hsts: securityConfig.headers.hsts,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// JWT token management
const JWT_SECRET = securityConfig.jwt.secret;
const JWT_REFRESH_SECRET = securityConfig.jwt.refreshSecret;

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: securityConfig.jwt.accessTokenExpiry }
  );

  const refreshToken = jwt.sign(
    {
      userId: user.id,
      type: 'refresh',
    },
    JWT_REFRESH_SECRET,
    { expiresIn: securityConfig.jwt.refreshTokenExpiry }
  );

  return { accessToken, refreshToken };
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

// Password hashing utilities
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Input validation schemas
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

const signupValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: securityConfig.password.minLength })
    .withMessage(
      `Password must be at least ${securityConfig.password.minLength} characters long`
    )
    .matches(securityConfig.password.pattern)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
];

const reservationValidation = [
  body('table_id')
    .isInt({ min: 1 })
    .withMessage('Table ID must be a positive integer'),
  body('reservation_date')
    .isISO8601()
    .withMessage('Reservation date must be a valid ISO 8601 date'),
  body('reservation_time')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Reservation time must be in HH:MM format'),
  body('customer_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Customer name must be between 2 and 100 characters'),
  body('customer_email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('party_size')
    .isInt({ min: 1, max: 20 })
    .withMessage('Party size must be between 1 and 20 people'),
];

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

// Security logging
const securityLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'anonymous',
    };

    // Log security events
    if (res.statusCode === 401 || res.statusCode === 403) {
      console.log('🔒 Security Event [AUTH_FAILURE]:', logData);
    } else if (res.statusCode === 429) {
      console.log('🚫 Security Event [RATE_LIMIT]:', logData);
    } else if (res.statusCode >= 400) {
      console.log('⚠️ Security Event [CLIENT_ERROR]:', logData);
    }
  });

  next();
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = securityConfig.cors.origin;

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: securityConfig.cors.credentials,
  methods: securityConfig.cors.methods,
  allowedHeaders: securityConfig.cors.allowedHeaders,
  optionsSuccessStatus: 200,
};

module.exports = {
  authLimiter,
  reservationLimiter,
  generalLimiter,
  helmetConfig,
  generateTokens,
  verifyToken,
  verifyRefreshToken,
  hashPassword,
  comparePassword,
  loginValidation,
  signupValidation,
  reservationValidation,
  handleValidationErrors,
  securityLogger,
  corsOptions,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
};
