/**
 * Real-time Service
 * Handles Socket.IO connections and real-time updates for the reservation system
 */

// Configuration
const SOCKET_URL = import.meta.env.PUBLIC_SOCKET_URL || 'http://localhost:3000';

class RealtimeService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.eventListeners = new Map();
    this.rooms = new Set();
  }

  /**
   * Initialize Socket.IO connection
   */
  initialize() {
    if (typeof io === 'undefined') {
      console.warn(
        'Socket.IO client not loaded. Real-time features will be disabled.'
      );
      return;
    }

    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: this.maxReconnectAttempts,
      });

      this.setupEventHandlers();
      console.log('Real-time service initialized');
    } catch (error) {
      console.error('Failed to initialize real-time service:', error);
    }
  }

  /**
   * Set up Socket.IO event handlers
   */
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to real-time server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connection:established');

      // Rejoin rooms after reconnection
      this.rooms.forEach((room) => {
        this.joinRoom(room);
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from real-time server:', reason);
      this.isConnected = false;
      this.emit('connection:lost', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.reconnectAttempts++;
      this.emit('connection:error', {
        error,
        attempts: this.reconnectAttempts,
      });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(
        'Reconnected to real-time server after',
        attemptNumber,
        'attempts'
      );
      this.isConnected = true;
      this.emit('connection:reestablished', { attempts: attemptNumber });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect to real-time server');
      this.emit('connection:failed');
    });

    // Table events
    this.socket.on('table-updated', (data) => {
      console.log('Table updated:', data);
      this.emit('table:updated', data);
    });

    this.socket.on('table-status-changed', (data) => {
      console.log('Table status changed:', data);
      this.emit('table:statusChanged', data);
    });

    // Reservation events
    this.socket.on('reservation-created', (data) => {
      console.log('Reservation created:', data);
      this.emit('reservation:created', data);
    });

    this.socket.on('reservation-updated', (data) => {
      console.log('Reservation updated:', data);
      this.emit('reservation:updated', data);
    });

    this.socket.on('reservation-cancelled', (data) => {
      console.log('Reservation cancelled:', data);
      this.emit('reservation:cancelled', data);
    });

    // Availability events
    this.socket.on('availability-updated', (data) => {
      console.log('Availability updated:', data);
      this.emit('availability:updated', data);
    });

    // Admin events
    this.socket.on('admin-notification', (data) => {
      console.log('Admin notification:', data);
      this.emit('admin:notification', data);
    });

    // Error events
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Join a room for specific updates
   */
  joinRoom(roomName) {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot join room: not connected');
      return;
    }

    this.socket.emit('join-room', roomName);
    this.rooms.add(roomName);
    console.log('Joined room:', roomName);
  }

  /**
   * Leave a room
   */
  leaveRoom(roomName) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('leave-room', roomName);
    this.rooms.delete(roomName);
    console.log('Left room:', roomName);
  }

  /**
   * Join user-specific room for personal updates
   */
  joinUserRoom(userId) {
    this.joinRoom(`user-reservations-${userId}`);
  }

  /**
   * Join admin room for administrative updates
   */
  joinAdminRoom() {
    this.joinRoom('admin-dashboard');
  }

  /**
   * Join table-specific room for table updates
   */
  joinTableRoom(tableId) {
    this.joinRoom(`table-${tableId}`);
  }

  /**
   * Subscribe to table availability updates
   */
  subscribeToTableAvailability() {
    this.joinRoom('table-availability');
  }

  /**
   * Subscribe to reservation updates
   */
  subscribeToReservations() {
    this.joinRoom('reservations');
  }

  /**
   * Send a custom event to the server
   */
  emit(eventName, data) {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot emit event: not connected');
      return;
    }

    this.socket.emit(eventName, data);
  }

  /**
   * Add event listener for real-time events
   */
  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
  }

  /**
   * Remove event listener
   */
  off(eventName, callback) {
    if (!this.eventListeners.has(eventName)) return;

    const listeners = this.eventListeners.get(eventName);
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Emit event to local listeners
   */
  emit(eventName, data) {
    if (this.eventListeners.has(eventName)) {
      this.eventListeners.get(eventName).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      rooms: Array.from(this.rooms),
    };
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.rooms.clear();
      console.log('Disconnected from real-time server');
    }
  }

  /**
   * Reconnect to server
   */
  reconnect() {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.initialize();
    }
  }

  /**
   * Send heartbeat to keep connection alive
   */
  sendHeartbeat() {
    if (this.isConnected) {
      this.emit('heartbeat', { timestamp: Date.now() });
    }
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat(interval = 30000) {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, interval);
  }

  /**
   * Stop heartbeat interval
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// Create singleton instance
const realtimeService = new RealtimeService();

// Auto-initialize when module is loaded
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      realtimeService.initialize();
    });
  } else {
    realtimeService.initialize();
  }
}

export default realtimeService;
