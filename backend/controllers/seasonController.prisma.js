/**
 * Season Controller (Prisma Version)
 * Handles season data, standings, and Sleeper sync using Prisma ORM
 */

const prisma = require('../services/prisma');
const logger = require('../utils/logger');
const sleeperService = require('../services/sleeperService');
const { NotFoundError } = require('../utils/errors');

/**
 * Get all seasons
 */
async function getAllSeasons(req, res, next) {
  try {
    const teamSeasons = await prisma.team_seasons.findMany({
      include: {
        managers: {
          select: {
            full_name: true,
            name_id: true
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { regular_season_rank: 'asc' }
      ]
    });

    // Transform to match legacy format
    const seasons = teamSeasons.map(ts => ({
      ...ts,
      manager_name: ts.managers.full_name
    }));

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
    const { year } = req.params;

    const teamSeasons = await prisma.team_seasons.findMany({
      where: { year: parseInt(year) },
      include: {
        managers: {
          select: {
            full_name: true,
            name_id: true
          }
        }
      },
      orderBy: { regular_season_rank: 'asc' }
    });

    // Transform to match legacy format
    const seasons = teamSeasons.map(ts => ({
      ...ts,
      manager_name: ts.managers.full_name
    }));

    res.json({ teamSeasons: seasons });
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
    const { year } = req.params;

    const settings = await prisma.league_settings.findUnique({
      where: { year: parseInt(year) }
    });

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
    const { year } = req.params;

    const leagueSettings = await prisma.league_settings.findUnique({
      where: { year: parseInt(year) }
    });

    if (!leagueSettings || !leagueSettings.league_id) {
      throw new NotFoundError('League ID not found for year');
    }

    // Get managers - check if manager_sleeper_ids table exists
    const managers = await prisma.managers.findMany({
      select: {
        name_id: true,
        full_name: true,
        sleeper_user_id: true
      }
    });

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
    const year = parseInt(req.params.year, 10);
    const requestedWeek = req.query.week ? parseInt(req.query.week, 10) : null;

    const leagueSettings = await prisma.league_settings.findUnique({
      where: { year }
    });

    if (!leagueSettings || !leagueSettings.league_id) {
      throw new NotFoundError('League ID not found for year');
    }

    const managers = await prisma.managers.findMany({
      select: {
        full_name: true,
        name_id: true,
        sleeper_user_id: true
      }
    });

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
    const { year } = req.params;

    const leagueSettings = await prisma.league_settings.findUnique({
      where: { year: parseInt(year) }
    });

    if (!leagueSettings || !leagueSettings.league_id) {
      throw new NotFoundError('League ID not found for year');
    }

    const managers = await prisma.managers.findMany({
      select: {
        name_id: true,
        full_name: true,
        sleeper_user_id: true
      }
    });

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
    const { year } = req.params;

    const leagueSettings = await prisma.league_settings.findUnique({
      where: { year: parseInt(year) }
    });

    if (!leagueSettings || !leagueSettings.league_id) {
      throw new NotFoundError('League ID not found for year');
    }

    const managers = await prisma.managers.findMany({
      select: {
        full_name: true,
        name_id: true,
        sleeper_user_id: true
      }
    });

    const { rosters, draftedPlayers } = await sleeperService.getFinalRosters(leagueSettings.league_id, managers);
    res.json({ rosters, draftedPlayers });
  } catch (error) {
    logger.error('Error fetching final rosters', { year: req.params.year, error: error.message });
    next(error);
  }
}

/**
 * Sync season data from Sleeper
 * Note: This function still needs access to the raw database connection for the sleeperService
 */
async function syncSleeperSeason(req, res, next) {
  try {
    const { year } = req.params;
    const { leagueId, preserveManualFields = true } = req.body;

    logger.info('Starting Sleeper season sync', { year, leagueId });

    // Update sync status
    await prisma.league_settings.update({
      where: { year: parseInt(year) },
      data: {
        sync_status: 'syncing',
        last_sync_attempt: new Date()
      }
    });

    // Perform sync - Note: sleeperService still needs raw db access
    const result = await sleeperService.syncSleeperSeason({
      year: parseInt(year),
      leagueId,
      db: req.db.db, // Pass raw db for now
      preserveManualFields
    });

    // Update sync status
    await prisma.league_settings.update({
      where: { year: parseInt(year) },
      data: {
        sync_status: 'success',
        last_synced: new Date()
      }
    });

    logger.info('Sleeper season sync completed', {
      year,
      teams: result.teams_synced,
      rosters: result.rosters_synced
    });

    res.json(result);
  } catch (error) {
    const { year } = req.params;

    try {
      await prisma.league_settings.update({
        where: { year: parseInt(year) },
        data: { sync_status: 'failed' }
      });
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
    // Get championship counts
    const championshipCounts = await prisma.team_seasons.groupBy({
      by: ['name_id'],
      where: {
        playoff_finish: 1
      },
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          _all: 'desc'
        }
      }
    });

    // Get manager details for champions
    const championships = await Promise.all(
      championshipCounts.map(async (champ) => {
        const manager = await prisma.managers.findUnique({
          where: { name_id: champ.name_id },
          select: { full_name: true, name_id: true }
        });
        return {
          name_id: champ.name_id,
          full_name: manager?.full_name || '',
          count: champ._count._all
        };
      })
    );

    // Get total seasons and managers
    const totalSeasons = await prisma.team_seasons.findMany({
      distinct: ['year'],
      select: { year: true }
    });

    const totalManagers = await prisma.managers.count();

    res.json({
      championships,
      totalSeasons: totalSeasons.length,
      totalManagers
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
    const {
      year, name_id, team_name, wins, losses, points_for, points_against,
      regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
    } = req.body;

    if (!year || !name_id || wins === undefined || losses === undefined) {
      return res.status(400).json({ error: 'year, name_id, wins, and losses are required' });
    }

    const teamSeason = await prisma.team_seasons.create({
      data: {
        year: parseInt(year),
        name_id,
        team_name: team_name || '',
        wins,
        losses,
        points_for: points_for || 0,
        points_against: points_against || 0,
        regular_season_rank: regular_season_rank || null,
        playoff_finish: playoff_finish || null,
        dues: dues || 200,
        payout: payout || 0,
        dues_chumpion: dues_chumpion || 0,
        high_game: high_game || null
      }
    });

    logger.info('Team season created', { seasonId: teamSeason.id, year, name_id });
    res.json({
      message: 'Team season added successfully',
      seasonId: teamSeason.id
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
    const { id } = req.params;
    const {
      year, name_id, team_name, wins, losses, points_for, points_against,
      regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
    } = req.body;

    await prisma.team_seasons.update({
      where: { id: parseInt(id) },
      data: {
        year: year !== undefined ? parseInt(year) : undefined,
        name_id,
        team_name,
        wins,
        losses,
        points_for,
        points_against,
        regular_season_rank,
        playoff_finish,
        dues,
        payout,
        dues_chumpion: dues_chumpion || 0,
        high_game
      }
    });

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
    const { id } = req.params;

    await prisma.team_seasons.delete({
      where: { id: parseInt(id) }
    });

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
    const { nameId } = req.params;

    const teamSeasons = await prisma.team_seasons.findMany({
      where: { name_id: nameId },
      include: {
        managers: {
          select: {
            full_name: true
          }
        }
      },
      orderBy: { year: 'desc' }
    });

    // Transform to match legacy format
    const seasons = teamSeasons.map(ts => ({
      ...ts,
      manager_name: ts.managers.full_name
    }));

    res.json({ teamSeasons: seasons });
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
