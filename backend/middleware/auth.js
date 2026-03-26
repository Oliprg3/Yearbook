const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Simple token blacklist (for logout)
const tokenBlacklist = new Set();

const logger = {
  info: (...args) => console.log(`[${new Date().toISOString()}] INFO:`, ...args),
  warn: (...args) => console.warn(`[${new Date().toISOString()}] WARN:`, ...args),
  error: (...args) => console.error(`[${new Date().toISOString()}] ERROR:`, ...args)
};

const auth = async (req, res, next) => {
  try {
    // Extract token
    const authHeader = req.header('Authorization');
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = req.header('x-auth-token');
    }

    if (!token) {
      logger.warn(`Unauthorized access attempt - IP: ${req.ip}`);
      return res.status(401).json({ msg: 'No token, authorization denied', code: 'MISSING_TOKEN' });
    }

    // Check blacklist
    if (tokenBlacklist.has(token)) {
      logger.warn(`Blacklisted token used - IP: ${req.ip}`);
      return res.status(401).json({ msg: 'Token revoked, please login again', code: 'TOKEN_REVOKED' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ msg: 'Token expired', code: 'TOKEN_EXPIRED' });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ msg: 'Invalid token', code: 'INVALID_TOKEN' });
      }
      throw err;
    }

    req.user = { id: decoded.user.id };

    // Optionally attach full user object
    if (process.env.ATTACH_FULL_USER === 'true') {
      const user = await User.findById(decoded.user.id).select('-password');
      if (!user) return res.status(401).json({ msg: 'User not found', code: 'USER_NOT_FOUND' });
      req.user.full = user;
    }

    logger.info(`Authenticated user: ${decoded.user.id} - IP: ${req.ip}`);
    next();
  } catch (err) {
    logger.error(`Auth middleware error: ${err.message}`);
    res.status(500).json({ msg: 'Server error during authentication', code: 'AUTH_SERVER_ERROR' });
  }
};

auth.blacklistToken = (token) => {
  if (token) tokenBlacklist.add(token);
  logger.info(`Token blacklisted: ${token?.substring(0, 20)}...`);
};

module.exports = auth;