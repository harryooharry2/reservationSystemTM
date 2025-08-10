const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const socketManager = require('../config/socket');

const router = express.Router();

function sendValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ error: 'Validation failed', details: errors.array() });
  }
}

// GET /api/reservations/availability - Enhanced with buffer and capacity filtering
router.get(
  '/availability',
  [
    query('date')
      .isISO8601()
      .withMessage('Valid date is required (YYYY-MM-DD)'),
    query('start_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid start time is required (HH:MM)'),
    query('end_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid end time is required (HH:MM)'),
    query('capacity')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Capacity must be a positive integer'),
    query('buffer_minutes')
      .optional()
      .isInt({ min: 0, max: 60 })
      .withMessage('Buffer minutes must be between 0 and 60'),
  ],
  async (req, res) => {
    const v = sendValidationErrors(req, res);
    if (v) return v;

    const {
      date,
      start_time,
      end_time,
      capacity,
      buffer_minutes = 15,
    } = req.query;

    try {
      // Use enhanced function with buffer and capacity filtering
      const { data, error } = await supabase.rpc(
        'get_available_tables_with_buffer',
        {
          p_reservation_date: date,
          p_start_time: start_time,
          p_end_time: end_time,
          p_party_size: capacity ? parseInt(capacity) : null,
          p_buffer_minutes: parseInt(buffer_minutes),
        }
      );

      if (error) {
        console.error('Error fetching available tables:', error);
        return res
          .status(500)
          .json({
            error: 'Failed to fetch available tables',
            details: error.message,
          });
      }

      // Filter to only show available tables
      const availableTables = data.filter((table) => table.is_available);

      return res.json({
        success: true,
        data: availableTables,
        count: availableTables.length,
        buffer_minutes: parseInt(buffer_minutes),
      });
    } catch (e) {
      return res
        .status(500)
        .json({ error: 'Internal error', details: e.message });
    }
  }
);

// GET /api/reservations - Get user's reservations (enhanced with better error handling)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, date_from, date_to } = req.query;

    let queryBuilder = supabaseAdmin
      .from('reservations')
      .select(
        'id, user_id, table_id, reservation_date, start_time, end_time, status, notes, party_size, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('reservation_date', { ascending: true })
      .order('start_time', { ascending: true });

    // Add filters if provided
    if (status) {
      queryBuilder = queryBuilder.in('status', status.split(','));
    }
    if (date_from) {
      queryBuilder = queryBuilder.gte('reservation_date', date_from);
    }
    if (date_to) {
      queryBuilder = queryBuilder.lte('reservation_date', date_to);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Error fetching user reservations:', error);
      return res
        .status(500)
        .json({
          error: 'Failed to fetch reservations',
          details: error.message,
        });
    }

    return res.json({ success: true, data, count: data?.length || 0 });
  } catch (e) {
    return res
      .status(500)
      .json({ error: 'Internal error', details: e.message });
  }
});

// POST /api/reservations - Create reservation with enhanced conflict prevention
router.post(
  '/',
  verifyToken,
  [
    body('table_id')
      .isInt({ min: 1 })
      .withMessage('Valid table ID is required'),
    body('reservation_date')
      .isISO8601()
      .withMessage('Valid reservation date is required (YYYY-MM-DD)'),
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
          .json({
            error: 'Failed to create reservation',
            details: error.message,
          });
      }

      // Parse the JSON result from the function
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
        .json({ error: 'Internal error', details: e.message });
    }
  }
);

// PUT /api/reservations/:id - Update reservation with enhanced conflict prevention
router.put(
  '/:id',
  verifyToken,
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Valid reservation ID is required'),
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
          .json({
            error: 'Failed to update reservation',
            details: error.message,
          });
      }

      // Parse the JSON result from the function
      const result = typeof data === 'string' ? JSON.parse(data) : data;

      if (!result.success) {
        if (
          result.error.includes('not found') ||
          result.error.includes('not authorized')
        ) {
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
            .json({
              error: 'Failed to update status',
              details: statusError.message,
            });
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
        .json({ error: 'Internal error', details: e.message });
    }
  }
);

// DELETE /api/reservations/:id - Cancel/delete user's reservation
router.delete(
  '/:id',
  [verifyToken, param('id').isInt({ min: 1 })],
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
        .json({ error: 'Internal error', details: e.message });
    }
  }
);

module.exports = router;
