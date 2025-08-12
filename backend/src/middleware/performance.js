const compression = require('compression');
const NodeCache = require('node-cache');

// Cache configuration
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 600, // Check for expired keys every 10 minutes
  useClones: false, // Better performance
  maxKeys: 1000, // Maximum number of keys
});

// Cache keys for different endpoints
const CACHE_KEYS = {
  TABLES: 'tables',
  TABLE_AVAILABILITY: 'table_availability',
  RESERVATIONS: 'reservations',
  USER_PROFILE: 'user_profile',
  ANALYTICS: 'analytics',
};

/**
 * Compression middleware configuration
 */
const compressionConfig = compression({
  level: 6, // Balanced compression level
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use compression for JSON responses
    return compression.filter(req, res);
  },
});

/**
 * Response caching middleware
 */
function responseCache(duration = 300) {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for authenticated requests (user-specific data)
    if (req.headers.authorization) {
      return next();
    }

    // Generate cache key
    const cacheKey = `${req.originalUrl}_${req.query ? JSON.stringify(req.query) : ''}`;

    // Check if response is cached
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      res.set('X-Cache', 'HIT');
      return res.json(cachedResponse);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function (data) {
      // Cache the response
      cache.set(cacheKey, data, duration);
      res.set('X-Cache', 'MISS');

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Database query caching middleware
 */
function queryCache(duration = 300) {
  return (req, res, next) => {
    // Skip for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip for authenticated requests
    if (req.headers.authorization) {
      return next();
    }

    const cacheKey = `query_${req.originalUrl}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      req.cachedData = cachedResult;
      req.cacheHit = true;
    }

    next();
  };
}

/**
 * Response optimization middleware
 */
function optimizeResponse(req, res, next) {
  // Set performance headers
  res.set({
    'X-Response-Time': '0ms',
    'X-Powered-By': 'Cafe Reservation API',
  });

  // Optimize JSON responses
  res.json = function (data) {
    // Remove unnecessary fields for better performance
    if (data && typeof data === 'object') {
      // Remove null/undefined values
      const cleanData = JSON.parse(
        JSON.stringify(data, (key, value) => {
          return value === null || value === undefined ? undefined : value;
        })
      );

      return res.send(JSON.stringify(cleanData));
    }

    return res.send(JSON.stringify(data));
  };

  next();
}

/**
 * Request optimization middleware
 */
function optimizeRequest(req, res, next) {
  // Limit request body size for better performance
  if (req.body && Object.keys(req.body).length > 50) {
    return res.status(413).json({
      error: 'Request too large',
      message: 'Request body contains too many fields',
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === 'string' && req.query[key].length > 1000) {
        req.query[key] = req.query[key].substring(0, 1000);
      }
    });
  }

  next();
}

/**
 * Memory optimization middleware
 */
function memoryOptimization(req, res, next) {
  // Clean up request object after processing
  res.on('finish', () => {
    // Clear large objects from request
    if (req.body && req.body.length > 10000) {
      req.body = null;
    }

    // Clear query string if too long
    if (req.url && req.url.length > 2000) {
      req.url = req.url.substring(0, 2000);
    }
  });

  next();
}

/**
 * Cache invalidation middleware
 */
function invalidateCache(patterns = []) {
  return (req, res, next) => {
    // Invalidate cache after successful operations
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach((pattern) => {
          const keys = cache.keys();
          keys.forEach((key) => {
            if (key.includes(pattern)) {
              cache.del(key);
            }
          });
        });
      }
    });

    next();
  };
}

/**
 * Performance monitoring middleware
 */
function performanceTracking(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds

    // Track slow requests
    if (duration > 1000) {
      console.warn(
        `🐌 Slow request: ${req.method} ${req.path} took ${duration.toFixed(2)}ms`
      );
    }

    // Set response time header only if headers haven't been sent
    if (!res.headersSent) {
      res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    }
  });

  next();
}

/**
 * Database connection pooling optimization
 */
function optimizeDatabaseQueries(req, res, next) {
  // Add query timeout
  req.queryTimeout = 5000; // 5 seconds

  // Add query optimization hints
  req.queryOptimization = {
    useIndex: true,
    limitResults: 100,
    selectOnly: true,
  };

  next();
}

/**
 * Static asset optimization
 */
function optimizeStaticAssets(req, res, next) {
  // Set cache headers for static assets
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    res.set({
      'Cache-Control': 'public, max-age=31536000', // 1 year
      Expires: new Date(Date.now() + 31536000000).toUTCString(),
    });
  }

  next();
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    keyspace: cache.keys(),
  };
}

/**
 * Clear cache
 */
function clearCache(pattern = null) {
  if (pattern) {
    const keys = cache.keys();
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        cache.del(key);
      }
    });
  } else {
    cache.flushAll();
  }
}

module.exports = {
  compressionConfig,
  responseCache,
  queryCache,
  optimizeResponse,
  optimizeRequest,
  memoryOptimization,
  invalidateCache,
  performanceTracking,
  optimizeDatabaseQueries,
  optimizeStaticAssets,
  getCacheStats,
  clearCache,
  CACHE_KEYS,
};
