const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { socketManager } = require('../config/socket');

// Middleware to require admin or staff role
const requireAdminOrStaff = requireRole(['admin', 'staff']);

// GET /api/admin/dashboard - Get dashboard overview data
router.get(
  '/dashboard',
  verifyToken,
  requireAdminOrStaff,
  asyncHandler(async (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    try {
      // Get today's reservations
      const { data: todayReservations, error: todayError } = await supabase
        .from('reservations')
        .select('*')
        .eq('reservation_date', today);

      if (todayError) throw todayError;

      // Get available tables
      const { data: availableTables, error: tablesError } = await supabase
        .from('cafe_tables')
        .select('*')
        .eq('status', 'available');

      if (tablesError) throw tablesError;

      // Get pending reservations
      const { data: pendingReservations, error: pendingError } = await supabase
        .from('reservations')
        .select('*')
        .in('status', ['pending', 'confirmed'])
        .gte('reservation_date', today);

      if (pendingError) throw pendingError;

      // Get total customers
      const { data: customers, error: customersError } = await supabase
        .from('users')
        .select('id', { count: 'exact' });

      if (customersError) throw customersError;

      // Get recent activity
      const { data: recentActivity, error: activityError } = await supabase
        .from('reservations')
        .select(
          `
        *,
        users(name, email),
        cafe_tables(table_number)
      `
        )
        .order('created_at', { ascending: false })
        .limit(10);

      if (activityError) throw activityError;

      res.json({
        success: true,
        data: {
          todayReservations: todayReservations?.length || 0,
          availableTables: availableTables?.length || 0,
          pendingActions: pendingReservations?.length || 0,
          totalCustomers: customers?.length || 0,
          recentActivity: recentActivity || [],
        },
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load dashboard data',
        details: error.message,
      });
    }
  })
);

// GET /api/admin/reservations - Get reservations with filters
router.get(
  '/reservations',
  verifyToken,
  requireAdminOrStaff,
  asyncHandler(async (req, res) => {
    const { date, status, search, page = 1, limit = 20 } = req.query;

    try {
      let query = supabase.from('reservations').select(
        `
        *,
        users(name, email, phone),
        cafe_tables(table_number, capacity)
      `,
        { count: 'exact' }
      );

      // Apply filters
      if (date) {
        query = query.eq('reservation_date', date);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(
          `users.name.ilike.%${search}%,users.email.ilike.%${search}%`
        );
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
      query = query.order('reservation_date', { ascending: true });

      const { data: reservations, error, count } = await query;

      if (error) throw error;

      res.json({
        success: true,
        data: {
          reservations: reservations || [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count || 0,
            pages: Math.ceil((count || 0) / limit),
          },
        },
      });
    } catch (error) {
      console.error('Error loading reservations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load reservations',
        details: error.message,
      });
    }
  })
);

// PUT /api/admin/reservations/:id - Update reservation
router.put(
  '/reservations/:id',
  verifyToken,
  requireAdminOrStaff,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes, start_time, end_time, table_id } = req.body;

    try {
      const updateData = {};
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (start_time) updateData.start_time = start_time;
      if (end_time) updateData.end_time = end_time;
      if (table_id) updateData.table_id = table_id;

      const { data: reservation, error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', id)
        .select(
          `
        *,
        users(name, email),
        cafe_tables(table_number)
      `
        )
        .single();

      if (error) throw error;

      // Broadcast real-time update
      socketManager.broadcastToAll('reservation-updated', {
        reservation_id: id,
        status: status,
        updated_at: new Date().toISOString(),
      });

      res.json({
        success: true,
        data: reservation,
      });
    } catch (error) {
      console.error('Error updating reservation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update reservation',
        details: error.message,
      });
    }
  })
);

// DELETE /api/admin/reservations/:id - Cancel reservation
router.delete(
  '/reservations/:id',
  verifyToken,
  requireAdminOrStaff,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const { data: reservation, error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select(
          `
        *,
        users(name, email),
        cafe_tables(table_number)
      `
        )
        .single();

      if (error) throw error;

      // Broadcast real-time update
      socketManager.broadcastToAll('reservation-cancelled', {
        reservation_id: id,
        cancelled_at: new Date().toISOString(),
      });

      res.json({
        success: true,
        data: reservation,
      });
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel reservation',
        details: error.message,
      });
    }
  })
);

// GET /api/admin/tables - Get all tables
router.get(
  '/tables',
  verifyToken,
  requireAdminOrStaff,
  asyncHandler(async (req, res) => {
    try {
      const { data: tables, error } = await supabase
        .from('cafe_tables')
        .select('*')
        .order('table_number');

      if (error) throw error;

      res.json({
        success: true,
        data: tables || [],
      });
    } catch (error) {
      console.error('Error loading tables:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load tables',
        details: error.message,
      });
    }
  })
);

// PUT /api/admin/tables/:id - Update table
router.put(
  '/tables/:id',
  verifyToken,
  requireAdminOrStaff,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, capacity, table_number } = req.body;

    try {
      const updateData = {};
      if (status) updateData.status = status;
      if (capacity) updateData.capacity = capacity;
      if (table_number) updateData.table_number = table_number;

      const { data: table, error } = await supabase
        .from('cafe_tables')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Broadcast real-time update
      socketManager.broadcastToAll('table-updated', {
        table_id: id,
        status: status,
        updated_at: new Date().toISOString(),
      });

      res.json({
        success: true,
        data: table,
      });
    } catch (error) {
      console.error('Error updating table:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update table',
        details: error.message,
      });
    }
  })
);

// POST /api/admin/tables - Create new table
router.post(
  '/tables',
  verifyToken,
  requireAdminOrStaff,
  asyncHandler(async (req, res) => {
    const { table_number, capacity, status = 'available' } = req.body;

    try {
      const { data: table, error } = await supabase
        .from('cafe_tables')
        .insert({
          table_number,
          capacity,
          status,
        })
        .select()
        .single();

      if (error) throw error;

      // Broadcast real-time update
      socketManager.broadcastToAll('table-created', {
        table_id: table.id,
        table_number: table.table_number,
        created_at: new Date().toISOString(),
      });

      res.json({
        success: true,
        data: table,
      });
    } catch (error) {
      console.error('Error creating table:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create table',
        details: error.message,
      });
    }
  })
);

// GET /api/admin/customers - Get customers with search
router.get(
  '/customers',
  verifyToken,
  requireAdminOrStaff,
  asyncHandler(async (req, res) => {
    const { search, page = 1, limit = 20 } = req.query;

    try {
      let query = supabase.from('users').select(
        `
        *,
        reservations(count)
      `,
        { count: 'exact' }
      );

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
      query = query.order('name');

      const { data: customers, error, count } = await query;

      if (error) throw error;

      res.json({
        success: true,
        data: {
          customers: customers || [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count || 0,
            pages: Math.ceil((count || 0) / limit),
          },
        },
      });
    } catch (error) {
      console.error('Error loading customers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load customers',
        details: error.message,
      });
    }
  })
);

// GET /api/admin/reports - Generate reports
router.get(
  '/reports',
  verifyToken,
  requireAdminOrStaff,
  asyncHandler(async (req, res) => {
    const { start_date, end_date, type = 'daily' } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required',
      });
    }

    try {
      // Get reservations for the date range
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select(
          `
        *,
        users(name, email),
        cafe_tables(table_number)
      `
        )
        .gte('reservation_date', start_date)
        .lte('reservation_date', end_date)
        .order('reservation_date');

      if (error) throw error;

      // Calculate statistics
      const totalReservations = reservations?.length || 0;
      const confirmedReservations =
        reservations?.filter((r) => r.status === 'confirmed').length || 0;
      const cancelledReservations =
        reservations?.filter((r) => r.status === 'cancelled').length || 0;
      const completedReservations =
        reservations?.filter((r) => r.status === 'completed').length || 0;

      // Group by date
      const reservationsByDate = {};
      reservations?.forEach((reservation) => {
        const date = reservation.reservation_date;
        if (!reservationsByDate[date]) {
          reservationsByDate[date] = [];
        }
        reservationsByDate[date].push(reservation);
      });

      // Calculate revenue (if applicable)
      const totalRevenue =
        reservations?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;

      res.json({
        success: true,
        data: {
          summary: {
            totalReservations,
            confirmedReservations,
            cancelledReservations,
            completedReservations,
            totalRevenue,
          },
          dailyBreakdown: reservationsByDate,
          reservations: reservations || [],
        },
      });
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
        details: error.message,
      });
    }
  })
);

// GET /api/admin/settings - Get system settings
router.get(
  '/settings',
  verifyToken,
  requireRole(['admin']),
  asyncHandler(async (req, res) => {
    try {
      // This would typically load from a settings table
      // For now, return default settings
      res.json({
        success: true,
        data: {
          businessHours: {
            open: '09:00',
            close: '22:00',
          },
          reservationBuffer: 15,
          maxPartySize: 8,
          autoConfirm: false,
        },
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load settings',
        details: error.message,
      });
    }
  })
);

// PUT /api/admin/settings - Update system settings
router.put(
  '/settings',
  verifyToken,
  requireRole(['admin']),
  asyncHandler(async (req, res) => {
    const { businessHours, reservationBuffer, maxPartySize, autoConfirm } =
      req.body;

    try {
      // This would typically save to a settings table
      // For now, just return success
      res.json({
        success: true,
        data: {
          businessHours,
          reservationBuffer,
          maxPartySize,
          autoConfirm,
        },
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save settings',
        details: error.message,
      });
    }
  })
);

// GET /api/admin/analytics - Get analytics data
router.get(
  '/analytics',
  verifyToken,
  requireAdminOrStaff,
  asyncHandler(async (req, res) => {
    const { period = '7d' } = req.query;

    try {
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Get reservations for the period
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select('*')
        .gte('reservation_date', startDateStr)
        .lte('reservation_date', endDateStr);

      if (error) throw error;

      // Calculate analytics
      const totalReservations = reservations?.length || 0;
      const confirmedReservations =
        reservations?.filter((r) => r.status === 'confirmed').length || 0;
      const cancelledReservations =
        reservations?.filter((r) => r.status === 'cancelled').length || 0;
      const completionRate =
        totalReservations > 0
          ? (confirmedReservations / totalReservations) * 100
          : 0;

      // Group by date for trend analysis
      const reservationsByDate = {};
      reservations?.forEach((reservation) => {
        const date = reservation.reservation_date;
        if (!reservationsByDate[date]) {
          reservationsByDate[date] = 0;
        }
        reservationsByDate[date]++;
      });

      res.json({
        success: true,
        data: {
          period,
          summary: {
            totalReservations,
            confirmedReservations,
            cancelledReservations,
            completionRate: Math.round(completionRate * 100) / 100,
          },
          trends: reservationsByDate,
        },
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load analytics',
        details: error.message,
      });
    }
  })
);

module.exports = router;
