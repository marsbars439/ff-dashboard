/**
 * Manager Controller
 * Handles all manager-related operations
 */

const logger = require('../utils/logger');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { hydrateManagersWithEmails } = require('../services/managerService');

/**
 * Get all managers
 */
async function getAllManagers(req, res, next) {
  try {
    const { allAsync } = req.db;
    const managers = await allAsync('SELECT * FROM managers ORDER BY full_name');
    const managersWithEmails = await hydrateManagersWithEmails(managers, req.db);
    res.json({ managers: managersWithEmails });
  } catch (error) {
    logger.error('Error fetching managers', { error: error.message });
    next(error);
  }
}

/**
 * Get manager by ID
 */
async function getManagerById(req, res, next) {
  try {
    const { getAsync } = req.db;
    const { managerId } = req.params;

    const manager = await getAsync('SELECT * FROM managers WHERE name_id = ?', [managerId]);

    if (!manager) {
      throw new NotFoundError(`Manager with ID ${managerId} not found`);
    }

    res.json(manager);
  } catch (error) {
    logger.error('Error fetching manager', { managerId: req.params.managerId, error: error.message });
    next(error);
  }
}

/**
 * Create a new manager
 */
async function createManager(req, res, next) {
  try {
    const { runAsync, getAsync } = req.db;
    const { nameId, fullName, sleeperUsername, sleeperUserId, passcode } = req.body;

    // Check if manager already exists
    const existing = await getAsync('SELECT id FROM managers WHERE name_id = ?', [nameId]);
    if (existing) {
      throw new ConflictError(`Manager with ID ${nameId} already exists`);
    }

    // Hash passcode if provided
    let hashedPasscode = null;
    if (passcode) {
      const crypto = require('crypto');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(passcode, salt, 64).toString('hex');
      hashedPasscode = `${salt}:${hash}`;
    }

    const result = await runAsync(
      'INSERT INTO managers (name_id, full_name, sleeper_username, sleeper_user_id, passcode) VALUES (?, ?, ?, ?, ?)',
      [nameId, fullName, sleeperUsername || null, sleeperUserId || null, hashedPasscode]
    );

    const newManager = await getAsync('SELECT * FROM managers WHERE id = ?', [result.lastID]);

    logger.info('Manager created', { managerId: nameId, id: result.lastID });
    res.status(201).json(newManager);
  } catch (error) {
    logger.error('Error creating manager', { error: error.message, body: req.body });
    next(error);
  }
}

/**
 * Update a manager
 */
async function updateManager(req, res, next) {
  try {
    const { runAsync, getAsync } = req.db;
    const { managerId } = req.params;
    const { fullName, sleeperUsername, sleeperUserId, passcode } = req.body;

    // Check if manager exists
    const existing = await getAsync('SELECT id FROM managers WHERE name_id = ?', [managerId]);
    if (!existing) {
      throw new NotFoundError(`Manager with ID ${managerId} not found`);
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (fullName !== undefined) {
      updates.push('full_name = ?');
      values.push(fullName);
    }

    if (sleeperUsername !== undefined) {
      updates.push('sleeper_username = ?');
      values.push(sleeperUsername);
    }

    if (sleeperUserId !== undefined) {
      updates.push('sleeper_user_id = ?');
      values.push(sleeperUserId);
    }

    if (passcode) {
      const crypto = require('crypto');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(passcode, salt, 64).toString('hex');
      updates.push('passcode = ?');
      values.push(`${salt}:${hash}`);
    }

    if (updates.length === 0) {
      return res.json({ message: 'No updates provided' });
    }

    values.push(managerId);

    await runAsync(
      `UPDATE managers SET ${updates.join(', ')} WHERE name_id = ?`,
      values
    );

    const updatedManager = await getAsync('SELECT * FROM managers WHERE name_id = ?', [managerId]);

    logger.info('Manager updated', { managerId });
    res.json(updatedManager);
  } catch (error) {
    logger.error('Error updating manager', { managerId: req.params.managerId, error: error.message });
    next(error);
  }
}

/**
 * Delete a manager
 */
async function deleteManager(req, res, next) {
  try {
    const { runAsync, getAsync } = req.db;
    const { managerId } = req.params;

    // Check if manager exists
    const existing = await getAsync('SELECT id FROM managers WHERE name_id = ?', [managerId]);
    if (!existing) {
      throw new NotFoundError(`Manager with ID ${managerId} not found`);
    }

    await runAsync('DELETE FROM managers WHERE name_id = ?', [managerId]);

    logger.info('Manager deleted', { managerId });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting manager', { managerId: req.params.managerId, error: error.message });
    next(error);
  }
}

module.exports = {
  getAllManagers,
  getManagerById,
  createManager,
  updateManager,
  deleteManager
};
