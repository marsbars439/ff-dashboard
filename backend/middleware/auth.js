/**
 * Authentication Middleware
 * Handles admin and manager authentication
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const { UnauthorizedError } = require('../utils/errors');
const { AUTH } = require('../utils/constants');

// In-memory token stores (consider Redis for production)
const adminTokens = new Map(); // token -> expiry timestamp
const managerTokens = new Map(); // managerId -> { token, expiry }

// Cleanup interval to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run cleanup every hour

/**
 * Clean up expired tokens to prevent memory leaks
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  let adminCleaned = 0;
  let managerCleaned = 0;

  // Clean up expired admin tokens
  for (const [token, expiry] of adminTokens.entries()) {
    if (now > expiry) {
      adminTokens.delete(token);
      adminCleaned++;
    }
  }

  // Clean up expired manager tokens
  for (const [managerId, tokenData] of managerTokens.entries()) {
    if (now > tokenData.expiry) {
      managerTokens.delete(managerId);
      managerCleaned++;
    }
  }

  if (adminCleaned > 0 || managerCleaned > 0) {
    logger.debug('Token cleanup completed', {
      adminTokensCleaned: adminCleaned,
      managerTokensCleaned: managerCleaned,
      adminTokensRemaining: adminTokens.size,
      managerTokensRemaining: managerTokens.size
    });
  }
}

// Start cleanup interval
const cleanupInterval = setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL_MS);

// Ensure cleanup interval doesn't prevent process from exiting
cleanupInterval.unref();

/**
 * Generate a random token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Check if admin token is valid
 */
function isAdminTokenValid(token) {
  if (!token) return false;

  const expiry = adminTokens.get(token);
  if (!expiry) return false;

  if (Date.now() > expiry) {
    adminTokens.delete(token);
    return false;
  }

  return true;
}

/**
 * Check if manager token is valid
 */
function isManagerTokenValid(managerId, token) {
  if (!managerId || !token) return false;

  const tokenData = managerTokens.get(managerId);
  if (!tokenData || tokenData.token !== token) return false;

  if (Date.now() > tokenData.expiry) {
    managerTokens.delete(managerId);
    return false;
  }

  return true;
}

/**
 * Create admin token
 */
function createAdminToken() {
  const token = generateToken();
  const expiry = Date.now() + AUTH.ADMIN_TOKEN_TTL_MS;
  adminTokens.set(token, expiry);

  logger.info('Admin token created', { expiresIn: `${AUTH.ADMIN_TOKEN_TTL_MS}ms` });

  return { token, expiry };
}

/**
 * Create manager token
 */
function createManagerToken(managerId) {
  const token = generateToken();
  const expiry = Date.now() + AUTH.MANAGER_TOKEN_TTL_MS;
  managerTokens.set(managerId, { token, expiry });

  logger.info('Manager token created', { managerId, expiresIn: `${AUTH.MANAGER_TOKEN_TTL_MS}ms` });

  return { token, expiry };
}

/**
 * Revoke admin token
 */
function revokeAdminToken(token) {
  adminTokens.delete(token);
  logger.info('Admin token revoked');
}

/**
 * Revoke manager token
 */
function revokeManagerToken(managerId) {
  managerTokens.delete(managerId);
  logger.info('Manager token revoked', { managerId });
}

/**
 * Verify manager passcode hash
 */
function verifyManagerPasscodeHash(passcode, storedHash) {
  if (!storedHash || !passcode) {
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [salt, hashHex] = parts;
  if (!salt || !hashHex) {
    return false;
  }

  try {
    const derived = crypto.scryptSync(passcode, salt, 64);
    const storedBuffer = Buffer.from(hashHex, 'hex');

    if (storedBuffer.length !== derived.length) {
      return false;
    }

    return crypto.timingSafeEqual(derived, storedBuffer);
  } catch (error) {
    logger.error('Failed to verify manager passcode hash', { error: error.message });
    return false;
  }
}

/**
 * Middleware: Require admin authentication
 */
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];

  if (!token || !isAdminTokenValid(token)) {
    logger.warn('Unauthorized admin access attempt', {
      path: req.path,
      ip: req.ip
    });
    return next(new UnauthorizedError('Admin authentication required'));
  }

  next();
}

/**
 * Middleware: Require manager authentication
 */
async function requireManager(req, res, next) {
  const managerId = req.headers['x-manager-id'];
  const token = req.headers['x-manager-token'];

  if (!managerId || !token) {
    logger.warn('Manager authentication missing', { path: req.path });
    return next(new UnauthorizedError('Manager authentication required'));
  }

  if (!isManagerTokenValid(managerId, token)) {
    logger.warn('Invalid manager token', { managerId, path: req.path });
    return next(new UnauthorizedError('Invalid or expired manager token'));
  }

  try {
    const { getAsync } = req.db;
    const manager = await getAsync(
      'SELECT name_id, full_name FROM managers WHERE name_id = ?',
      [managerId]
    );

    if (!manager) {
      return next(new UnauthorizedError('Invalid manager'));
    }

    // Attach manager to request
    req.manager = manager;
    next();
  } catch (error) {
    logger.error('Error verifying manager authentication', {
      managerId,
      error: error.message
    });
    next(error);
  }
}

/**
 * Middleware: Optional manager authentication
 * Attaches manager to req if authenticated, but doesn't require it
 */
async function optionalManager(req, res, next) {
  const managerId = req.headers['x-manager-id'];
  const token = req.headers['x-manager-token'];

  if (!managerId || !token || !isManagerTokenValid(managerId, token)) {
    return next();
  }

  try {
    const { getAsync } = req.db;
    const manager = await getAsync(
      'SELECT name_id, full_name FROM managers WHERE name_id = ?',
      [managerId]
    );

    if (manager) {
      req.manager = manager;
    }
  } catch (error) {
    logger.error('Error in optional manager auth', { error: error.message });
  }

  next();
}

module.exports = {
  generateToken,
  isAdminTokenValid,
  isManagerTokenValid,
  createAdminToken,
  createManagerToken,
  revokeAdminToken,
  revokeManagerToken,
  verifyManagerPasscodeHash,
  requireAdmin,
  requireManager,
  optionalManager
};
