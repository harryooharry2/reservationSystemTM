const { Server } = require('socket.io');
const { supabase } = require('./supabase');

class SocketManager {
  constructor() {
    this.io = null;
    this.connectedClients = new Map(); // Map to track connected clients and their rooms
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN
          ? process.env.CORS_ORIGIN.split(',')
          : ['http://localhost:4321', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    this.setupSupabaseRealtime();

    console.log('🔌 Socket.IO server initialized');
    return this.io;
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Join table availability room
      socket.on('join-table-updates', (data) => {
        const { tableIds } = data;
        if (tableIds && Array.isArray(tableIds)) {
          tableIds.forEach((tableId) => {
            socket.join(`table-${tableId}`);
          });
          this.connectedClients.set(socket.id, { tableIds, socket });
          console.log(
            `📋 Client ${socket.id} joined table rooms: ${tableIds.join(', ')}`
          );
        }
      });

      // Join reservation updates room
      socket.on('join-reservation-updates', (data) => {
        const { userId } = data;
        if (userId) {
          socket.join(`user-reservations-${userId}`);
          this.connectedClients.set(socket.id, {
            ...this.connectedClients.get(socket.id),
            userId,
            socket,
          });
          console.log(
            `📅 Client ${socket.id} joined user reservations room: ${userId}`
          );
        }
      });

      // Join admin dashboard room
      socket.on('join-admin-dashboard', (data) => {
        const { adminId } = data;
        if (adminId) {
          socket.join('admin-dashboard');
          this.connectedClients.set(socket.id, {
            ...this.connectedClients.get(socket.id),
            adminId,
            socket,
          });
          console.log(`👨‍💼 Admin ${adminId} joined dashboard room`);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`🔌 Socket error for ${socket.id}:`, error);
      });

      // Ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }

  setupSupabaseRealtime() {
    // Subscribe to table status changes
    const tableSubscription = supabase
      .channel('table-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cafe_tables',
        },
        (payload) => {
          console.log('📋 Table status change:', payload);
          this.broadcastTableUpdate(payload);
        }
      )
      .subscribe();

    // Subscribe to reservation changes
    const reservationSubscription = supabase
      .channel('reservation-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        (payload) => {
          console.log('📅 Reservation change:', payload);
          this.broadcastReservationUpdate(payload);
        }
      )
      .subscribe();

    // Handle subscription errors
    tableSubscription.on('error', (error) => {
      console.error('📋 Table subscription error:', error);
    });

    reservationSubscription.on('error', (error) => {
      console.error('📅 Reservation subscription error:', error);
    });
  }

  broadcastTableUpdate(payload) {
    const { new: newRecord, old: oldRecord, eventType } = payload;
    const tableId = newRecord?.id || oldRecord?.id;

    if (!tableId) return;

    const updateData = {
      tableId,
      eventType, // INSERT, UPDATE, DELETE
      oldStatus: oldRecord?.status,
      newStatus: newRecord?.status,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to specific table room
    this.io.to(`table-${tableId}`).emit('table-status-updated', updateData);

    // Broadcast to admin dashboard
    this.io.to('admin-dashboard').emit('table-status-updated', updateData);

    console.log(
      `📋 Broadcasted table update for table ${tableId}:`,
      updateData
    );
  }

  broadcastReservationUpdate(payload) {
    const { new: newRecord, old: oldRecord, eventType } = payload;
    const userId = newRecord?.user_id || oldRecord?.user_id;

    if (!userId) return;

    const updateData = {
      reservationId: newRecord?.id || oldRecord?.id,
      userId,
      eventType,
      oldData: oldRecord,
      newData: newRecord,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to specific user's reservation room
    this.io
      .to(`user-reservations-${userId}`)
      .emit('reservation-updated', updateData);

    // Broadcast to admin dashboard
    this.io.to('admin-dashboard').emit('reservation-updated', updateData);

    console.log(
      `📅 Broadcasted reservation update for user ${userId}:`,
      updateData
    );
  }

  // Manual broadcast methods for API-triggered updates
  broadcastAvailabilityUpdate(tableId, availabilityData) {
    this.io.to(`table-${tableId}`).emit('availability-updated', {
      tableId,
      availability: availabilityData,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastReservationCreated(reservationData) {
    const { user_id, table_id } = reservationData;

    // Broadcast to user's reservation room
    this.io.to(`user-reservations-${user_id}`).emit('reservation-created', {
      reservation: reservationData,
      timestamp: new Date().toISOString(),
    });

    // Broadcast table availability update
    this.broadcastAvailabilityUpdate(table_id, { status: 'reserved' });
  }

  broadcastReservationCancelled(reservationData) {
    const { user_id, table_id } = reservationData;

    // Broadcast to user's reservation room
    this.io.to(`user-reservations-${user_id}`).emit('reservation-cancelled', {
      reservation: reservationData,
      timestamp: new Date().toISOString(),
    });

    // Broadcast table availability update
    this.broadcastAvailabilityUpdate(table_id, { status: 'available' });
  }

  // Get connected clients info for debugging
  getConnectedClientsInfo() {
    const info = [];
    this.connectedClients.forEach((client, socketId) => {
      info.push({
        socketId,
        tableIds: client.tableIds || [],
        userId: client.userId,
        adminId: client.adminId,
      });
    });
    return info;
  }

  // Get active rooms
  getActiveRooms() {
    const rooms = new Set();
    this.connectedClients.forEach((client) => {
      if (client.tableIds) {
        client.tableIds.forEach((tableId) => rooms.add(`table-${tableId}`));
      }
      if (client.userId) {
        rooms.add(`user-reservations-${client.userId}`);
      }
      if (client.adminId) {
        rooms.add('admin-dashboard');
      }
    });
    return Array.from(rooms);
  }

  // Get total connections
  getTotalConnections() {
    return this.connectedClients.size;
  }

  // Broadcast system message
  broadcastSystemMessage(message, room = null) {
    const systemMessage = {
      type: 'system',
      message,
      timestamp: new Date().toISOString(),
    };

    if (room) {
      this.io.to(room).emit('system-message', systemMessage);
    } else {
      this.io.emit('system-message', systemMessage);
    }
  }
}

module.exports = new SocketManager();
