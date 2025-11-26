/**
 * Keeper Controller (Prisma Version)
 * Handles keeper selections and preseason trade locks using Prisma ORM
 */

const prisma = require('../services/prisma');
const logger = require('../utils/logger');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Get keeper trade lock status for a year
 */
async function getKeeperTradeLock(req, res, next) {
  try {
    const { year } = req.params;

    const lockRow = await prisma.keeper_trade_locks.findUnique({
      where: { season_year: parseInt(year) }
    });

    res.json(lockRow || { season_year: parseInt(year), locked: 0 });
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
    const { year } = req.params;
    const { locked } = req.body;

    const now = new Date();

    // Upsert the lock status
    const updatedRow = await prisma.keeper_trade_locks.upsert({
      where: { season_year: parseInt(year) },
      update: {
        locked: locked ? 1 : 0,
        locked_at: locked ? now : undefined,
        updated_at: now
      },
      create: {
        season_year: parseInt(year),
        locked: locked ? 1 : 0,
        locked_at: locked ? now : null,
        updated_at: now
      }
    });

    logger.info('Keeper trade lock updated', { year, locked });

    res.json({
      seasonYear: updatedRow.season_year,
      locked: updatedRow.locked === 1,
      lockedAt: updatedRow.locked_at,
      updatedAt: updatedRow.updated_at
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
async function isKeeperTradeLocked(year) {
  try {
    const lockRow = await prisma.keeper_trade_locks.findUnique({
      where: { season_year: parseInt(year) },
      select: { locked: true }
    });
    return Boolean(lockRow?.locked);
  } catch (error) {
    logger.error('Error checking keeper trade lock', { year, error: error.message });
    return false;
  }
}

/**
 * Get keeper trade lock row for a year
 */
async function getKeeperTradeLockRow(year) {
  try {
    const lockRow = await prisma.keeper_trade_locks.findUnique({
      where: { season_year: parseInt(year) }
    });
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
    const { year } = req.params;

    const keepers = await prisma.keepers.findMany({
      where: { year: parseInt(year) },
      orderBy: { roster_id: 'asc' }
    });

    // Get lock status
    const lockRow = await getKeeperTradeLockRow(year);

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
    const { year, rosterId } = req.params;
    const { keepers } = req.body;

    // Check if locked
    const locked = await isKeeperTradeLocked(year);
    if (locked) {
      throw new ForbiddenError('Keeper selections are locked for this season');
    }

    // Use transaction to ensure atomic operations
    const savedKeepers = await prisma.$transaction(async (tx) => {
      // Delete existing keepers for this roster
      await tx.keepers.deleteMany({
        where: {
          year: parseInt(year),
          roster_id: parseInt(rosterId)
        }
      });

      // Insert new keepers
      if (keepers && keepers.length > 0) {
        for (const keeper of keepers) {
          await tx.keepers.create({
            data: {
              year: parseInt(year),
              roster_id: parseInt(rosterId),
              player_id: keeper.playerId,
              player_name: keeper.playerName || null,
              position: keeper.position || null,
              team: keeper.team || null,
              trade_from_roster_id: keeper.tradeFromRosterId || null,
              trade_amount: keeper.tradeAmount || null,
              trade_note: keeper.tradeNote || null
            }
          });
        }
      }

      // Fetch and return saved keepers
      return await tx.keepers.findMany({
        where: {
          year: parseInt(year),
          roster_id: parseInt(rosterId)
        }
      });
    });

    logger.info('Keepers saved', { year, rosterId, count: savedKeepers.length });

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
