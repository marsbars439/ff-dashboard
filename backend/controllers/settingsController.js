/**
 * Settings Controller
 * Handles league settings operations
 */

const logger = require('../utils/logger');

/**
 * Get all league settings
 */
async function getAllSettings(req, res, next) {
  try {
    const { allAsync } = req.db;

    const settings = await allAsync(`
      SELECT
        ls.year,
        ls.league_id,
        ls.created_at,
        ls.updated_at,
        ktl.locked AS keeper_locked,
        ktl.locked_at AS keeper_locked_at,
        ktl.updated_at AS keeper_lock_updated_at,
        rcv.locked AS voting_locked,
        rcv.locked_at AS voting_locked_at,
        rcv.updated_at AS voting_lock_updated_at
      FROM league_settings ls
      LEFT JOIN keeper_trade_locks ktl ON ktl.season_year = ls.year
      LEFT JOIN rule_change_voting_locks rcv ON rcv.season_year = ls.year
      ORDER BY ls.year DESC
    `);

    res.json({ settings });
  } catch (error) {
    logger.error('Error fetching league settings', { error: error.message });
    next(error);
  }
}

/**
 * Update league ID for a specific year
 */
async function updateLeagueId(req, res, next) {
  try {
    const { runAsync } = req.db;
    const year = req.params.year;
    const { league_id } = req.body;

    await runAsync(`
      INSERT INTO league_settings (year, league_id, manual_complete, updated_at)
      VALUES (?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(year)
      DO UPDATE SET
        league_id = excluded.league_id,
        manual_complete = CASE
          WHEN excluded.league_id IS NOT NULL AND TRIM(excluded.league_id) != '' THEN 0
          ELSE league_settings.manual_complete
        END,
        updated_at = CURRENT_TIMESTAMP
    `, [year, league_id]);

    logger.info('League ID updated', { year, league_id });
    res.json({
      message: 'League ID updated successfully',
      year,
      league_id
    });
  } catch (error) {
    logger.error('Error updating league ID', { year: req.params.year, error: error.message });
    next(error);
  }
}

/**
 * Mark season as manually complete
 */
async function setManualComplete(req, res, next) {
  try {
    const { runAsync } = req.db;
    const year = parseInt(req.params.year, 10);
    const { complete } = req.body || {};

    if (!Number.isInteger(year)) {
      return res.status(400).json({ error: 'Invalid year provided' });
    }

    const normalizedComplete = complete ? 1 : 0;

    await runAsync(`
      INSERT INTO league_settings (year, manual_complete, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(year)
      DO UPDATE SET
        manual_complete = excluded.manual_complete,
        updated_at = CURRENT_TIMESTAMP
    `, [year, normalizedComplete]);

    logger.info('Manual complete status updated', { year, complete: normalizedComplete });
    res.json({
      message: normalizedComplete ? 'Season marked complete' : 'Season reopened',
      year,
      manual_complete: Boolean(normalizedComplete)
    });
  } catch (error) {
    logger.error('Error setting manual complete', { year: req.params.year, error: error.message });
    next(error);
  }
}

module.exports = {
  getAllSettings,
  updateLeagueId,
  setManualComplete
};
