/**
 * Rankings Controller
 * Handles ROS (Rest of Season) rankings operations
 */

const logger = require('../utils/logger');

/**
 * Get ROS rankings
 */
async function getRankings(req, res, next) {
  try {
    const { allAsync, getAsync } = req.db;

    const [rows, lastUpdatedRow] = await Promise.all([
      allAsync(
        'SELECT player_name, team, position, proj_pts, sos_season, sos_playoffs FROM ros_rankings ORDER BY player_name'
      ),
      getAsync('SELECT MAX(updated_at) AS last_updated FROM ros_rankings')
    ]);

    const normalizeSqliteTimestamp = (value) => {
      if (!value) return null;
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (!trimmed) return null;
      const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
      const normalized = hasTimezone ? trimmed : `${trimmed}Z`;
      const date = new Date(normalized);
      if (Number.isNaN(date.getTime())) return null;
      return date.toISOString();
    };

    const lastUpdated = normalizeSqliteTimestamp(lastUpdatedRow?.last_updated);
    res.json({ rankings: rows, lastUpdated });
  } catch (error) {
    logger.error('Error fetching ROS rankings', { error: error.message });
    next(error);
  }
}

/**
 * Refresh ROS rankings from FantasyPros
 */
async function refreshRankings(req, res, next) {
  try {
    const { refreshRosRankings } = req.services;
    const result = await refreshRosRankings();
    res.json({ status: 'ok', ...result });
  } catch (error) {
    const failureDetails = Array.isArray(error?.failed) ? error.failed : [];
    logger.error('Error refreshing ROS rankings', { error: error.message, failed: failureDetails });
    res.status(500).json({ error: error.message, failed: failureDetails });
  }
}

module.exports = {
  getRankings,
  refreshRankings
};
