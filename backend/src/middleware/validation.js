const { body, param, query, validationResult } = require('express-validator');

/**
 * Comprehensive validation schemas for business logic
 */

// Reservation validation schemas
const reservationValidation = {
  create: [
    body('table_id')
      .isInt({ min: 1 })
      .withMessage('Valid table ID is required'),
    body('reservation_date')
      .isISO8601()
      .withMessage('Valid reservation date is required')
      .custom((value) => {
        const date = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (date < today) {
          throw new Error('Reservation date cannot be in the past');
        }
        
        // Allow reservations up to 3 months in advance
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 3);
        
        if (date > maxDate) {
          throw new Error('Reservations cannot be made more than 3 months in advance');
        }
        
        return true;
      }),
    body('start_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid start time is required (HH:MM)')
      .custom((value) => {
        const [hours, minutes] = value.split(':').map(Number);
        
        // Business hours: 8 AM to 10 PM
        if (hours < 8 || hours >= 22) {
          throw new Error('Reservations must be between 8:00 AM and 10:00 PM');
        }
        
        return true;
      }),
    body('end_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid end time is required (HH:MM)')
      .custom((value, { req }) => {
        const [startHours, startMinutes] = req.body.start_time.split(':').map(Number);
        const [endHours, endMinutes] = value.split(':').map(Number);
        
        const startTime = startHours * 60 + startMinutes;
        const endTime = endHours * 60 + endMinutes;
        
        if (endTime <= startTime) {
          throw new Error('End time must be after start time');
        }
        
        // Maximum reservation duration: 4 hours
        const duration = endTime - startTime;
        if (duration > 240) {
          throw new Error('Reservation duration cannot exceed 4 hours');
        }
        
        // Minimum reservation duration: 30 minutes
        if (duration < 30) {
          throw new Error('Reservation duration must be at least 30 minutes');
        }
        
        return true;
      }),
    body('party_size')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Party size must be between 1 and 20'),
    body('notes')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes cannot exceed 500 characters')
      .escape(),
    body('buffer_minutes')
      .optional()
      .isInt({ min: 0, max: 60 })
      .withMessage('Buffer minutes must be between 0 and 60'),
  ],
  
  update: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Valid reservation ID is required'),
    body('table_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid table ID is required'),
    body('reservation_date')
      .optional()
      .isISO8601()
      .withMessage('Valid reservation date is required')
      .custom((value) => {
        const date = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (date < today) {
          throw new Error('Reservation date cannot be in the past');
        }
        
        return true;
      }),
    body('start_time')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid start time is required (HH:MM)'),
    body('end_time')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid end time is required (HH:MM)'),
    body('party_size')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Party size must be between 1 and 20'),
    body('notes')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes cannot exceed 500 characters')
      .escape(),
    body('status')
      .optional()
      .isIn(['pending', 'confirmed', 'cancelled', 'completed'])
      .withMessage('Valid status is required'),
  ],
  
  availability: [
    query('date')
      .isISO8601()
      .withMessage('Valid date is required (YYYY-MM-DD)')
      .custom((value) => {
        const date = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (date < today) {
          throw new Error('Cannot check availability for past dates');
        }
        
        return true;
      }),
    query('start_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid start time is required (HH:MM)'),
    query('end_time')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Valid end time is required (HH:MM)'),
    query('party_size')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Party size must be between 1 and 20'),
  ],
};

// Table validation schemas
const tableValidation = {
  create: [
    body('table_number')
      .isString()
      .trim()
      .isLength({ min: 1, max: 10 })
      .withMessage('Table number must be between 1 and 10 characters')
      .matches(/^[A-Za-z0-9\-_]+$/)
      .withMessage('Table number can only contain letters, numbers, hyphens, and underscores'),
    body('capacity')
      .isInt({ min: 1, max: 20 })
      .withMessage('Capacity must be between 1 and 20'),
    body('status')
      .optional()
      .isIn(['available', 'occupied', 'reserved', 'maintenance'])
      .withMessage('Valid status is required'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Description cannot exceed 200 characters')
      .escape(),
  ],
  
  update: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Valid table ID is required'),
    body('table_number')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 10 })
      .withMessage('Table number must be between 1 and 10 characters')
      .matches(/^[A-Za-z0-9\-_]+$/)
      .withMessage('Table number can only contain letters, numbers, hyphens, and underscores'),
    body('capacity')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Capacity must be between 1 and 20'),
    body('status')
      .optional()
      .isIn(['available', 'occupied', 'reserved', 'maintenance'])
      .withMessage('Valid status is required'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Description cannot exceed 200 characters')
      .escape(),
  ],
  
  statusUpdate: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Valid table ID is required'),
    body('status')
      .isIn(['available', 'occupied', 'reserved', 'maintenance'])
      .withMessage('Valid status is required'),
  ],
};

// User validation schemas
const userValidation = {
  signup: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
      .isLength({ max: 255 })
      .withMessage('Email cannot exceed 255 characters'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('name')
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters')
      .matches(/^[A-Za-z\s\-']+$/)
      .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
  ],
  
  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 1 })
      .withMessage('Password is required'),
  ],
  
  profileUpdate: [
    body('name')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters')
      .matches(/^[A-Za-z\s\-']+$/)
      .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
      .isLength({ max: 255 })
      .withMessage('Email cannot exceed 255 characters'),
  ],
};

// Business logic validation functions
const businessValidation = {
  /**
   * Validate reservation time conflicts
   */
  async validateReservationTime(tableId, date, startTime, endTime, excludeReservationId = null) {
    const { supabase } = require('../config/supabase');
    
    let query = supabase
      .from('reservations')
      .select('id, start_time, end_time')
      .eq('table_id', tableId)
      .eq('reservation_date', date)
      .in('status', ['pending', 'confirmed']);
    
    if (excludeReservationId) {
      query = query.neq('id', excludeReservationId);
    }
    
    const { data: conflicts, error } = await query;
    
    if (error) {
      throw new Error('Failed to check reservation conflicts');
    }
    
    for (const conflict of conflicts) {
      const conflictStart = conflict.start_time;
      const conflictEnd = conflict.end_time;
      
      // Check for overlap
      if (
        (startTime < conflictEnd && endTime > conflictStart) ||
        (conflictStart < endTime && conflictEnd > startTime)
      ) {
        return {
          valid: false,
          conflict: {
            id: conflict.id,
            start_time: conflictStart,
            end_time: conflictEnd,
          },
        };
      }
    }
    
    return { valid: true };
  },
  
  /**
   * Validate table capacity for party size
   */
  async validateTableCapacity(tableId, partySize) {
    const { supabase } = require('../config/supabase');
    
    const { data: table, error } = await supabase
      .from('cafe_tables')
      .select('capacity, status')
      .eq('id', tableId)
      .single();
    
    if (error || !table) {
      throw new Error('Table not found');
    }
    
    if (table.status !== 'available') {
      return {
        valid: false,
        reason: `Table is currently ${table.status}`,
      };
    }
    
    if (partySize > table.capacity) {
      return {
        valid: false,
        reason: `Party size (${partySize}) exceeds table capacity (${table.capacity})`,
      };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate user reservation limits
   */
  async validateUserReservationLimit(userId, date) {
    const { supabase } = require('../config/supabase');
    
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('id')
      .eq('user_id', userId)
      .eq('reservation_date', date)
      .in('status', ['pending', 'confirmed']);
    
    if (error) {
      throw new Error('Failed to check user reservation limits');
    }
    
    const maxReservationsPerDay = 3;
    
    if (reservations.length >= maxReservationsPerDay) {
      return {
        valid: false,
        reason: `Maximum ${maxReservationsPerDay} reservations per day allowed`,
        current: reservations.length,
      };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate business hours
   */
  validateBusinessHours(startTime, endTime) {
    const [startHours] = startTime.split(':').map(Number);
    const [endHours] = endTime.split(':').map(Number);
    
    // Business hours: 8 AM to 10 PM
    if (startHours < 8 || endHours >= 22) {
      return {
        valid: false,
        reason: 'Reservations must be within business hours (8:00 AM - 10:00 PM)',
      };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate advance booking limits
   */
  validateAdvanceBooking(date) {
    const reservationDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (reservationDate < today) {
      return {
        valid: false,
        reason: 'Cannot make reservations for past dates',
      };
    }
    
    const maxAdvanceDays = 90; // 3 months
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays);
    
    if (reservationDate > maxDate) {
      return {
        valid: false,
        reason: `Cannot make reservations more than ${maxAdvanceDays} days in advance`,
      };
    }
    
    return { valid: true };
  },
};

/**
 * Enhanced validation result handler
 */
function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }));
    
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: formattedErrors,
    });
  }
  return null;
}

/**
 * Custom validation middleware that combines validation and business logic
 */
function validateReservation() {
  return [
    ...reservationValidation.create,
    async (req, res, next) => {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;
      
      try {
        const { table_id, reservation_date, start_time, end_time, party_size } = req.body;
        
        // Business logic validations
        const capacityCheck = await businessValidation.validateTableCapacity(table_id, party_size || 1);
        if (!capacityCheck.valid) {
          return res.status(400).json({
            error: capacityCheck.reason,
            code: 'CAPACITY_ERROR',
          });
        }
        
        const timeConflictCheck = await businessValidation.validateReservationTime(
          table_id, 
          reservation_date, 
          start_time, 
          end_time
        );
        if (!timeConflictCheck.valid) {
          return res.status(409).json({
            error: 'Time slot conflicts with existing reservation',
            code: 'TIME_CONFLICT',
            conflict: timeConflictCheck.conflict,
          });
        }
        
        const userLimitCheck = await businessValidation.validateUserReservationLimit(
          req.user.id, 
          reservation_date
        );
        if (!userLimitCheck.valid) {
          return res.status(400).json({
            error: userLimitCheck.reason,
            code: 'USER_LIMIT_ERROR',
            current: userLimitCheck.current,
          });
        }
        
        next();
      } catch (error) {
        console.error('Business validation error:', error);
        return res.status(500).json({
          error: 'Validation service error',
          code: 'VALIDATION_SERVICE_ERROR',
        });
      }
    },
  ];
}

module.exports = {
  reservationValidation,
  tableValidation,
  userValidation,
  businessValidation,
  handleValidationErrors,
  validateReservation,
}; 