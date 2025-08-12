const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const cookieParser = require('cookie-parser');

// Import security middleware
const {
  helmetConfig,
  generalLimiter,
  authLimiter,
  reservationLimiter,
  securityLogger,
  corsOptions,
} = require('./middleware/security');

// Import security monitoring
const { securityMonitoring } = require('./middleware/securityMonitoring');

// Import performance monitoring
const {
  performanceMonitoring,
  startMonitoring,
} = require('./middleware/monitoring');

// Import performance optimizations
const {
  compressionConfig,
  responseCache,
  optimizeResponse,
  optimizeRequest,
  memoryOptimization,
  performanceTracking,
  optimizeDatabaseQueries,
  optimizeStaticAssets,
} = require('./middleware/performance');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const tablesRoutes = require('./routes/tables');
const reservationsRoutes = require('./routes/reservations');
const monitoringRoutes = require('./routes/monitoring');

// Import Socket.IO manager
const socketManager = require('./config/socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
socketManager.initialize(server);

// Enhanced security middleware
app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(cookieParser());

// Performance optimizations
app.use(compressionConfig);
app.use(optimizeResponse);
app.use(optimizeRequest);
app.use(memoryOptimization);
app.use(performanceTracking);
app.use(optimizeDatabaseQueries);
app.use(optimizeStaticAssets);

// Security logging and monitoring
app.use(securityLogger);
app.use(securityMonitoring);

// Performance monitoring
app.use(performanceMonitoring);

// Rate limiting - apply different limits to different endpoints
app.use('/api/auth', authLimiter); // Stricter for auth endpoints
app.use('/api/reservations', reservationLimiter); // Moderate for reservations
app.use('/api', generalLimiter); // General rate limiting for all other API routes

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`
  );
  next();
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Detailed health check endpoint with caching
app.get('/api/health', responseCache(60), (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    socketConnections: socketManager.getConnectedClientsInfo().length,
    version: '1.0.0',
    services: {
      database: 'connected',
      websocket: 'active',
      authentication: 'enabled',
    },
  });
});

// Socket.IO status endpoint
app.get('/api/socket-status', (req, res) => {
  res.json({
    connectedClients: socketManager.getConnectedClientsInfo(),
    totalConnections: socketManager.getConnectedClientsInfo().length,
    status: 'active',
  });
});

// Root API endpoint with comprehensive information
app.get('/api', (req, res) => {
  res.json({
    message: 'Cafe Reservation System API',
    version: '1.0.0',
    status: 'operational',
    features: {
      realtime: 'WebSocket support enabled',
      auth: 'JWT authentication with role-based access control',
      reservations: 'CRUD operations with conflict prevention',
      tables: 'Management with real-time status updates',
      validation: 'Comprehensive business logic validation',
      security: 'Rate limiting, CORS, and security headers',
    },
    endpoints: {
      health: '/api/health',
      socketStatus: '/api/socket-status',
      auth: {
        signup: 'POST /api/auth/signup',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        profile: 'GET /api/auth/me',
        updateProfile: 'PATCH /api/auth/me',
        refresh: 'POST /api/auth/refresh',
        roles: 'GET /api/auth/roles (admin only)',
        users: 'GET /api/auth/users (admin only)',
      },
      tables: {
        list: 'GET /api/tables',
        available: 'GET /api/tables/available',
        detail: 'GET /api/tables/:id',
        create: 'POST /api/tables (admin only)',
        update: 'PUT /api/tables/:id (admin only)',
        status: 'PATCH /api/tables/:id/status (staff/admin)',
        delete: 'DELETE /api/tables/:id (admin only)',
        reservations: 'GET /api/tables/:id/reservations (staff/admin)',
      },
      reservations: {
        availability: 'GET /api/reservations/availability',
        list: 'GET /api/reservations',
        detail: 'GET /api/reservations/:id',
        create: 'POST /api/reservations',
        update: 'PUT /api/reservations/:id',
        delete: 'DELETE /api/reservations/:id',
        status: 'PATCH /api/reservations/:id/status (staff/admin)',
      },
      admin: {
        dashboard: 'GET /api/admin/dashboard (staff/admin)',
        reservations: 'GET /api/admin/reservations (staff/admin)',
        updateReservation: 'PUT /api/admin/reservations/:id (staff/admin)',
        cancelReservation: 'DELETE /api/admin/reservations/:id (staff/admin)',
        tables: 'GET /api/admin/tables (staff/admin)',
        updateTable: 'PUT /api/admin/tables/:id (staff/admin)',
        createTable: 'POST /api/admin/tables (staff/admin)',
        customers: 'GET /api/admin/customers (staff/admin)',
        reports: 'GET /api/admin/reports (staff/admin)',
        analytics: 'GET /api/admin/analytics (staff/admin)',
        settings: 'GET /api/admin/settings (admin only)',
        updateSettings: 'PUT /api/admin/settings (admin only)',
      },
    },
    businessRules: {
      hours: '8:00 AM - 10:00 PM',
      maxAdvanceBooking: '3 months',
      maxReservationDuration: '4 hours',
      minReservationDuration: '30 minutes',
      maxReservationsPerDay: '3 per user',
      bufferTime: '15 minutes between bookings',
    },
    authentication: {
      method: 'JWT tokens',
      roles: ['customer', 'staff', 'admin'],
      rateLimit: '5 attempts per 15 minutes for auth endpoints',
    },
    documentation: {
      swagger: '/api/docs (if available)',
      github: 'https://github.com/harryooharry2/reservationSystemTM',
    },
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/admin', require('./routes/admin'));

// 404 handler for unmatched API routes
app.use('/api/*', notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received, shutting down gracefully`);

  // Close Socket.IO server
  if (socketManager.io) {
    socketManager.io.close(() => {
      console.log('Socket.IO server closed');
    });
  }

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error(
      'Could not close connections in time, forcefully shutting down'
    );
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('Uncaught Exception');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('Unhandled Rejection');
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Monitoring: http://localhost:${PORT}/api/monitoring/status`);
  console.log(
    `🔌 Socket.IO status: http://localhost:${PORT}/api/socket-status`
  );
  console.log(`📋 API docs: http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Security: Rate limiting, CORS, and Helmet enabled`);
  console.log(`📝 Logging: Morgan HTTP request logging enabled`);
  console.log(`⚡ Real-time: Socket.IO server initialized`);
  console.log(
    `✅ Business Logic: Comprehensive validation and error handling active`
  );

  // Start monitoring system
  startMonitoring();
});

module.exports = { app, server };
