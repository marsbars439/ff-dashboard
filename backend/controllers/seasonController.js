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

    const teamSeasons = await allAsync(`
      SELECT ts.*, m.full_name as manager_name
      FROM team_seasons ts
      LEFT JOIN managers m ON ts.name_id = m.name_id
      WHERE ts.year = ?
      ORDER BY ts.regular_season_rank ASC
    `, [year]);

    res.json({ teamSeasons });
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
 * Get weekly matchups for a specific season
 */
async function getSeasonMatchups(req, res, next) {
  try {
    const { getAsync, allAsync } = req.db;
    const { year } = req.params;

    const leagueSettings = await getAsync('SELECT league_id FROM league_settings WHERE year = ?', [year]);

    if (!leagueSettings || !leagueSettings.league_id) {
      logger.warn('League ID not found for year, returning empty matchups', { year });
      return res.json({ matchups: [] });
    }

    const managers = await allAsync(`
      SELECT m.name_id, m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
      FROM managers m
      LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?
    `, [year]);

    const matchups = await sleeperService.getSeasonMatchups(leagueSettings.league_id, managers);
    res.json({ matchups });
  } catch (error) {
    logger.error('Error fetching season matchups', { year: req.params.year, error: error.message });
    next(error);
  }
}

/**
 * Get active week matchups with starting lineups
 */
async function getActiveWeekMatchups(req, res, next) {
  try {
    const { getAsync, allAsync } = req.db;
    const year = parseInt(req.params.year, 10);
    const requestedWeek = req.query.week ? parseInt(req.query.week, 10) : null;

    let leagueSettings = await getAsync('SELECT league_id FROM league_settings WHERE year = ?', [year]);

    if (!leagueSettings || !leagueSettings.league_id) {
      logger.warn('League ID not found for year, returning empty active week matchups', { year, requestedWeek });
      const week = requestedWeek || await sleeperService.getCurrentNFLWeek() || 1;
      return res.json({
        matchups: [],
        week,
        source: 'db',
        nfl_state: null,
      });
    }

    // Try to fetch managers with season-specific sleeper IDs if table exists
    let managers;
    try {
      managers = await allAsync(`
        SELECT m.full_name, m.name_id, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
        FROM managers m
        LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?
      `, [year]);
    } catch (error) {
      // If manager_sleeper_ids table doesn't exist, fall back to just managers table
      if (error.message.includes('no such table: manager_sleeper_ids')) {
        logger.warn('manager_sleeper_ids table not found, using default sleeper_user_id from managers table');
        managers = await allAsync('SELECT full_name, name_id, sleeper_user_id FROM managers');
      } else {
        throw error;
      }
    }

    let week = Number.isInteger(requestedWeek) ? requestedWeek : null;
    if (!week) {
      week = await sleeperService.getCurrentNFLWeek();
    }

    if (!week) {
      return res.status(400).json({ error: 'Unable to determine active week' });
    }

    const data = await sleeperService.getWeeklyMatchupsWithLineups(
      leagueSettings.league_id,
      week,
      managers,
      year
    );

    // Broadcast active week update via WebSocket
    const wsService = req.app.get('wsService');
    if (wsService) {
      wsService.broadcastActiveWeekUpdate(year, data);
    }

    res.json(data);
  } catch (error) {
    logger.error('Error fetching active week matchups', {
      year: req.params.year,
      error: error.message
    });
    next(error);
  }
}

/**
 * Get playoff matchups for a specific season
 */
async function getPlayoffMatchups(req, res, next) {
  try {
    const { getAsync, allAsync } = req.db;
    const { year } = req.params;

    const leagueSettings = await getAsync('SELECT league_id FROM league_settings WHERE year = ?', [year]);

    if (!leagueSettings || !leagueSettings.league_id) {
      logger.warn('League ID not found for year, returning empty playoff bracket', { year });
      return res.json({ bracket: null });
    }

    const managers = await allAsync(`
      SELECT m.name_id, m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
      FROM managers m
      LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?
    `, [year]);

    const bracket = await sleeperService.getPlayoffMatchups(leagueSettings.league_id, managers);
    res.json({ bracket });
  } catch (error) {
    logger.error('Error fetching playoff matchups', { year: req.params.year, error: error.message });
    next(error);
  }
}

/**
 * Get final rosters (keepers) for a specific season
 */
async function getFinalRosters(req, res, next) {
  try {
    const { getAsync, allAsync } = req.db;
    const { year } = req.params;

    const leagueSettings = await getAsync('SELECT league_id FROM league_settings WHERE year = ?', [year]);

    if (!leagueSettings || !leagueSettings.league_id) {
      logger.warn('League ID not found for year, returning empty rosters', { year });
      return res.json({ rosters: [], draftedPlayers: [] });
    }

    // Try to fetch managers with season-specific sleeper IDs if table exists
    let managers;
    try {
      managers = await allAsync(`
        SELECT m.full_name, m.name_id, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
        FROM managers m
        LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?
      `, [year]);
    } catch (error) {
      // If manager_sleeper_ids table doesn't exist, fall back to just managers table
      if (error.message.includes('no such table: manager_sleeper_ids')) {
        logger.warn('manager_sleeper_ids table not found, using default sleeper_user_id from managers table');
        managers = await allAsync('SELECT full_name, name_id, sleeper_user_id FROM managers');
      } else {
        throw error;
      }
    }

    const { rosters, draftedPlayers } = await sleeperService.getFinalRosters(leagueSettings.league_id, managers);
    res.json({ rosters, draftedPlayers });
  } catch (error) {
    logger.error('Error fetching final rosters', { year: req.params.year, error: error.message });
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

/**
 * Create a new team season
 */
async function createTeamSeason(req, res, next) {
  try {
    const { runAsync } = req.db;
    const {
      year, name_id, team_name, wins, losses, points_for, points_against,
      regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
    } = req.body;

    if (!year || !name_id || wins === undefined || losses === undefined) {
      return res.status(400).json({ error: 'year, name_id, wins, and losses are required' });
    }

    const result = await runAsync(`
      INSERT INTO team_seasons (
        year, name_id, team_name, wins, losses, points_for, points_against,
        regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      year, name_id, team_name || '', wins, losses, points_for || 0, points_against || 0,
      regular_season_rank || null, playoff_finish || null, dues, payout || 0,
      dues_chumpion || 0, high_game || null
    ]);

    logger.info('Team season created', { seasonId: result.lastID, year, name_id });
    res.json({
      message: 'Team season added successfully',
      seasonId: result.lastID
    });
  } catch (error) {
    logger.error('Error creating team season', { error: error.message });
    next(error);
  }
}

/**
 * Update a team season
 */
async function updateTeamSeason(req, res, next) {
  try {
    const { runAsync } = req.db;
    const { id } = req.params;
    const {
      year, name_id, team_name, wins, losses, points_for, points_against,
      regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
    } = req.body;

    await runAsync(`
      UPDATE team_seasons SET
        year = ?, name_id = ?, team_name = ?, wins = ?, losses = ?,
        points_for = ?, points_against = ?, regular_season_rank = ?,
        playoff_finish = ?, dues = ?, payout = ?, dues_chumpion = ?, high_game = ?
      WHERE id = ?
    `, [
      year, name_id, team_name, wins, losses, points_for, points_against,
      regular_season_rank, playoff_finish, dues, payout, dues_chumpion || 0, high_game, id
    ]);

    logger.info('Team season updated', { seasonId: id });
    res.json({ message: 'Team season updated successfully' });
  } catch (error) {
    logger.error('Error updating team season', { seasonId: req.params.id, error: error.message });
    next(error);
  }
}

/**
 * Delete a team season
 */
async function deleteTeamSeason(req, res, next) {
  try {
    const { runAsync } = req.db;
    const { id } = req.params;

    await runAsync('DELETE FROM team_seasons WHERE id = ?', [id]);

    logger.info('Team season deleted', { seasonId: id });
    res.json({ message: 'Team season deleted successfully' });
  } catch (error) {
    logger.error('Error deleting team season', { seasonId: req.params.id, error: error.message });
    next(error);
  }
}

/**
 * Get team seasons by manager
 */
async function getManagerSeasons(req, res, next) {
  try {
    const { allAsync } = req.db;
    const { nameId } = req.params;

    const teamSeasons = await allAsync(`
      SELECT ts.*, m.full_name as manager_name
      FROM team_seasons ts
      LEFT JOIN managers m ON ts.name_id = m.name_id
      WHERE ts.name_id = ?
      ORDER BY ts.year DESC
    `, [nameId]);

    res.json({ teamSeasons });
  } catch (error) {
    logger.error('Error fetching manager seasons', { nameId: req.params.nameId, error: error.message });
    next(error);
  }
}

module.exports = {
  getAllSeasons,
  getSeasonByYear,
  getLeagueSettings,
  getSeasonMatchups,
  getActiveWeekMatchups,
  getPlayoffMatchups,
  getFinalRosters,
  createTeamSeason,
  updateTeamSeason,
  deleteTeamSeason,
  getManagerSeasons,
  syncSleeperSeason,
  getLeagueStats
};
