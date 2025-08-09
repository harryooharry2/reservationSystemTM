const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

function sendValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ error: 'Validation failed', details: errors.array() });
  }
}

// GET /api/availability?date=YYYY-MM-DD&start_time=HH:MM&end_time=HH:MM&capacity=optional
router.get(
  '/availability',
  [
    query('date').isISO8601().withMessage('Valid date is required'),
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
  ],
  async (req, res) => {
    const v = sendValidationErrors(req, res);
    if (v) return v;
    try {
      const { date, start_time, end_time, capacity } = req.query;
      const { data, error } = await supabase.rpc('get_available_tables', {
        p_reservation_date: date,
        p_start_time: start_time,
        p_end_time: end_time,
        p_capacity: capacity ? parseInt(capacity, 10) : null,
      });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, data, count: data?.length || 0 });
    } catch (e) {
      return res
        .status(500)
        .json({ error: 'Internal error', details: e.message });
    }
  }
);

// GET /api/reservations - list current user's reservations
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, date } = req.query;
    let queryBuilder = supabaseAdmin
      .from('reservations')
      .select(
        'id, user_id, table_id, reservation_date, start_time, end_time, status, notes, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('reservation_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (status) queryBuilder = queryBuilder.eq('status', status);
    if (date) queryBuilder = queryBuilder.eq('reservation_date', date);

    const { data, error } = await queryBuilder;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, data, count: data?.length || 0 });
  } catch (e) {
    return res
      .status(500)
      .json({ error: 'Internal error', details: e.message });
  }
});

// POST /api/reservations - create a reservation
router.post(
  '/',
  [
    verifyToken,
    body('table_id').isInt({ min: 1 }).withMessage('table_id is required'),
    body('reservation_date').isISO8601().withMessage('Valid date is required'),
    body('start_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid start time is required (HH:MM)'),
    body('end_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid end time is required (HH:MM)'),
    body('notes').optional().isString(),
    body('party_size').optional().isInt({ min: 1 }),
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
        notes,
        party_size,
      } = req.body;

      // Optional capacity check
      if (party_size) {
        const { data: table, error: tErr } = await supabaseAdmin
          .from('cafe_tables')
          .select('id, capacity')
          .eq('id', table_id)
          .single();
        if (tErr) return res.status(400).json({ error: tErr.message });
        if (party_size > table.capacity) {
          return res
            .status(400)
            .json({ error: 'Party size exceeds table capacity' });
        }
      }

      // Conflict check via DB function
      const { data: available, error: availErr } = await supabase.rpc(
        'check_table_availability',
        {
          p_table_id: table_id,
          p_reservation_date: reservation_date,
          p_start_time: start_time,
          p_end_time: end_time,
        }
      );
      if (availErr) return res.status(500).json({ error: availErr.message });
      if (!available)
        return res
          .status(409)
          .json({ error: 'Time slot not available for this table' });

      const { data, error } = await supabaseAdmin
        .from('reservations')
        .insert({
          user_id: userId,
          table_id,
          reservation_date,
          start_time,
          end_time,
          status: 'confirmed',
          notes: notes || null,
        })
        .select('*')
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json({ success: true, data });
    } catch (e) {
      return res
        .status(500)
        .json({ error: 'Internal error', details: e.message });
    }
  }
);

// PUT /api/reservations/:id - update user's reservation (time/notes), recheck conflicts
router.put(
  '/:id',
  [
    verifyToken,
    param('id').isInt({ min: 1 }),
    body('reservation_date').optional().isISO8601(),
    body('start_time')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('end_time')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('notes').optional().isString(),
    body('status')
      .optional()
      .isIn(['pending', 'confirmed', 'cancelled', 'completed']),
  ],
  async (req, res) => {
    const v = sendValidationErrors(req, res);
    if (v) return v;
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { reservation_date, start_time, end_time, notes, status } =
        req.body;

      // Fetch existing reservation to get table_id
      const { data: existing, error: getErr } = await supabaseAdmin
        .from('reservations')
        .select(
          'id, user_id, table_id, reservation_date, start_time, end_time, status, notes'
        )
        .eq('id', id)
        .single();
      if (getErr)
        return res.status(404).json({ error: 'Reservation not found' });
      if (existing.user_id !== userId)
        return res.status(403).json({ error: 'Forbidden' });

      const newDate = reservation_date || existing.reservation_date;
      const newStart = start_time || existing.start_time;
      const newEnd = end_time || existing.end_time;

      // If times changed, recheck availability
      if (reservation_date || start_time || end_time) {
        const { data: available, error: availErr } = await supabase.rpc(
          'check_table_availability',
          {
            p_table_id: existing.table_id,
            p_reservation_date: newDate,
            p_start_time: newStart,
            p_end_time: newEnd,
          }
        );
        if (availErr) return res.status(500).json({ error: availErr.message });
        if (!available)
          return res.status(409).json({ error: 'New time slot not available' });
      }

      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update({
          reservation_date: newDate,
          start_time: newStart,
          end_time: newEnd,
          notes: notes !== undefined ? notes : existing.notes,
          status: status || existing.status,
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true, data });
    } catch (e) {
      return res
        .status(500)
        .json({ error: 'Internal error', details: e.message });
    }
  }
);

// DELETE /api/reservations/:id - cancel/delete user's reservation
router.delete(
  '/:id',
  [verifyToken, param('id').isInt({ min: 1 })],
  async (req, res) => {
    const v = sendValidationErrors(req, res);
    if (v) return v;
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Ensure reservation belongs to the user
      const { data: existing, error: getErr } = await supabaseAdmin
        .from('reservations')
        .select('id, user_id')
        .eq('id', id)
        .single();
      if (getErr)
        return res.status(404).json({ error: 'Reservation not found' });
      if (existing.user_id !== userId)
        return res.status(403).json({ error: 'Forbidden' });

      const { error } = await supabaseAdmin
        .from('reservations')
        .delete()
        .eq('id', id);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    } catch (e) {
      return res
        .status(500)
        .json({ error: 'Internal error', details: e.message });
    }
  }
);

module.exports = router;
