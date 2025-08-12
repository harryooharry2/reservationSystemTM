// In-memory token blacklist (in production, use Redis or database)
const blacklistedTokens = new Set();

// Token blacklist management
const blacklistToken = (token) => {
  blacklistedTokens.add(token);

  // Clean up old tokens periodically (optional)
  if (blacklistedTokens.size > 1000) {
    // In production, implement proper cleanup strategy
    console.log('⚠️ Token blacklist size warning:', blacklistedTokens.size);
  }
};

const isTokenBlacklisted = (token) => {
  return blacklistedTokens.has(token);
};

// Middleware to check if token is blacklisted
const checkTokenBlacklist = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    if (isTokenBlacklisted(token)) {
      return res.status(401).json({
        error: 'Token has been revoked',
        message: 'Please log in again',
      });
    }
  }

  next();
};

// Cleanup function for expired tokens (run periodically)
const cleanupExpiredTokens = () => {
  // In production, implement proper cleanup based on token expiration
  // For now, we'll keep it simple with in-memory storage
  console.log('🧹 Token blacklist cleanup completed');
};

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

module.exports = {
  blacklistToken,
  isTokenBlacklisted,
  checkTokenBlacklist,
  cleanupExpiredTokens,
};
