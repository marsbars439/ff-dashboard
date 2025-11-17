const express = require('express');

function createSleeperRouter({ allAsync, sleeperService, syncSleeperSeason } = {}) {
  if (!allAsync || !sleeperService) {
    throw new Error('Sleeper router requires database helpers and services');
  }

  const router = express.Router();

  router.get('/sleeper/test', async (req, res) => {
    const result = await sleeperService.testConnection();
    if (result.success) {
      res.json({
        message: 'Sleeper API connection successful',
        nfl_state: result.data
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  });

  router.post('/sleeper/sync/:year', async (req, res) => {
    const year = parseInt(req.params.year, 10);
    const { league_id, preserve_manual_fields = true } = req.body || {};

    if (!league_id) {
      return res.status(400).json({ error: 'League ID is required' });
    }

    try {
      const result = await syncSleeperSeason({
        year,
        leagueId: league_id,
        preserveManualFields: preserve_manual_fields
      });

      res.json(result);
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({
        error: error.message,
        year,
        league_id
      });
    }
  });

  router.get('/sleeper/sync-status', async (req, res) => {
    const query = `
      SELECT
        ls.year,
        ls.league_id,
        ls.last_sync,
        ls.sync_status,
        ls.sleeper_status,
        ls.manual_complete,
        COUNT(ts.id) as team_count
      FROM league_settings ls
      LEFT JOIN team_seasons ts ON ls.year = ts.year
      GROUP BY ls.year
      ORDER BY ls.year DESC
    `;

    try {
      const rows = await allAsync(query);
      res.json({ status: rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/sleeper/preview/:year', async (req, res) => {
    const year = parseInt(req.params.year, 10);
    const { league_id } = req.body || {};

    if (!league_id) {
      return res.status(400).json({ error: 'League ID is required' });
    }

    try {
      const managers = await allAsync('SELECT * FROM managers');
      const seasonalIds = await allAsync(
        'SELECT name_id, sleeper_user_id FROM manager_sleeper_ids WHERE season = ?',
        [year]
      );

      const sleeperResult = await sleeperService.fetchLeagueData(league_id, year, managers, seasonalIds);

      if (!sleeperResult.success) {
        throw new Error(sleeperResult.error);
      }

      const existingData = await allAsync('SELECT * FROM team_seasons WHERE year = ?', [year]);

      const preview = sleeperResult.data.map(team => {
        const existing = existingData.find(e => e.name_id === team.name_id);
        return {
          ...team,
          status: !team.name_id ? 'unmatched' : existing ? 'update' : 'new',
          existing_data: existing
            ? {
                wins: existing.wins,
                losses: existing.losses,
                points_for: existing.points_for,
                dues: existing.dues,
                payout: existing.payout,
                dues_chumpion: existing.dues_chumpion
              }
            : null
        };
      });

      res.json({
        year,
        league_id,
        league_status: sleeperResult.leagueStatus || null,
        preview,
        summary: {
          total_teams: preview.length,
          matched: preview.filter(t => t.name_id).length,
          unmatched: preview.filter(t => !t.name_id).length,
          to_update: preview.filter(t => t.status === 'update').length,
          to_create: preview.filter(t => t.status === 'new').length
        }
      });
    } catch (error) {
      console.error('Preview error:', error);
      res.status(500).json({
        error: error.message,
        year,
        league_id
      });
    }
  });

  return router;
}

module.exports = {
  createSleeperRouter
};
