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
    const { name_id, full_name, sleeper_username, sleeper_user_id, active, emails, email } = req.body;

    if (!name_id || !full_name) {
      return res.status(400).json({ error: 'name_id and full_name are required' });
    }

    // Collect and validate emails
    const collectManagerEmails = (payload) => {
      const emailsInput = payload.emails;
      const fallbackEmail = typeof payload.email === 'string' ? payload.email : null;
      const candidates = [];
      if (Array.isArray(emailsInput)) candidates.push(...emailsInput);
      if (typeof fallbackEmail === 'string') candidates.push(fallbackEmail);

      const sanitized = [];
      const seen = new Set();
      for (const candidate of candidates) {
        const normalized = typeof candidate === 'string' ? candidate.trim().toLowerCase() : '';
        if (seen.has(normalized) || !normalized) continue;
        seen.add(normalized);
        sanitized.push(normalized);
      }
      return sanitized;
    };

    const isValidEmailFormat = (email) => {
      if (typeof email !== 'string') return false;
      const trimmed = email.trim();
      if (!trimmed) return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    };

    const managerEmails = collectManagerEmails(req.body);
    const primaryEmail = managerEmails[0] || '';

    const invalidEmail = managerEmails.find(e => !isValidEmailFormat(e));
    if (invalidEmail) {
      return res.status(400).json({ error: `Invalid email address: ${invalidEmail}` });
    }

    await runAsync('BEGIN TRANSACTION');

    const insertResult = await runAsync(
      'INSERT INTO managers (name_id, full_name, sleeper_username, sleeper_user_id, email, active) VALUES (?, ?, ?, ?, ?, ?)',
      [name_id, full_name, sleeper_username || '', sleeper_user_id || '', primaryEmail, active != null ? active : 1]
    );

    const managerId = insertResult.lastID;

    // Insert emails
    if (managerEmails.length > 0) {
      let insertedCount = 0;
      for (const emailAddr of managerEmails) {
        await runAsync(
          'INSERT INTO manager_emails (manager_id, email, is_primary) VALUES (?, ?, ?)',
          [managerId, emailAddr, insertedCount === 0 ? 1 : 0]
        );
        insertedCount++;
      }
    }

    await runAsync('COMMIT');

    const { allAsync } = req.db;
    const managers = await allAsync('SELECT * FROM managers WHERE id = ?', [managerId]);
    const [newManager] = await hydrateManagersWithEmails(managers, req.db);

    logger.info('Manager created', { managerId: name_id, id: managerId });
    res.json({ message: 'Manager added successfully', manager: newManager });
  } catch (error) {
    try {
      await req.db.runAsync('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors
    }

    if (error?.message && error.message.includes('manager_emails.email')) {
      return res.status(409).json({ error: 'Email address is already assigned to another manager' });
    }

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
