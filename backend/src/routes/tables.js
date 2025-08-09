const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all cafe tables
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('*')
      .order('table_number');

    if (error) {
      console.error('Error fetching tables:', error);
      return res.status(500).json({
        error: 'Failed to fetch tables',
        details: error.message,
      });
    }

    res.json({
      success: true,
      data: data,
      count: data.length,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

// Get available tables for a specific date and time
router.get(
  '/available',
  [
    body('date').isISO8601().withMessage('Valid date is required'),
    body('start_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid start time is required (HH:MM)'),
    body('end_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid end time is required (HH:MM)'),
    body('capacity')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Capacity must be a positive integer'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { date, start_time, end_time, capacity } = req.body;

      // Call the database function to get available tables
      const { data, error } = await supabase.rpc('get_available_tables', {
        p_reservation_date: date,
        p_start_time: start_time,
        p_end_time: end_time,
        p_capacity: capacity || null,
      });

      if (error) {
        console.error('Error fetching available tables:', error);
        return res.status(500).json({
          error: 'Failed to fetch available tables',
          details: error.message,
        });
      }

      res.json({
        success: true,
        data: data,
        count: data.length,
        filters: { date, start_time, end_time, capacity },
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

// Get a specific table by ID
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

    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

// Update table status (admin only)
router.patch(
  '/:id/status',
  [
    verifyToken,
    requireAdmin,
    body('status')
      .isIn(['available', 'occupied', 'reserved', 'maintenance'])
      .withMessage('Valid status is required'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { id } = req.params;
      const { status } = req.body;

      const { data, error } = await supabase
        .from('cafe_tables')
        .update({ status })
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

// Health check for tables endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Tables API is healthy',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
