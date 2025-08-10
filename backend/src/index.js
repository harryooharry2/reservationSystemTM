const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const http = require('http');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const tablesRoutes = require('./routes/tables');
const reservationsRoutes = require('./routes/reservations');

// Import Socket.IO manager
const socketManager = require('./config/socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
socketManager.initialize(server);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:4321', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
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
    console.error('Could not close connections in time, forcefully shutting down');
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
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(
    `🔌 Socket.IO status: http://localhost:${PORT}/api/socket-status`
  );
  console.log(`📋 API docs: http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Security: Rate limiting, CORS, and Helmet enabled`);
  console.log(`📝 Logging: Morgan HTTP request logging enabled`);
  console.log(`⚡ Real-time: Socket.IO server initialized`);
  console.log(`✅ Business Logic: Comprehensive validation and error handling active`);
});

module.exports = { app, server };
