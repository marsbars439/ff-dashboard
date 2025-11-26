/**
 * Sleeper IDs Routes
 * Routes for manager-sleeper ID mappings
 */

const express = require('express');
const router = express.Router();
const sleeperIdsController = require('../controllers/sleeperIdsController');
const { requireAdmin } = require('../middleware/auth');

// GET /api/manager-sleeper-ids - Get all mappings
router.get('/manager-sleeper-ids', sleeperIdsController.getAllMappings);

// POST /api/manager-sleeper-ids - Create mapping (admin only)
router.post('/manager-sleeper-ids', requireAdmin, sleeperIdsController.createMapping);

// PUT /api/manager-sleeper-ids/:id - Update mapping (admin only)
router.put('/manager-sleeper-ids/:id', requireAdmin, sleeperIdsController.updateMapping);

// DELETE /api/manager-sleeper-ids/:id - Delete mapping (admin only)
router.delete('/manager-sleeper-ids/:id', requireAdmin, sleeperIdsController.deleteMapping);

module.exports = router;
