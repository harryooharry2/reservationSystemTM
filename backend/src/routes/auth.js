const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { 
  verifyToken, 
  requireAdmin, 
  requireRole,
  requireOwnership,
  authRateLimit,
  logAuthEvent,
  validateSession
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

// POST /api/auth/signup - User registration with rate limiting
router.post(
  '/signup',
  [
    authRateLimit,
    logAuthEvent('SIGNUP_ATTEMPT'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').isLength({ min: 1 }).withMessage('Name is required'),
  ],
  async (req, res) => {
    const v = validate(req, res);
    if (v) return v;
    
    const { email, password, name } = req.body;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (authError) {
        logAuthEvent('SIGNUP_FAILED')(req, res, () => {});
        return res.status(400).json({ error: authError.message });
      }

      const user = authData.user;
      if (!user) {
        logAuthEvent('SIGNUP_FAILED')(req, res, () => {});
        return res.status(400).json({ error: 'Signup failed' });
      }

      // Create profile row with default role
      const { error: upsertError } = await supabaseAdmin
        .from('users')
        .upsert(
          { id: user.id, email, name, role: 'customer' },
          { onConflict: 'id' }
        );
      
      if (upsertError) {
        logAuthEvent('SIGNUP_FAILED')(req, res, () => {});
        return res.status(400).json({ error: upsertError.message });
      }

      logAuthEvent('SIGNUP_SUCCESS')(req, res, () => {});
      res.json({
        success: true,
        user: { id: user.id, email, name, role: 'customer' },
      });
    } catch (e) {
      logAuthEvent('SIGNUP_ERROR')(req, res, () => {});
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// POST /api/auth/login - User login with rate limiting
router.post(
  '/login',
  [
    authRateLimit,
    logAuthEvent('LOGIN_ATTEMPT'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const v = validate(req, res);
    if (v) return v;
    
    const { email, password } = req.body;
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        logAuthEvent('LOGIN_FAILED')(req, res, () => {});
        return res.status(401).json({ error: error.message });
      }
      
      logAuthEvent('LOGIN_SUCCESS')(req, res, () => {});
      res.json({ success: true, session: data.session, user: data.user });
    } catch (e) {
      logAuthEvent('LOGIN_ERROR')(req, res, () => {});
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// POST /api/auth/logout - User logout
router.post(
  '/logout',
  [
    verifyToken,
    logAuthEvent('LOGOUT'),
  ],
  async (req, res) => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// GET /api/auth/me - Get user profile (requires authentication)
router.get(
  '/me',
  [
    verifyToken,
    validateSession,
    logAuthEvent('PROFILE_ACCESS'),
  ],
  async (req, res) => {
    try {
      // Profile data is already attached by verifyToken middleware
      res.json({ 
        success: true, 
        profile: req.profile 
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// PATCH /api/auth/me - Update user profile (requires authentication)
router.patch(
  '/me',
  [
    verifyToken,
    validateSession,
    requireOwnership('profile'),
    logAuthEvent('PROFILE_UPDATE'),
    body('name').optional().isLength({ min: 1 }).withMessage('Name must not be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
  ],
  async (req, res) => {
    const v = validate(req, res);
    if (v) return v;
    
    try {
      const { name, email } = req.body;
      const updates = {};
      
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Use supabaseAdmin to bypass RLS for profile update
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', req.profile.id)
        .select('id, email, name, role, created_at, updated_at')
        .single();
      
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.json({ success: true, profile: data });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// POST /api/auth/refresh - Refresh access token
router.post(
  '/refresh',
  [
    authRateLimit,
    logAuthEvent('TOKEN_REFRESH'),
  ],
  async (req, res) => {
    try {
      const { refresh_token } = req.body;
      
      if (!refresh_token) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token,
      });
      
      if (error) {
        return res.status(401).json({ error: error.message });
      }

      res.json({ 
        success: true, 
        session: data.session,
        user: data.user 
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// DEV-ONLY: Create a user with email/password and confirm them
router.post(
  '/dev/create',
  [
    requireAdmin,
    logAuthEvent('DEV_USER_CREATION'),
  ],
  async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Development endpoint only' });
    }
    
    const { email, password, name, role = 'customer' } = req.body;
    
    if (!['customer', 'staff', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }
    
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Create profile entry in public.users table
      const { error: upsertError } = await supabaseAdmin
        .from('users')
        .upsert(
          { id: data.user.id, email, name, role },
          { onConflict: 'id' }
        );
      
      if (upsertError) {
        return res.status(400).json({ error: upsertError.message });
      }

      res.json({ 
        success: true, 
        user: { id: data.user.id, email, name, role } 
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// DEV-ONLY: Promote a user to admin or staff role
router.post(
  '/dev/promote',
  [
    requireAdmin,
    logAuthEvent('DEV_USER_PROMOTION'),
  ],
  async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Development endpoint only' });
    }
    
    const { userId, role } = req.body;
    
    if (!['admin', 'staff', 'customer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }
    
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('id, email, name, role, created_at, updated_at')
        .single();
      
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      
      res.json({ success: true, profile: data });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// GET /api/auth/roles - Get available roles (admin only)
router.get(
  '/roles',
  [
    requireAdmin,
    logAuthEvent('ROLES_ACCESS'),
  ],
  async (req, res) => {
    try {
      const roles = [
        { id: 'customer', name: 'Customer', description: 'Regular customer with basic access' },
        { id: 'staff', name: 'Staff', description: 'Staff member with operational access' },
        { id: 'admin', name: 'Administrator', description: 'Full system access and management' }
      ];
      
      res.json({ success: true, roles });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// GET /api/auth/users - Get all users (admin only)
router.get(
  '/users',
  [
    requireAdmin,
    logAuthEvent('USERS_LIST_ACCESS'),
  ],
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, email, name, role, created_at, updated_at')
        .order('created_at', { ascending: false });
      
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      
      res.json({ success: true, users: data });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

module.exports = router;


