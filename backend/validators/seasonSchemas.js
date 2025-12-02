const { z } = require('zod');
const { commonSchemas } = require('../middleware/validation');

/**
 * Schema for getting season data
 * GET /api/team-seasons/:year
 */
const getSeasonByYear = {
  params: z.object({
    year: commonSchemas.year
  })
};

/**
 * Schema for syncing Sleeper season
 * POST /api/sync-sleeper-season/:year
 */
const syncSleeperSeason = {
  params: z.object({
    year: commonSchemas.year
  }),
  body: z.object({
    leagueId: z.string().min(1, 'League ID is required'),
    preserveManualFields: commonSchemas.boolean.optional().default(true)
  })
};

/**
 * Schema for getting active week matchups
 * GET /api/seasons/:year/active-week/matchups
 */
const getActiveWeekMatchups = {
  params: z.object({
    year: commonSchemas.year
  })
};

/**
 * Schema for getting playoff bracket
 * GET /api/seasons/:year/playoff-bracket
 */
const getPlayoffBracket = {
  params: z.object({
    year: commonSchemas.year
  })
};

/**
 * Schema for updating manager
 * PUT /api/managers/:managerId
 */
const updateManager = {
  params: z.object({
    managerId: commonSchemas.managerId
  }),
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').max(100),
    sleeperUsername: z.string().max(100).nullable().optional(),
    sleeperUserId: z.string().max(100).nullable().optional(),
    passcode: z.string().min(6).max(100).optional()
  })
};

/**
 * Schema for creating manager
 * POST /api/managers
 */
const createManager = {
  body: z.object({
    nameId: commonSchemas.managerId,
    fullName: z.string().min(1, 'Full name is required').max(100),
    sleeperUsername: z.string().max(100).nullable().optional(),
    sleeperUserId: z.string().max(100).nullable().optional(),
    passcode: z.string().min(6, 'Passcode must be at least 6 characters').max(100)
  })
};

module.exports = {
  getSeasonByYear,
  syncSleeperSeason,
  getActiveWeekMatchups,
  getPlayoffBracket,
  updateManager,
  createManager
};
