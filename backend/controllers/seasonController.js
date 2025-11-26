/**
 * Season Controller
 * Handles season data, standings, and Sleeper sync
 */

const logger = require('../utils/logger');
const sleeperService = require('../services/sleeperService');
const { NotFoundError } = require('../utils/errors');

/**
 * Get all seasons
 */
async function getAllSeasons(req, res, next) {
  try {
    const { allAsync } = req.db;
    const seasons = await allAsync(`
      SELECT ts.*, m.full_name as manager_name
      FROM team_seasons ts
      LEFT JOIN managers m ON ts.name_id = m.name_id
      ORDER BY ts.year DESC, ts.regular_season_rank ASC
    `);
    res.json({ teamSeasons: seasons });
  } catch (error) {
    logger.error('Error fetching all seasons', { error: error.message });
    next(error);
  }
}

/**
 * Get season by year
 */
async function getSeasonByYear(req, res, next) {
  try {
    const { allAsync } = req.db;
    const { year } = req.params;

    const seasons = await allAsync(
      'SELECT * FROM team_seasons WHERE year = ? ORDER BY regular_season_rank',
      [year]
    );

    if (!seasons || seasons.length === 0) {
      throw new NotFoundError(`No season data found for year ${year}`);
    }

    res.json(seasons);
  } catch (error) {
    logger.error('Error fetching season by year', { year: req.params.year, error: error.message });
    next(error);
  }
}

/**
 * Get league settings for a year
 */
async function getLeagueSettings(req, res, next) {
  try {
    const { getAsync } = req.db;
    const { year } = req.params;

    const settings = await getAsync(
      'SELECT * FROM league_settings WHERE year = ?',
      [year]
    );

    if (!settings) {
      throw new NotFoundError(`No league settings found for year ${year}`);
    }

    res.json(settings);
  } catch (error) {
    logger.error('Error fetching league settings', { year: req.params.year, error: error.message });
    next(error);
  }
}

/**
 * Get active week matchups with live data
 */
async function getActiveWeekMatchups(req, res, next) {
  try {
    const { year } = req.params;
    const { getAsync } = req.db;

    const settings = await getAsync('SELECT league_id FROM league_settings WHERE year = ?', [year]);

    if (!settings || !settings.league_id) {
      throw new NotFoundError(`No league settings found for year ${year}`);
    }

    const matchups = await sleeperService.getActiveWeekMatchups(settings.league_id, parseInt(year));

    res.json(matchups);
  } catch (error) {
    logger.error('Error fetching active week matchups', {
      year: req.params.year,
      error: error.message
    });
    next(error);
  }
}

/**
 * Get playoff bracket for a season
 */
async function getPlayoffBracket(req, res, next) {
  try {
    const { year } = req.params;
    const { getAsync } = req.db;

    const settings = await getAsync('SELECT league_id FROM league_settings WHERE year = ?', [year]);

    if (!settings || !settings.league_id) {
      throw new NotFoundError(`No league settings found for year ${year}`);
    }

    const bracket = await sleeperService.getPlayoffBracket(settings.league_id, parseInt(year));

    res.json(bracket);
  } catch (error) {
    logger.error('Error fetching playoff bracket', {
      year: req.params.year,
      error: error.message
    });
    next(error);
  }
}

/**
 * Sync season data from Sleeper
 */
async function syncSleeperSeason(req, res, next) {
  try {
    const { year } = req.params;
    const { leagueId, preserveManualFields = true } = req.body;
    const { runAsync } = req.db;

    logger.info('Starting Sleeper season sync', { year, leagueId });

    // Update sync status
    await runAsync(
      'UPDATE league_settings SET sync_status = ?, last_sync_attempt = CURRENT_TIMESTAMP WHERE year = ?',
      ['syncing', year]
    );

    // Perform sync
    const result = await sleeperService.syncSleeperSeason({
      year: parseInt(year),
      leagueId,
      db: req.db.db,
      preserveManualFields
    });

    // Update sync status
    await runAsync(
      'UPDATE league_settings SET sync_status = ?, last_synced = CURRENT_TIMESTAMP WHERE year = ?',
      ['success', year]
    );

    logger.info('Sleeper season sync completed', {
      year,
      teams: result.teams_synced,
      rosters: result.rosters_synced
    });

    res.json(result);
  } catch (error) {
    const { year } = req.params;

    try {
      await req.db.runAsync(
        'UPDATE league_settings SET sync_status = ? WHERE year = ?',
        ['failed', year]
      );
    } catch (updateError) {
      logger.error('Failed to update sync status', { error: updateError.message });
    }

    logger.error('Error syncing Sleeper season', {
      year,
      error: error.message
    });

    next(error);
  }
}

/**
 * Get league stats (championships, seasons, managers)
 */
async function getLeagueStats(req, res, next) {
  try {
    const { allAsync, getAsync } = req.db;

    const [championships, totalSeasonsRow, totalManagersRow] = await Promise.all([
      allAsync(`
        SELECT name_id, full_name, COUNT(*) AS count
        FROM team_seasons
        JOIN managers ON team_seasons.name_id = managers.name_id
        WHERE playoff_finish = 1
        GROUP BY team_seasons.name_id
        ORDER BY count DESC, full_name
      `),
      getAsync('SELECT COUNT(DISTINCT year) AS count FROM team_seasons'),
      getAsync('SELECT COUNT(*) AS count FROM managers')
    ]);

    res.json({
      championships,
      totalSeasons: totalSeasonsRow?.count || 0,
      totalManagers: totalManagersRow?.count || 0
    });
  } catch (error) {
    logger.error('Error fetching league stats', { error: error.message });
    next(error);
  }
}

module.exports = {
  getAllSeasons,
  getSeasonByYear,
  getLeagueSettings,
  getActiveWeekMatchups,
  getPlayoffBracket,
  syncSleeperSeason,
  getLeagueStats
};
