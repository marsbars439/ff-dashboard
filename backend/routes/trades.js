/**
 * Trades Routes
 * Routes for manual trades
 */

const express = require('express');
const router = express.Router();
const tradesController = require('../controllers/tradesController');
const { requireAdmin } = require('../middleware/auth');

// GET /api/trades/:year - Get all trades for year
router.get('/trades/:year', tradesController.getTradesByYear);

// POST /api/trades - Create new trade (admin only)
router.post('/trades', requireAdmin, tradesController.createTrade);

// DELETE /api/trades/:id - Delete trade (admin only)
router.delete('/trades/:id', requireAdmin, tradesController.deleteTrade);

module.exports = router;
