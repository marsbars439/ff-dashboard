/**
 * Manager Controller (Prisma Version)
 * Handles all manager-related operations using Prisma ORM
 */

const prisma = require('../services/prisma');
const logger = require('../utils/logger');
const { NotFoundError, ConflictError } = require('../utils/errors');

/**
 * Get all managers with their emails
 */
async function getAllManagers(req, res, next) {
  try {
    const managers = await prisma.managers.findMany({
      orderBy: { full_name: 'asc' },
      include: {
        manager_emails: {
          orderBy: { is_primary: 'desc' }
        }
      }
    });

    // Transform to match legacy format with emails array
    const managersWithEmails = managers.map(manager => ({
      ...manager,
      emails: manager.manager_emails.map(e => e.email),
      active: manager.active ? 1 : 0
    }));

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
    const { managerId } = req.params;

    const manager = await prisma.managers.findUnique({
      where: { name_id: managerId },
      include: {
        manager_emails: true,
        team_seasons: {
          orderBy: { year: 'desc' }
        }
      }
    });

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
 * Create a new manager with emails
 */
async function createManager(req, res, next) {
  try {
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

    // Create manager with emails in a transaction
    const newManager = await prisma.$transaction(async (tx) => {
      const manager = await tx.managers.create({
        data: {
          name_id,
          full_name,
          sleeper_username: sleeper_username || '',
          sleeper_user_id: sleeper_user_id || '',
          email: primaryEmail,
          active: active != null ? Boolean(active) : true
        }
      });

      // Insert emails
      if (managerEmails.length > 0) {
        for (let i = 0; i < managerEmails.length; i++) {
          await tx.manager_emails.create({
            data: {
              manager_id: manager.id,
              email: managerEmails[i],
              is_primary: i === 0 ? 1 : 0
            }
          });
        }
      }

      // Fetch with emails
      return await tx.managers.findUnique({
        where: { id: manager.id },
        include: {
          manager_emails: {
            orderBy: { is_primary: 'desc' }
          }
        }
      });
    });

    logger.info('Manager created', { managerId: name_id, id: newManager.id });
    res.json({ message: 'Manager added successfully', manager: newManager });
  } catch (error) {
    if (error.code === 'P2002') {
      // Prisma unique constraint violation
      const target = error.meta?.target;
      if (target?.includes('email')) {
        return res.status(409).json({ error: 'Email address is already assigned to another manager' });
      }
      return res.status(409).json({ error: `Manager with ID ${req.body.name_id} already exists` });
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
    const { managerId } = req.params;
    const { fullName, sleeperUsername, sleeperUserId, passcode } = req.body;

    // Check if manager exists
    const existing = await prisma.managers.findUnique({
      where: { name_id: managerId }
    });

    if (!existing) {
      throw new NotFoundError(`Manager with ID ${managerId} not found`);
    }

    // Build update data
    const updateData = {};

    if (fullName !== undefined) {
      updateData.full_name = fullName;
    }

    if (sleeperUsername !== undefined) {
      updateData.sleeper_username = sleeperUsername;
    }

    if (sleeperUserId !== undefined) {
      updateData.sleeper_user_id = sleeperUserId;
    }

    if (passcode) {
      const crypto = require('crypto');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(passcode, salt, 64).toString('hex');
      updateData.passcode = `${salt}:${hash}`;
    }

    if (Object.keys(updateData).length === 0) {
      return res.json({ message: 'No updates provided' });
    }

    const updatedManager = await prisma.managers.update({
      where: { name_id: managerId },
      data: updateData
    });

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
    const { managerId } = req.params;

    // Check if manager exists
    const existing = await prisma.managers.findUnique({
      where: { name_id: managerId }
    });

    if (!existing) {
      throw new NotFoundError(`Manager with ID ${managerId} not found`);
    }

    await prisma.managers.delete({
      where: { name_id: managerId }
    });

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
