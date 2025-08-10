const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
require('dotenv').config();

// Import routes
const tablesRouter = require('./routes/tables');
const authRouter = require('./routes/auth');
const reservationsRouter = require('./routes/reservations');

// Import Socket.IO manager
const socketManager = require('./config/socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
socketManager.initialize(server);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:4321', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
  message: { error: 'Too many requests from this IP, please try again later.' },
});
app.use('/api/', limiter);

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    socketConnections: socketManager.getConnectedClientsInfo().length,
  });
});

// Socket.IO status endpoint
app.get('/api/socket-status', (req, res) => {
  res.json({
    connectedClients: socketManager.getConnectedClientsInfo(),
    totalConnections: socketManager.getConnectedClientsInfo().length,
  });
});

// Root endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Cafe Reservation System API',
    version: '1.0.0',
    features: {
      realtime: 'WebSocket support enabled',
      auth: 'JWT authentication',
      reservations: 'CRUD operations with conflict prevention',
    },
    endpoints: {
      health: '/api/health',
      socketStatus: '/api/socket-status',
      auth: '/api/auth',
      tables: '/api/tables',
      tables_available: '/api/tables/available',
      reservations: '/api/reservations',
    },
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/reservations', reservationsRouter);

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Something went wrong',
  });
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
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server };
