const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');

const router = express.Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ error: 'Validation failed', details: errors.array() });
  }
}

// Signup: creates auth user and a profile row with default role 'customer'
router.post(
  '/signup',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('name').isLength({ min: 1 }),
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
      if (authError) return res.status(400).json({ error: authError.message });

      const user = authData.user;
      if (!user) return res.status(400).json({ error: 'Signup failed' });

      // Create profile row with default role
      const { error: upsertError } = await supabaseAdmin
        .from('users')
        .upsert(
          { id: user.id, email, name, role: 'customer' },
          { onConflict: 'id' }
        );
      if (upsertError)
        return res.status(400).json({ error: upsertError.message });

      res.json({
        success: true,
        user: { id: user.id, email, name, role: 'customer' },
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// Login: Supabase client session exchange (email/password)
router.post(
  '/login',
  [body('email').isEmail(), body('password').isLength({ min: 6 })],
  async (req, res) => {
    const v = validate(req, res);
    if (v) return v;
    const { email, password } = req.body;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return res.status(401).json({ error: error.message });
      res.json({ success: true, session: data.session, user: data.user });
    } catch (e) {
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  }
);

// Get profile (requires bearer token from client)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser(token);
    if (getUserError || !user)
      return res
        .status(401)
        .json({ error: getUserError?.message || 'Invalid token' });

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('id', user.id)
      .single();
    if (profileErr) return res.status(400).json({ error: profileErr.message });

    res.json({ success: true, profile });
  } catch (e) {
    res.status(500).json({ error: 'Internal error', details: e.message });
  }
});

// Update profile (name only for now)
router.patch('/me', [body('name').isLength({ min: 1 })], async (req, res) => {
  const v = validate(req, res);
  if (v) return v;
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser(token);
    if (getUserError || !user)
      return res
        .status(401)
        .json({ error: getUserError?.message || 'Invalid token' });

    const { name } = req.body;
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ name })
      .eq('id', user.id)
      .select('id, email, name, role')
      .single();
    if (error) return res.status(400).json({ error: error.message });

    res.json({ success: true, profile: data });
  } catch (e) {
    res.status(500).json({ error: 'Internal error', details: e.message });
  }
});

module.exports = router;

// Development-only: promote a user role (requires ADMIN_SECRET)
// POST /api/auth/dev/promote { email, role }
if (process.env.NODE_ENV !== 'production') {
  // Create user via admin API (email confirmed), for local/dev testing
  // POST /api/auth/dev/create { email, password, name }
  router.post('/dev/create', async (req, res) => {
    try {
      const adminSecret = req.headers['x-admin-secret'];
      if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { email, password, name } = req.body || {};
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'email, password, name required' });
      }

      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (cErr) return res.status(400).json({ error: cErr.message });

      const user = created.user;
      if (!user) return res.status(400).json({ error: 'Create user failed' });

      const { error: upErr } = await supabaseAdmin
        .from('users')
        .upsert({ id: user.id, email, name, role: 'customer' }, { onConflict: 'id' });
      if (upErr) return res.status(400).json({ error: upErr.message });

      return res.json({ success: true, user: { id: user.id, email, name, role: 'customer' } });
    } catch (e) {
      return res.status(500).json({ error: 'Internal error', details: e.message });
    }
  });

  router.post('/dev/promote', async (req, res) => {
    try {
      const adminSecret = req.headers['x-admin-secret'];
      if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { email, role } = req.body || {};
      if (!email || !['customer', 'staff', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'email and valid role required' });
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ role })
        .eq('email', email)
        .select('id, email, name, role')
        .single();

      if (error) return res.status(400).json({ error: error.message });

      return res.json({ success: true, profile: data });
    } catch (e) {
      return res.status(500).json({ error: 'Internal error', details: e.message });
    }
  });
}


