const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const {
  verifyToken,
  requireAdmin,
  requireStaffOrAdmin,
  logAuthEvent,
} = require('../middleware/auth');

const router = express.Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ error: 'Validation failed', details: errors.array() });
  }
}

// GET /api/tables - Get all tables (public access)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('*')
      .order('table_number', { ascending: true });

    if (error) {
      console.error('Error fetching tables:', error);
      return res.status(500).json({
        error: 'Failed to fetch tables',
        details: error.message,
      });
    }

    res.json({ success: true, data, count: data?.length || 0 });
  } catch (e) {
    res.status(500).json({ error: 'Internal error', details: e.message });
  }
});

// GET /api/tables/available - Get available tables (public access)
router.get('/available', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('*')
      .eq('status', 'available')
      .order('table_number', { ascending: true });

    if (error) {
      console.error('Error fetching available tables:', error);
      return res.status(500).json({
        error: 'Failed to fetch available tables',
        details: error.message,
      });
    }

    res.json({ success: true, data, count: data?.length || 0 });
  } catch (e) {
    res.status(500).json({ error: 'Internal error', details: e.message });
  }
});

// GET /api/tables/:id - Get specific table (public access)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Table not found',
        });
      }
      console.error('Error fetching table:', error);
      return res.status(500).json({
        error: 'Failed to fetch table',
        details: error.message,
      });
    }

    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: 'Internal error', details: e.message });
  }
});

// POST /api/tables - Create new table (admin only)
router.post(
  '/',
  [
    verifyToken,
    requireAdmin,
    logAuthEvent('TABLE_CREATION'),
    body('table_number')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Table number is required'),
    body('capacity')
      .isInt({ min: 1, max: 20 })
      .withMessage('Capacity must be between 1 and 20'),
    body('status')
      .optional()
      .isIn(['available', 'occupied', 'reserved', 'maintenance'])
      .withMessage('Valid status is required'),
  ],
  async (req, res) => {
    const v = validate(req, res);
    if (v) return v;

    try {
      const { table_number, capacity, status = 'available' } = req.body;

      // Check if table number already exists
      const { data: existing, error: checkError } = await supabase
        .from('cafe_tables')
        .select('id')
        .eq('table_number', table_number)
        .single();

      if (existing) {
        return res.status(409).json({
          error: 'Table number already exists',
        });
      }

      const { data, error } = await supabase
        .from('cafe_tables')
        .insert({
          table_number,
          capacity,
          status,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating table:', error);
        return res.status(500).json({
          error: 'Failed to create table',
          details: error.message,
        });
      }

      res.status(201).json({
        success: true,
        data,
        message: 'Table created successfully',
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// PUT /api/tables/:id - Update table (admin only)
router.put(
  '/:id',
  [
    verifyToken,
    requireAdmin,
    logAuthEvent('TABLE_UPDATE'),
    body('table_number')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('Table number must not be empty'),
    body('capacity')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Capacity must be between 1 and 20'),
    body('status')
      .optional()
      .isIn(['available', 'occupied', 'reserved', 'maintenance'])
      .withMessage('Valid status is required'),
  ],
  async (req, res) => {
    const v = validate(req, res);
    if (v) return v;

    try {
      const { id } = req.params;
      const { table_number, capacity, status } = req.body;

      // Check if table exists
      const { data: existing, error: checkError } = await supabase
        .from('cafe_tables')
        .select('id, table_number')
        .eq('id', id)
        .single();

      if (checkError || !existing) {
        return res.status(404).json({
          error: 'Table not found',
        });
      }

      // If table number is being updated, check for conflicts
      if (table_number && table_number !== existing.table_number) {
        const { data: conflict, error: conflictError } = await supabase
          .from('cafe_tables')
          .select('id')
          .eq('table_number', table_number)
          .single();

        if (conflict) {
          return res.status(409).json({
            error: 'Table number already exists',
          });
        }
      }

      const { data, error } = await supabase
        .from('cafe_tables')
        .update({
          table_number,
          capacity,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating table:', error);
        return res.status(500).json({
          error: 'Failed to update table',
          details: error.message,
        });
      }

      res.json({
        success: true,
        data,
        message: 'Table updated successfully',
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// PATCH /api/tables/:id/status - Update table status (staff/admin only)
router.patch(
  '/:id/status',
  [
    verifyToken,
    requireStaffOrAdmin,
    logAuthEvent('TABLE_STATUS_UPDATE'),
    body('status')
      .isIn(['available', 'occupied', 'reserved', 'maintenance'])
      .withMessage('Valid status is required'),
  ],
  async (req, res) => {
    const v = validate(req, res);
    if (v) return v;

    try {
      const { id } = req.params;
      const { status } = req.body;

      const { data, error } = await supabase
        .from('cafe_tables')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            error: 'Table not found',
          });
        }
        console.error('Error updating table status:', error);
        return res.status(500).json({
          error: 'Failed to update table status',
          details: error.message,
        });
      }

      res.json({
        success: true,
        data: data,
        message: `Table status updated to ${status}`,
      });
    } catch (error) {
      console.error('Unexpected error:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message,
      });
    }
  }
);

// DELETE /api/tables/:id - Delete table (admin only)
router.delete(
  '/:id',
  [verifyToken, requireAdmin, logAuthEvent('TABLE_DELETION')],
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if table has active reservations
      const { data: reservations, error: checkError } = await supabase
        .from('reservations')
        .select('id')
        .eq('table_id', id)
        .in('status', ['pending', 'confirmed']);

      if (checkError) {
        console.error('Error checking reservations:', checkError);
        return res.status(500).json({
          error: 'Failed to check table reservations',
          details: checkError.message,
        });
      }

      if (reservations && reservations.length > 0) {
        return res.status(409).json({
          error: 'Cannot delete table with active reservations',
          activeReservations: reservations.length,
        });
      }

      const { error } = await supabase
        .from('cafe_tables')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            error: 'Table not found',
          });
        }
        console.error('Error deleting table:', error);
        return res.status(500).json({
          error: 'Failed to delete table',
          details: error.message,
        });
      }

      res.json({
        success: true,
        message: 'Table deleted successfully',
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// GET /api/tables/:id/reservations - Get table reservations (staff/admin only)
router.get(
  '/:id/reservations',
  [verifyToken, requireStaffOrAdmin, logAuthEvent('TABLE_RESERVATIONS_ACCESS')],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { date, status } = req.query;

      let query = supabase
        .from('reservations')
        .select(
          `
          id, 
          user_id, 
          reservation_date, 
          start_time, 
          end_time, 
          status, 
          notes, 
          party_size,
          created_at,
          users!inner(name, email)
        `
        )
        .eq('table_id', id)
        .order('reservation_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (date) {
        query = query.eq('reservation_date', date);
      }

      if (status) {
        query = query.in('status', status.split(','));
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching table reservations:', error);
        return res.status(500).json({
          error: 'Failed to fetch table reservations',
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
  }
);

module.exports = router;
