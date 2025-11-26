/**
 * Rankings Routes
 * Routes for ROS rankings
 */

const express = require('express');
const router = express.Router();
const rankingsController = require('../controllers/rankingsController');
const { requireAdmin } = require('../middleware/auth');

// GET /api/ros-rankings - Get all ROS rankings
router.get('/ros-rankings', rankingsController.getRankings);

// POST /api/ros-rankings/refresh - Refresh rankings from FantasyPros (admin only)
router.post('/ros-rankings/refresh', requireAdmin, rankingsController.refreshRankings);

module.exports = router;
