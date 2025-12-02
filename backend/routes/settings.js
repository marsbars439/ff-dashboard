/**
 * Settings Routes
 * Routes for league settings
 */

const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { requireAdmin } = require('../middleware/auth');

// GET /api/league-settings - Get all league settings
router.get('/league-settings', settingsController.getAllSettings);

// PUT /api/league-settings/:year - Update league ID for year (admin only)
router.put('/league-settings/:year', requireAdmin, settingsController.updateLeagueId);

// POST /api/league-settings/:year/manual-complete - Mark season as complete (admin only)
router.post('/league-settings/:year/manual-complete', requireAdmin, settingsController.setManualComplete);

module.exports = router;
