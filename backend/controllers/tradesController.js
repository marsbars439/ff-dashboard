/**
 * Trades Controller
 * Handles manual trade operations
 */

const logger = require('../utils/logger');

/**
 * Get all trades for a specific year
 */
async function getTradesByYear(req, res, next) {
  try {
    const { allAsync } = req.db;
    const year = parseInt(req.params.year);

    const trades = await allAsync(
      'SELECT id, year, from_roster_id, to_roster_id, amount, description FROM manual_trades WHERE year = ?',
      [year]
    );

    res.json({ trades });
  } catch (error) {
    logger.error('Error fetching trades', { year: req.params.year, error: error.message });
    next(error);
  }
}

/**
 * Create a new trade
 */
async function createTrade(req, res, next) {
  try {
    const { runAsync } = req.db;
    const { year, from_roster_id, to_roster_id, amount, description } = req.body;

    if (
      year == null ||
      from_roster_id == null ||
      to_roster_id == null ||
      amount == null
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await runAsync(
      'INSERT INTO manual_trades (year, from_roster_id, to_roster_id, amount, description) VALUES (?, ?, ?, ?, ?)',
      [year, from_roster_id, to_roster_id, amount, description || null]
    );

    logger.info('Trade created', { id: result.lastID, year });
    res.json({ id: result.lastID });
  } catch (error) {
    logger.error('Error creating trade', { error: error.message });
    next(error);
  }
}

/**
 * Delete a trade
 */
async function deleteTrade(req, res, next) {
  try {
    const { runAsync } = req.db;
    const id = parseInt(req.params.id);

    await runAsync('DELETE FROM manual_trades WHERE id = ?', [id]);

    logger.info('Trade deleted', { id });
    res.json({ message: 'Trade deleted' });
  } catch (error) {
    logger.error('Error deleting trade', { id: req.params.id, error: error.message });
    next(error);
  }
}

module.exports = {
  getTradesByYear,
  createTrade,
  deleteTrade
};
