/**
 * Keeper Controller
 * Handles keeper selections and preseason trade locks
 */

const logger = require('../utils/logger');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Get keeper trade lock status for a year
 */
async function getKeeperTradeLock(req, res, next) {
  try {
    const { getAsync } = req.db;
    const { year } = req.params;

    const lockRow = await getAsync(
      'SELECT season_year, locked, locked_at, updated_at FROM keeper_trade_locks WHERE season_year = ?',
      [year]
    );

    res.json(lockRow || { season_year: parseInt(year), locked: false });
  } catch (error) {
    logger.error('Error fetching keeper trade lock', { year: req.params.year, error: error.message });
    next(error);
  }
}

/**
 * Update keeper trade lock status
 */
async function updateKeeperTradeLock(req, res, next) {
  try {
    const { runAsync, getAsync } = req.db;
    const { year } = req.params;
    const { locked } = req.body;

    const now = new Date().toISOString();

    // Upsert the lock status
    await runAsync(
      `INSERT INTO keeper_trade_locks (season_year, locked, locked_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(season_year) DO UPDATE SET
         locked = excluded.locked,
         locked_at = CASE WHEN excluded.locked = 1 THEN excluded.locked_at ELSE locked_at END,
         updated_at = excluded.updated_at`,
      [year, locked ? 1 : 0, locked ? now : null, now]
    );

    const updatedRow = await getAsync(
      'SELECT season_year, locked, locked_at, updated_at FROM keeper_trade_locks WHERE season_year = ?',
      [year]
    );

    logger.info('Keeper trade lock updated', { year, locked });

    res.json({
      seasonYear: updatedRow?.season_year ?? parseInt(year),
      locked: updatedRow ? updatedRow.locked === 1 : locked,
      lockedAt: updatedRow?.locked_at || null,
      updatedAt: updatedRow?.updated_at || null
    });
  } catch (error) {
    logger.error('Error updating keeper trade lock', {
      year: req.params.year,
      error: error.message
    });
    next(error);
  }
}

/**
 * Check if keeper trading is locked
 */
async function isKeeperTradeLocked(db, year) {
  const { getAsync } = db;

  try {
    const lockRow = await getAsync(
      'SELECT locked FROM keeper_trade_locks WHERE season_year = ?',
      [year]
    );
    return Boolean(lockRow?.locked);
  } catch (error) {
    logger.error('Error checking keeper trade lock', { year, error: error.message });
    return false;
  }
}

/**
 * Get keeper trade lock row for a year
 */
async function getKeeperTradeLockRow(db, year) {
  const { getAsync } = db;

  try {
    const lockRow = await getAsync(
      'SELECT season_year, locked, locked_at, updated_at FROM keeper_trade_locks WHERE season_year = ?',
      [year]
    );
    return lockRow;
  } catch (error) {
    logger.error('Error fetching keeper trade lock row', { year, error: error.message });
    return null;
  }
}

/**
 * Get keepers for a specific year
 */
async function getKeepersByYear(req, res, next) {
  try {
    const { allAsync } = req.db;
    const { year } = req.params;

    const keepers = await allAsync(
      'SELECT * FROM keepers WHERE year = ? ORDER BY roster_id',
      [year]
    );

    // Get lock status
    const lockRow = await getKeeperTradeLockRow(req.db, year);

    res.json({
      keepers,
      locked: lockRow ? lockRow.locked === 1 : false,
      lockedAt: lockRow?.locked_at || null,
      updatedAt: lockRow?.updated_at || null
    });
  } catch (error) {
    logger.error('Error fetching keepers', { year: req.params.year, error: error.message });
    next(error);
  }
}

/**
 * Save keeper selections for a roster
 */
async function saveKeepers(req, res, next) {
  try {
    const { runAsync, allAsync, db } = req.db;
    const { year, rosterId } = req.params;
    const { keepers } = req.body;

    // Check if locked
    const locked = await isKeeperTradeLocked(req.db, year);
    if (locked) {
      throw new ForbiddenError('Keeper selections are locked for this season');
    }

    // Use transaction to ensure atomic operations
    await runAsync('BEGIN TRANSACTION');

    try {
      // Delete existing keepers for this roster
      await runAsync(
        'DELETE FROM keepers WHERE year = ? AND roster_id = ?',
        [year, rosterId]
      );

      // Insert new keepers
      if (keepers && keepers.length > 0) {
        for (const keeper of keepers) {
          await runAsync(
            `INSERT INTO keepers (
              year, roster_id, player_id, player_name, position, team,
              trade_from_roster_id, trade_amount, trade_note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              year,
              rosterId,
              keeper.playerId,
              keeper.playerName || null,
              keeper.position || null,
              keeper.team || null,
              keeper.tradeFromRosterId || null,
              keeper.tradeAmount || null,
              keeper.tradeNote || null
            ]
          );
        }
      }

      // Commit transaction
      await runAsync('COMMIT');
    } catch (error) {
      // Rollback on error
      await runAsync('ROLLBACK');
      throw error;
    }

    const savedKeepers = await allAsync(
      'SELECT * FROM keepers WHERE year = ? AND roster_id = ?',
      [year, rosterId]
    );

    logger.info('Keepers saved', { year, rosterId, count: savedKeepers.length });

    // Broadcast keeper update via WebSocket
    const wsService = req.app.get('wsService');
    if (wsService) {
      wsService.broadcastKeeperUpdate(year, rosterId, savedKeepers);
    }

    res.json({
      year: parseInt(year),
      rosterId: parseInt(rosterId),
      keepers: savedKeepers
    });
  } catch (error) {
    logger.error('Error saving keepers', {
      year: req.params.year,
      rosterId: req.params.rosterId,
      error: error.message
    });
    next(error);
  }
}

module.exports = {
  getKeeperTradeLock,
  updateKeeperTradeLock,
  getKeepersByYear,
  saveKeepers,
  isKeeperTradeLocked
};
