const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const {
  verifyToken,
  requireAdmin,
  requireRole,
  requireOwnership,
  logAuthEvent,
  validateSession,
  authRateLimit,
  clearAuthRateLimit,
} = require('../middleware/auth');
const {
  loginValidation,
  signupValidation,
  handleValidationErrors,
  generateTokens,
  verifyToken: verifyJWTToken,
  blacklistToken,
} = require('../middleware/security');
const { body } = require('express-validator');
const { checkTokenBlacklist } = require('../middleware/tokenBlacklist');
const securityConfig = require('../config/security');

const router = express.Router();

// Enhanced validation function using security middleware
function validate(req, res) {
  return handleValidationErrors(req, res, () => {});
}

// POST /api/auth/signup - User registration with enhanced security
router.post(
  '/signup',
  [
    checkTokenBlacklist,
    logAuthEvent('SIGNUP_ATTEMPT'),
    ...signupValidation,
    handleValidationErrors,
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

// POST /api/auth/login - User login with enhanced security
router.post(
  '/login',
  [
    checkTokenBlacklist,
    logAuthEvent('LOGIN_ATTEMPT'),
    ...loginValidation,
    handleValidationErrors,
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

      // Generate JWT tokens
      const tokens = generateTokens(data.user);

      // Set secure httpOnly cookies
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: securityConfig.cookies.httpOnly,
        secure: securityConfig.cookies.secure,
        sameSite: securityConfig.cookies.sameSite,
        maxAge: securityConfig.cookies.maxAge.accessToken,
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: securityConfig.cookies.httpOnly,
        secure: securityConfig.cookies.secure,
        sameSite: securityConfig.cookies.sameSite,
        maxAge: securityConfig.cookies.maxAge.refreshToken,
      });

      logAuthEvent('LOGIN_SUCCESS')(req, res, () => {});
      res.json({
        success: true,
        session: data.session,
        user: data.user,
        message: 'Login successful. Tokens set in secure cookies.',
      });
    } catch (e) {
      logAuthEvent('LOGIN_ERROR')(req, res, () => {});
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// POST /api/auth/logout - User logout with token blacklisting
router.post(
  '/logout',
  [verifyToken, checkTokenBlacklist, logAuthEvent('LOGOUT')],
  async (req, res) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        blacklistToken(token);
      }

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logged out successfully. Token blacklisted.',
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// GET /api/auth/me - Get user profile (requires authentication)
router.get(
  '/me',
  [verifyToken, validateSession, logAuthEvent('PROFILE_ACCESS')],
  async (req, res) => {
    try {
      // Profile data is already attached by verifyToken middleware
      res.json({
        success: true,
        profile: req.profile,
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// POST /api/auth/refresh - Refresh access token
router.post(
  '/refresh',
  [checkTokenBlacklist, logAuthEvent('TOKEN_REFRESH')],
  async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token not found' });
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Get user data from Supabase
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Generate new tokens
      const tokens = generateTokens(user);

      // Set new secure cookies
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: securityConfig.cookies.httpOnly,
        secure: securityConfig.cookies.secure,
        sameSite: securityConfig.cookies.sameSite,
        maxAge: securityConfig.cookies.maxAge.accessToken,
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: securityConfig.cookies.httpOnly,
        secure: securityConfig.cookies.secure,
        sameSite: securityConfig.cookies.sameSite,
        maxAge: securityConfig.cookies.maxAge.refreshToken,
      });

      res.json({
        success: true,
        message: 'Tokens refreshed successfully',
        user: { id: user.id, email: user.email },
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
    checkTokenBlacklist,
    validateSession,
    requireOwnership('profile'),
    logAuthEvent('PROFILE_UPDATE'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
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
  [authRateLimit, logAuthEvent('TOKEN_REFRESH')],
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
        user: data.user,
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// DEV-ONLY: Create a user with email/password and confirm them
router.post(
  '/dev/create',
  [requireAdmin, logAuthEvent('DEV_USER_CREATION')],
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
        .upsert({ id: data.user.id, email, name, role }, { onConflict: 'id' });

      if (upsertError) {
        return res.status(400).json({ error: upsertError.message });
      }

      res.json({
        success: true,
        user: { id: data.user.id, email, name, role },
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// DEV-ONLY: Promote a user to admin or staff role
router.post(
  '/dev/promote',
  [requireAdmin, logAuthEvent('DEV_USER_PROMOTION')],
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
  [requireAdmin, logAuthEvent('ROLES_ACCESS')],
  async (req, res) => {
    try {
      const roles = [
        {
          id: 'customer',
          name: 'Customer',
          description: 'Regular customer with basic access',
        },
        {
          id: 'staff',
          name: 'Staff',
          description: 'Staff member with operational access',
        },
        {
          id: 'admin',
          name: 'Administrator',
          description: 'Full system access and management',
        },
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
  [requireAdmin, logAuthEvent('USERS_LIST_ACCESS')],
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

// DEV-ONLY: Clear rate limit cache
router.post(
  '/dev/clear-rate-limit',
  [logAuthEvent('RATE_LIMIT_CLEAR')],
  async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Development endpoint only' });
    }

    const { clientIP } = req.body;
    clearAuthRateLimit(clientIP);

    res.json({
      success: true,
      message: clientIP
        ? `Rate limit cleared for ${clientIP}`
        : 'All rate limits cleared',
    });
  }
);

module.exports = router;
