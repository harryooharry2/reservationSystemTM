const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { 
  verifyToken, 
  requireAdmin, 
  requireStaffOrAdmin,
  requireOwnership,
  logAuthEvent 
} = require('../middleware/auth');
const socketManager = require('../config/socket');

const router = express.Router();

function sendValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
    return true;
  }
  return false;
}

// GET /api/reservations/availability - Get available tables for specific date/time
router.get('/availability', async (req, res) => {
  try {
    const { date, start_time, end_time, party_size } = req.query;

    if (!date || !start_time || !end_time) {
      return res.status(400).json({
        error: 'Date, start_time, and end_time are required',
      });
    }

    // Use enhanced function with buffer if available, otherwise fallback
    let query;
    try {
      const { data, error } = await supabase.rpc('get_available_tables_with_buffer', {
        p_reservation_date: date,
        p_start_time: start_time,
        p_end_time: end_time,
        p_party_size: party_size ? parseInt(party_size) : null,
        p_buffer_minutes: 15
      });

      if (error) {
        console.warn('Enhanced availability function not available, using fallback:', error.message);
        // Fallback to basic availability check
        query = supabase
          .from('cafe_tables')
          .select('*')
          .eq('status', 'available')
          .order('capacity', { ascending: true });
      } else {
        // Filter results to only show available tables
        const availableTables = data.filter(table => table.is_available);
        return res.json({
          success: true,
          data: availableTables,
          count: availableTables.length,
          filters: { date, start_time, end_time, party_size },
        });
      }
    } catch (rpcError) {
      console.warn('RPC function error, using fallback:', rpcError.message);
      // Fallback to basic availability check
      query = supabase
        .from('cafe_tables')
        .select('*')
        .eq('status', 'available')
        .order('capacity', { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching available tables:', error);
      return res.status(500).json({
        error: 'Failed to fetch available tables',
        details: error.message,
      });
    }

    // Filter by party size if specified
    let filteredData = data;
    if (party_size) {
      filteredData = data.filter(table => table.capacity >= parseInt(party_size));
    }

    res.json({
      success: true,
      data: filteredData,
      count: filteredData.length,
      filters: { date, start_time, end_time, party_size },
    });
  } catch (e) {
    res.status(500).json({ error: 'Internal error', details: e.message });
  }
});

// GET /api/reservations - Get user's reservations (authenticated) or all (admin/staff)
router.get('/', [
  verifyToken,
  logAuthEvent('RESERVATIONS_ACCESS'),
], async (req, res) => {
  try {
    const { date_from, date_to, status } = req.query;
    const userRole = req.profile.role;

    let query = supabase
      .from('reservations')
      .select(`
        id, 
        user_id, 
        table_id, 
        reservation_date, 
        start_time, 
        end_time, 
        status, 
        notes, 
        party_size,
        created_at,
        updated_at,
        cafe_tables!inner(table_number, capacity),
        users!inner(name, email)
      `)
      .order('reservation_date', { ascending: false })
      .order('start_time', { ascending: false });

    // Apply filters
    if (date_from) {
      query = query.gte('reservation_date', date_from);
    }
    if (date_to) {
      query = query.lte('reservation_date', date_to);
    }
    if (status) {
      query = query.in('status', status.split(','));
    }

    // Filter by user unless admin/staff
    if (userRole === 'customer') {
      query = query.eq('user_id', req.profile.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching reservations:', error);
      return res.status(500).json({
        error: 'Failed to fetch reservations',
        details: error.message,
      });
    }

    res.json({
      success: true,
      data,
      count: data?.length || 0,
    });
  } catch (e) {
    res.status(500).json({ error: 'Internal error', details: e.message });
  }
});

// GET /api/reservations/:id - Get specific reservation
router.get('/:id', [
  verifyToken,
  logAuthEvent('RESERVATION_DETAIL_ACCESS'),
], async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.profile.role;

    let query = supabase
      .from('reservations')
      .select(`
        id, 
        user_id, 
        table_id, 
        reservation_date, 
        start_time, 
        end_time, 
        status, 
        notes, 
        party_size,
        created_at,
        updated_at,
        cafe_tables!inner(table_number, capacity),
        users!inner(name, email)
      `)
      .eq('id', id)
      .single();

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Reservation not found',
        });
      }
      console.error('Error fetching reservation:', error);
      return res.status(500).json({
        error: 'Failed to fetch reservation',
        details: error.message,
      });
    }

    // Check access permissions
    if (userRole === 'customer' && data.user_id !== req.profile.id) {
      return res.status(403).json({
        error: 'Access denied to other user reservations',
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (e) {
    res.status(500).json({ error: 'Internal error', details: e.message });
  }
});

// POST /api/reservations - Create reservation with enhanced conflict prevention
router.post(
  '/',
  [
    verifyToken,
    logAuthEvent('RESERVATION_CREATION'),
    body('table_id').isInt({ min: 1 }).withMessage('Valid table ID is required'),
    body('reservation_date')
      .isISO8601()
      .withMessage('Valid reservation date is required'),
    body('start_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid start time is required (HH:MM)'),
    body('end_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid end time is required (HH:MM)'),
    body('party_size')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Party size must be a positive integer'),
    body('notes').optional().isString().trim().escape(),
    body('buffer_minutes')
      .optional()
      .isInt({ min: 0, max: 60 })
      .withMessage('Buffer minutes must be between 0 and 60'),
  ],
  async (req, res) => {
    const v = sendValidationErrors(req, res);
    if (v) return v;

    try {
      const userId = req.user.id;
      const {
        table_id,
        reservation_date,
        start_time,
        end_time,
        party_size,
        notes,
        buffer_minutes = 15,
      } = req.body;

      // Use enhanced safe creation function with transaction and conflict prevention
      const { data, error } = await supabase.rpc('create_reservation_safe', {
        p_user_id: userId,
        p_table_id: table_id,
        p_reservation_date: reservation_date,
        p_start_time: start_time,
        p_end_time: end_time,
        p_party_size: party_size || null,
        p_notes: notes || null,
        p_buffer_minutes: parseInt(buffer_minutes),
      });

      if (error) {
        console.error('Error creating reservation:', error);
        return res
          .status(500)
          .json({ error: 'Failed to create reservation', details: error.message });
      }

      const result = typeof data === 'string' ? JSON.parse(data) : data;

      if (!result.success) {
        return res.status(409).json({ error: result.error });
      }

      // Broadcast real-time update
      const reservationData = {
        id: result.reservation_id,
        user_id: userId,
        table_id: table_id,
        reservation_date: reservation_date,
        start_time: start_time,
        end_time: end_time,
        party_size: party_size,
        notes: notes,
        status: 'confirmed',
      };

      socketManager.broadcastReservationCreated(reservationData);

      return res.status(201).json({ success: true, data: result });
    } catch (e) {
      return res
        .status(500)
        .json({ error: 'Internal server error', details: e.message });
    }
  }
);

// PUT /api/reservations/:id - Update reservation with enhanced conflict prevention
router.put(
  '/:id',
  [
    verifyToken,
    requireOwnership('reservation'),
    logAuthEvent('RESERVATION_UPDATE'),
    body('table_id').optional().isInt({ min: 1 }),
    body('reservation_date').optional().isISO8601(),
    body('start_time')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('end_time')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('party_size').optional().isInt({ min: 1 }),
    body('notes').optional().isString(),
    body('status')
      .optional()
      .isIn(['pending', 'confirmed', 'cancelled', 'completed']),
    body('buffer_minutes')
      .optional()
      .isInt({ min: 0, max: 60 })
      .withMessage('Buffer minutes must be between 0 and 60'),
  ],
  async (req, res) => {
    const v = sendValidationErrors(req, res);
    if (v) return v;

    try {
      const userId = req.user.id;
      const { id } = req.params;
      const {
        table_id,
        reservation_date,
        start_time,
        end_time,
        party_size,
        notes,
        status,
        buffer_minutes = 15,
      } = req.body;

      // Use enhanced safe update function with transaction and conflict prevention
      const { data, error } = await supabase.rpc('update_reservation_safe', {
        p_reservation_id: parseInt(id),
        p_user_id: userId,
        p_table_id: table_id || null,
        p_reservation_date: reservation_date || null,
        p_start_time: start_time || null,
        p_end_time: end_time || null,
        p_party_size: party_size || null,
        p_notes: notes || null,
        p_buffer_minutes: parseInt(buffer_minutes),
      });

      if (error) {
        console.error('Error updating reservation:', error);
        return res
          .status(500)
          .json({ error: 'Failed to update reservation', details: error.message });
      }

      const result = typeof data === 'string' ? JSON.parse(data) : data;

      if (!result.success) {
        if (result.error.includes('not found') || result.error.includes('not authorized')) {
          return res.status(404).json({ error: result.error });
        }
        if (result.error.includes('not available')) {
          return res.status(409).json({ error: result.error });
        }
        return res.status(400).json({ error: result.error });
      }

      // If status was provided, update it separately (not handled by the safe function)
      if (status) {
        const { error: statusError } = await supabaseAdmin
          .from('reservations')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);

        if (statusError) {
          console.error('Error updating status:', statusError);
          return res
            .status(500)
            .json({ error: 'Failed to update status', details: statusError.message });
        }
      }

      // Broadcast real-time update for reservation changes
      const updateData = {
        reservationId: parseInt(id),
        userId: userId,
        eventType: 'UPDATE',
        timestamp: new Date().toISOString(),
      };

      socketManager.io.to(`user-reservations-${userId}`).emit('reservation-updated', updateData);
      socketManager.io.to('admin-dashboard').emit('reservation-updated', updateData);

      return res.json({ success: true, data: result });
    } catch (e) {
      return res
        .status(500)
        .json({ error: 'Internal server error', details: e.message });
    }
  }
);

// DELETE /api/reservations/:id - Cancel/delete user's reservation
router.delete(
  '/:id',
  [
    verifyToken,
    requireOwnership('reservation'),
    logAuthEvent('RESERVATION_CANCELLATION'),
    param('id').isInt({ min: 1 }),
  ],
  async (req, res) => {
    const v = sendValidationErrors(req, res);
    if (v) return v;
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Get reservation details before deletion for broadcasting
      const { data: reservationData, error: getErr } = await supabaseAdmin
        .from('reservations')
        .select('id, user_id, table_id, reservation_date, start_time, end_time, status')
        .eq('id', id)
        .single();

      if (getErr) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      if (reservationData.user_id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Ensure reservation belongs to the user
      const { error } = await supabaseAdmin
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) return res.status(400).json({ error: error.message });

      // Broadcast real-time update for cancellation
      socketManager.broadcastReservationCancelled(reservationData);

      return res.json({ success: true });
    } catch (e) {
      return res
        .status(500)
        .json({ error: 'Internal server error', details: e.message });
    }
  }
);

// PATCH /api/reservations/:id/status - Update reservation status (staff/admin only)
router.patch(
  '/:id/status',
  [
    verifyToken,
    requireStaffOrAdmin,
    logAuthEvent('RESERVATION_STATUS_UPDATE'),
    param('id').isInt({ min: 1 }),
    body('status')
      .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
      .withMessage('Valid status is required'),
  ],
  async (req, res) => {
    const v = sendValidationErrors(req, res);
    if (v) return v;

    try {
      const { id } = req.params;
      const { status } = req.body;

      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update({ 
          status, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select('id, user_id, table_id, status')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Reservation not found' });
        }
        console.error('Error updating reservation status:', error);
        return res.status(500).json({
          error: 'Failed to update reservation status',
          details: error.message,
        });
      }

      // Broadcast real-time update
      const updateData = {
        reservationId: parseInt(id),
        userId: data.user_id,
        eventType: 'STATUS_UPDATE',
        newStatus: status,
        timestamp: new Date().toISOString(),
      };

      socketManager.io.to(`user-reservations-${data.user_id}`).emit('reservation-updated', updateData);
      socketManager.io.to('admin-dashboard').emit('reservation-updated', updateData);

      res.json({
        success: true,
        data,
        message: `Reservation status updated to ${status}`,
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

module.exports = router;
