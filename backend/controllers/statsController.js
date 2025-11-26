/**
 * Stats Controller
 * Handles league statistics operations
 */

const logger = require('../utils/logger');

/**
 * Get league statistics
 */
async function getStats(req, res, next) {
  try {
    const { allAsync, getAsync } = req.db;

    const [championships, totalSeasonsRow, totalManagersRow] = await Promise.all([
      allAsync(`
        SELECT m.full_name, COUNT(*) as count
        FROM team_seasons ts
        JOIN managers m ON ts.name_id = m.name_id
        WHERE ts.playoff_finish = 1
        GROUP BY ts.name_id
        ORDER BY count DESC
      `),
      getAsync('SELECT COUNT(DISTINCT year) as count FROM team_seasons'),
      getAsync('SELECT COUNT(*) as count FROM managers WHERE active = 1')
    ]);

    res.json({
      championships,
      totalSeasons: totalSeasonsRow.count,
      totalManagers: totalManagersRow.count
    });
  } catch (error) {
    logger.error('Error fetching league stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

/**
 * Get health check
 */
async function getHealth(req, res, next) {
  res.json({ ok: true });
}

module.exports = {
  getStats,
  getHealth
};
