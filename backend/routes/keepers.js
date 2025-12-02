/**
 * Keeper Routes
 */

const express = require('express');
const router = express.Router();
const keeperController = require('../controllers/keeperController');
const { requireAdmin, requireManager } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  getKeepersByYear,
  saveKeepers,
  getKeeperTradeLock,
  updateKeeperTradeLock
} = require('../validators/keeperSchemas');

// Get keeper trade lock status
router.get('/trade-lock/:year', validate(getKeeperTradeLock), keeperController.getKeeperTradeLock);

// Update keeper trade lock (admin only)
router.put('/trade-lock/:year', requireAdmin, validate(updateKeeperTradeLock), keeperController.updateKeeperTradeLock);

// Get keepers for a year
router.get('/:year', validate(getKeepersByYear), keeperController.getKeepersByYear);

// Save keeper selections (requires manager auth)
router.post('/:year/:rosterId', requireManager, validate(saveKeepers), keeperController.saveKeepers);

module.exports = router;
