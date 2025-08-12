const { supabase } = require('../config/supabase');
const { verifyToken: verifyJWTToken } = require('./security');
const { isTokenBlacklisted } = require('./tokenBlacklist');

/**
 * Enhanced JWT token verification middleware
 * Validates tokens and attaches user/profile data to request
 */
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        error: 'Missing authentication token',
        code: 'MISSING_TOKEN',
      });
    }

    // Check if token is blacklisted
    if (isTokenBlacklisted(token)) {
      return res.status(401).json({
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED',
      });
    }

    // First verify JWT token
    const jwtPayload = verifyJWTToken(token);
    if (!jwtPayload) {
      return res.status(401).json({
        error: 'Invalid or expired JWT token',
        code: 'INVALID_JWT',
      });
    }

    // Then verify with Supabase for additional security
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: error?.message || 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }

    // Get user profile with role information
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, name, role, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return res.status(401).json({
        error: 'User profile not found',
        code: 'PROFILE_NOT_FOUND',
      });
    }

    // Attach user and profile data to request
    req.user = user;
    req.profile = profile;

    // Add user info to request for logging
    req.userInfo = {
      id: user.id,
      email: profile.email,
      role: profile.role,
      name: profile.name,
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(500).json({
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR',
    });
  }
}

/**
 * Role-based access control middleware
 * Requires specific role(s) to access the endpoint
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
    }

    const userRole = req.profile.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${userRole}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRole: userRole,
      });
    }

    next();
  };
}

/**
 * Admin-only access middleware
 */
function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

/**
 * Staff or Admin access middleware
 */
function requireStaffOrAdmin(req, res, next) {
  return requireRole(['staff', 'admin'])(req, res, next);
}

/**
 * Customer-only access middleware
 */
function requireCustomer(req, res, next) {
  return requireRole('customer')(req, res, next);
}

/**
 * Resource ownership middleware
 * Ensures user can only access their own resources
 */
function requireOwnership(resourceType, idField = 'id') {
  return async (req, res, next) => {
    try {
      if (!req.profile) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      const resourceId = req.params[idField] || req.body[idField];

      if (!resourceId) {
        return res.status(400).json({
          error: `Resource ${idField} is required`,
          code: 'MISSING_RESOURCE_ID',
        });
      }

      // Check resource ownership based on type
      let ownershipQuery;

      switch (resourceType) {
        case 'reservation':
          ownershipQuery = supabase
            .from('reservations')
            .select('id, user_id')
            .eq('id', resourceId)
            .single();
          break;
        case 'profile':
          // Users can only access their own profile
          if (resourceId !== req.profile.id) {
            return res.status(403).json({
              error: 'Access denied to other user profiles',
              code: 'PROFILE_ACCESS_DENIED',
            });
          }
          return next();
        default:
          return res.status(500).json({
            error: 'Invalid resource type for ownership check',
            code: 'INVALID_RESOURCE_TYPE',
          });
      }

      const { data: resource, error } = await ownershipQuery;

      if (error || !resource) {
        return res.status(404).json({
          error: `${resourceType} not found`,
          code: 'RESOURCE_NOT_FOUND',
        });
      }

      // Check if user owns the resource or is admin
      if (resource.user_id !== req.profile.id && req.profile.role !== 'admin') {
        return res.status(403).json({
          error: `Access denied to ${resourceType}`,
          code: 'RESOURCE_ACCESS_DENIED',
        });
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        error: 'Ownership verification error',
        code: 'OWNERSHIP_CHECK_ERROR',
      });
    }
  };
}

/**
 * Optional authentication middleware
 * Attaches user data if token is provided, but doesn't require it
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return next(); // Continue without authentication
    }

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return next(); // Continue without authentication
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, name, role, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (!profileError && profile) {
      req.user = user;
      req.profile = profile;
      req.userInfo = {
        id: user.id,
        email: profile.email,
        role: profile.role,
        name: profile.name,
      };
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next(); // Continue without authentication
  }
}

/**
 * Clear rate limit cache for a specific IP or all IPs
 */
function clearAuthRateLimit(clientIP = null) {
  if (!global.authAttempts) {
    global.authAttempts = new Map();
  }

  if (clientIP) {
    global.authAttempts.delete(clientIP);
    console.log(`🧹 Cleared rate limit cache for IP: ${clientIP}`);
  } else {
    global.authAttempts.clear();
    console.log('🧹 Cleared all rate limit cache');
  }
}

/**
 * Rate limiting middleware for authentication endpoints
 */
function authRateLimit(req, res, next) {
  // Simple in-memory rate limiting (in production, use Redis)
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 20; // Increased from 5 to 20 for development

  if (!global.authAttempts) {
    global.authAttempts = new Map();
  }

  const attempts = global.authAttempts.get(clientIP) || [];
  const recentAttempts = attempts.filter(
    (timestamp) => now - timestamp < windowMs
  );

  if (recentAttempts.length >= maxAttempts) {
    return res.status(429).json({
      error: 'Too many authentication attempts. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((recentAttempts[0] + windowMs - now) / 1000),
    });
  }

  // Add current attempt
  recentAttempts.push(now);
  global.authAttempts.set(clientIP, recentAttempts);

  next();
}

/**
 * Logging middleware for authentication events
 */
function logAuthEvent(eventType) {
  return (req, res, next) => {
    const userInfo = req.userInfo || {
      id: 'anonymous',
      email: 'anonymous',
      role: 'anonymous',
    };

    console.log(`🔐 Auth Event [${eventType}]:`, {
      timestamp: new Date().toISOString(),
      event: eventType,
      userId: userInfo.id,
      userEmail: userInfo.email,
      userRole: userInfo.role,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      method: req.method,
      path: req.path,
    });

    next();
  };
}

/**
 * Session validation middleware
 * Checks if user session is still valid
 */
async function validateSession(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    }

    // Check if user account is still active
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(401).json({
        error: 'User account not found or inactive',
        code: 'USER_INACTIVE',
      });
    }

    next();
  } catch (error) {
    console.error('Session validation error:', error);
    return res.status(500).json({
      error: 'Session validation error',
      code: 'SESSION_VALIDATION_ERROR',
    });
  }
}

module.exports = {
  verifyToken,
  requireRole,
  requireAdmin,
  requireStaffOrAdmin,
  requireCustomer,
  requireOwnership,
  optionalAuth,
  authRateLimit,
  logAuthEvent,
  validateSession,
  clearAuthRateLimit,
};
