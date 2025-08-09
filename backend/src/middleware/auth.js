const { supabase, supabaseAdmin } = require('../config/supabase');

async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: error?.message || 'Invalid token' });

    req.user = user;

    // Use admin client to fetch profile reliably (bypasses RLS while on server)
    const { data: profile, error: pErr } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role')
      .eq('id', user.id)
      .single();
    if (pErr) return res.status(401).json({ error: pErr.message });

    req.profile = profile;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Internal error', details: e.message });
  }
}

function requireAdmin(req, res, next) {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required' });
  }
  next();
}

module.exports = { verifyToken, requireAdmin };

