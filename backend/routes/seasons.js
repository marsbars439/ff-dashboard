/**
 * Season Routes
 */

const express = require('express');
const router = express.Router();
const seasonController = require('../controllers/seasonController');
const { requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { getSeasonByYear, syncSleeperSeason, getActiveWeekMatchups, getPlayoffBracket } = require('../validators/seasonSchemas');

// Get all seasons
router.get('/', seasonController.getAllSeasons);

// Get season by year
router.get('/:year', validate(getSeasonByYear), seasonController.getSeasonByYear);

// Get league settings for a year
router.get('/:year/settings', validate(getSeasonByYear), seasonController.getLeagueSettings);

// Get active week matchups with live data
router.get('/:year/active-week/matchups', validate(getActiveWeekMatchups), seasonController.getActiveWeekMatchups);

// Get playoff bracket
router.get('/:year/playoff-bracket', validate(getPlayoffBracket), seasonController.getPlayoffBracket);

// Sync season from Sleeper (admin only)
router.post('/:year/sync', requireAdmin, validate(syncSleeperSeason), seasonController.syncSleeperSeason);

// Get league stats
router.get('/stats/summary', seasonController.getLeagueStats);

module.exports = router;
