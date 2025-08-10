/**
 * Comprehensive error handling middleware
 */

// Custom error classes for business logic
class BusinessError extends Error {
  constructor(message, code, statusCode = 400, details = null) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class ValidationError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.statusCode = 400;
    this.details = details;
  }
}

class AuthenticationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.statusCode = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.statusCode = 403;
  }
}

class ResourceNotFoundError extends Error {
  constructor(message, resource) {
    super(message);
    this.name = 'ResourceNotFoundError';
    this.code = 'RESOURCE_NOT_FOUND';
    this.statusCode = 404;
    this.resource = resource;
  }
}

class ConflictError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'ConflictError';
    this.code = code;
    this.statusCode = 409;
    this.details = details;
  }
}

// Error codes mapping
const ERROR_CODES = {
  // Business Logic Errors
  RESERVATION_CONFLICT: 'RESERVATION_CONFLICT',
  CAPACITY_EXCEEDED: 'CAPACITY_EXCEEDED',
  BUSINESS_HOURS_VIOLATION: 'BUSINESS_HOURS_VIOLATION',
  ADVANCE_BOOKING_LIMIT: 'ADVANCE_BOOKING_LIMIT',
  USER_RESERVATION_LIMIT: 'USER_RESERVATION_LIMIT',
  TABLE_NOT_AVAILABLE: 'TABLE_NOT_AVAILABLE',
  
  // Validation Errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  
  // Authentication/Authorization Errors
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  
  // Database Errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  
  // External Service Errors
  SUPABASE_ERROR: 'SUPABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  
  // System Errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

/**
 * Centralized error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Log error for debugging
  console.error('Error occurred:', {
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
  });

  // Handle custom business errors
  if (err instanceof BusinessError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
      timestamp: new Date().toISOString(),
    });
  }

  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
      timestamp: new Date().toISOString(),
    });
  }

  if (err instanceof AuthenticationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
  }

  if (err instanceof AuthorizationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
  }

  if (err instanceof ResourceNotFoundError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      resource: err.resource,
      timestamp: new Date().toISOString(),
    });
  }

  if (err instanceof ConflictError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle Supabase errors
  if (err.code && err.code.startsWith('PGRST')) {
    return handleSupabaseError(err, res);
  }

  // Handle validation errors from express-validator
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON format',
      code: 'INVALID_JSON',
      timestamp: new Date().toISOString(),
    });
  }

  // Handle rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: err.headers?.['retry-after'],
      timestamp: new Date().toISOString(),
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
      timestamp: new Date().toISOString(),
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
      timestamp: new Date().toISOString(),
    });
  }

  // Handle database constraint violations
  if (err.code === '23505') { // Unique violation
    return res.status(409).json({
      error: 'Resource already exists',
      code: 'DUPLICATE_ENTRY',
      details: err.detail,
      timestamp: new Date().toISOString(),
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      error: 'Referenced resource does not exist',
      code: 'FOREIGN_KEY_VIOLATION',
      details: err.detail,
      timestamp: new Date().toISOString(),
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  return res.status(statusCode).json({
    error: message,
    code: 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle Supabase-specific errors
 */
function handleSupabaseError(err, res) {
  const errorMap = {
    'PGRST116': {
      status: 404,
      message: 'Resource not found',
      code: 'RESOURCE_NOT_FOUND',
    },
    'PGRST301': {
      status: 400,
      message: 'Invalid request',
      code: 'INVALID_REQUEST',
    },
    'PGRST302': {
      status: 400,
      message: 'Invalid request format',
      code: 'INVALID_FORMAT',
    },
    'PGRST303': {
      status: 400,
      message: 'Invalid request parameters',
      code: 'INVALID_PARAMETERS',
    },
    'PGRST304': {
      status: 400,
      message: 'Invalid request body',
      code: 'INVALID_BODY',
    },
    'PGRST305': {
      status: 400,
      message: 'Invalid request headers',
      code: 'INVALID_HEADERS',
    },
    'PGRST306': {
      status: 400,
      message: 'Invalid request method',
      code: 'INVALID_METHOD',
    },
    'PGRST307': {
      status: 400,
      message: 'Invalid request URL',
      code: 'INVALID_URL',
    },
    'PGRST308': {
      status: 400,
      message: 'Invalid request query',
      code: 'INVALID_QUERY',
    },
    'PGRST309': {
      status: 400,
      message: 'Invalid request path',
      code: 'INVALID_PATH',
    },
    'PGRST310': {
      status: 400,
      message: 'Invalid request content type',
      code: 'INVALID_CONTENT_TYPE',
    },
    'PGRST311': {
      status: 400,
      message: 'Invalid request accept',
      code: 'INVALID_ACCEPT',
    },
    'PGRST312': {
      status: 400,
      message: 'Invalid request authorization',
      code: 'INVALID_AUTHORIZATION',
    },
    'PGRST313': {
      status: 400,
      message: 'Invalid request range',
      code: 'INVALID_RANGE',
    },
    'PGRST314': {
      status: 400,
      message: 'Invalid request if-match',
      code: 'INVALID_IF_MATCH',
    },
    'PGRST315': {
      status: 400,
      message: 'Invalid request if-none-match',
      code: 'INVALID_IF_NONE_MATCH',
    },
    'PGRST316': {
      status: 400,
      message: 'Invalid request if-modified-since',
      code: 'INVALID_IF_MODIFIED_SINCE',
    },
    'PGRST317': {
      status: 400,
      message: 'Invalid request if-unmodified-since',
      code: 'INVALID_IF_UNMODIFIED_SINCE',
    },
    'PGRST318': {
      status: 400,
      message: 'Invalid request prefer',
      code: 'INVALID_PREFER',
    },
    'PGRST319': {
      status: 400,
      message: 'Invalid request content-encoding',
      code: 'INVALID_CONTENT_ENCODING',
    },
    'PGRST320': {
      status: 400,
      message: 'Invalid request content-length',
      code: 'INVALID_CONTENT_LENGTH',
    },
    'PGRST321': {
      status: 400,
      message: 'Invalid request content-md5',
      code: 'INVALID_CONTENT_MD5',
    },
    'PGRST322': {
      status: 400,
      message: 'Invalid request content-type',
      code: 'INVALID_CONTENT_TYPE',
    },
    'PGRST323': {
      status: 400,
      message: 'Invalid request expect',
      code: 'INVALID_EXPECT',
    },
    'PGRST324': {
      status: 400,
      message: 'Invalid request from',
      code: 'INVALID_FROM',
    },
    'PGRST325': {
      status: 400,
      message: 'Invalid request host',
      code: 'INVALID_HOST',
    },
    'PGRST326': {
      status: 400,
      message: 'Invalid request if-range',
      code: 'INVALID_IF_RANGE',
    },
    'PGRST327': {
      status: 400,
      message: 'Invalid request max-forwards',
      code: 'INVALID_MAX_FORWARDS',
    },
    'PGRST328': {
      status: 400,
      message: 'Invalid request proxy-authorization',
      code: 'INVALID_PROXY_AUTHORIZATION',
    },
    'PGRST329': {
      status: 400,
      message: 'Invalid request te',
      code: 'INVALID_TE',
    },
    'PGRST330': {
      status: 400,
      message: 'Invalid request trailer',
      code: 'INVALID_TRAILER',
    },
    'PGRST331': {
      status: 400,
      message: 'Invalid request transfer-encoding',
      code: 'INVALID_TRANSFER_ENCODING',
    },
    'PGRST332': {
      status: 400,
      message: 'Invalid request upgrade',
      code: 'INVALID_UPGRADE',
    },
    'PGRST333': {
      status: 400,
      message: 'Invalid request via',
      code: 'INVALID_VIA',
    },
    'PGRST334': {
      status: 400,
      message: 'Invalid request warning',
      code: 'INVALID_WARNING',
    },
  };

  const errorInfo = errorMap[err.code] || {
    status: 500,
    message: 'Database error',
    code: 'DATABASE_ERROR',
  };

  return res.status(errorInfo.status).json({
    error: errorInfo.message,
    code: errorInfo.code,
    details: err.details || err.message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async error wrapper for route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler for unmatched routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  BusinessError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ResourceNotFoundError,
  ConflictError,
  ERROR_CODES,
  errorHandler,
  asyncHandler,
  notFoundHandler,
}; 