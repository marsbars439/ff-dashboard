/**
 * Stats Routes
 * Routes for league statistics and health check
 */

const express = require('express');
const statsController = require('../controllers/statsController');

/**
 * Create stats router
 */
function createStatsRouter() {
  const router = express.Router();

  // GET /api/stats - Get league statistics
  router.get('/stats', statsController.getStats);

  // GET /api/health - Health check
  router.get('/health', statsController.getHealth);

  return router;
}

module.exports = { createStatsRouter };
