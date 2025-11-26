/**
 * Manager Routes
 */

const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const seasonController = require('../controllers/seasonController');
const { requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { createManager, updateManager } = require('../validators/seasonSchemas');

// Get all managers
router.get('/', managerController.getAllManagers);

// Get manager's seasons (migrated from server.js) - MUST come before /:managerId
router.get('/:nameId/seasons', seasonController.getManagerSeasons);

// Get manager by ID
router.get('/:managerId', managerController.getManagerById);

// Create new manager (admin only)
router.post('/', requireAdmin, validate(createManager), managerController.createManager);

// Update manager (admin only)
router.put('/:managerId', requireAdmin, validate(updateManager), managerController.updateManager);

// Delete manager (admin only)
router.delete('/:managerId', requireAdmin, managerController.deleteManager);

module.exports = router;
