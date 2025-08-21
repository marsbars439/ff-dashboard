const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const sleeperService = require('./services/sleeperService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const dbPath = path.join(__dirname, 'data', 'fantasy_football.db');
const db = new sqlite3.Database(dbPath);

// Ensure keepers table exists
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS keepers (
      year INTEGER,
      roster_id INTEGER,
      player_name TEXT,
      previous_cost REAL,
      years_kept INTEGER,
      trade_from_roster_id INTEGER,
      trade_amount REAL,
      PRIMARY KEY (year, roster_id, player_name)
    )
  `);

  // Ensure new trade columns exist for legacy databases
  db.run(
    `ALTER TABLE keepers ADD COLUMN trade_from_roster_id INTEGER`,
    err => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding trade_from_roster_id column:', err.message);
      }
    }
  );

  db.run(
    `ALTER TABLE keepers ADD COLUMN trade_amount REAL`,
    err => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding trade_amount column:', err.message);
      }
    }
  );
});

// Helper functions for async DB operations
const runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

// Recalculate years_kept for seasons after a given year
const recalcYearsKeptFrom = async (startYear) => {
  const maxRow = await getAsync('SELECT MAX(year) as maxYear FROM keepers');
  const maxYear = maxRow && maxRow.maxYear ? maxRow.maxYear : startYear;

  for (let y = startYear + 1; y <= maxYear; y++) {
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT rowid, player_name FROM keepers WHERE year = ?', [y], (err, r) => {
        if (err) reject(err);
        else resolve(r);
      });
    });

    for (const row of rows) {
      const prev = await getAsync(
        'SELECT years_kept FROM keepers WHERE year = ? AND player_name = ?',
        [y - 1, row.player_name]
      );
      const prevYears = prev ? Math.max(prev.years_kept, 1) : 0;
      const yearsKept = prevYears + 1;
      await runAsync('UPDATE keepers SET years_kept = ? WHERE rowid = ?', [yearsKept, row.rowid]);
    }
  }
};

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Routes

// Get all managers
app.get('/api/managers', (req, res) => {
  const query = 'SELECT * FROM managers ORDER BY full_name';
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ managers: rows });
  });
});

// Get all team seasons
app.get('/api/team-seasons', (req, res) => {
  const query = `
    SELECT ts.*, m.full_name as manager_name 
    FROM team_seasons ts 
    LEFT JOIN managers m ON ts.name_id = m.name_id 
    ORDER BY ts.year DESC, ts.regular_season_rank ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ teamSeasons: rows });
  });
});

// Get team seasons by year
app.get('/api/team-seasons/:year', (req, res) => {
  const year = req.params.year;
  const query = `
    SELECT ts.*, m.full_name as manager_name 
    FROM team_seasons ts 
    LEFT JOIN managers m ON ts.name_id = m.name_id 
    WHERE ts.year = ? 
    ORDER BY ts.regular_season_rank ASC
  `;
  db.all(query, [year], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ teamSeasons: rows });
  });
});

// Get weekly matchups for a specific season
app.get('/api/seasons/:year/matchups', (req, res) => {
  const year = req.params.year;
  const query = 'SELECT league_id FROM league_settings WHERE year = ?';
  db.get(query, [year], async (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row || !row.league_id) {
      res.status(404).json({ error: 'League ID not found for year' });
      return;
    }
    try {
      const managers = await new Promise((resolve, reject) => {
        db.all(
          `SELECT m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
           FROM managers m
           LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?`,
          [year],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      const matchups = await sleeperService.getSeasonMatchups(row.league_id, managers);
      res.json({ matchups });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Get playoff matchups for a specific season
app.get('/api/seasons/:year/playoffs', (req, res) => {
  const year = req.params.year;
  const query = 'SELECT league_id FROM league_settings WHERE year = ?';
  db.get(query, [year], async (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row || !row.league_id) {
      res.status(404).json({ error: 'League ID not found for year' });
      return;
    }
    try {
      const managers = await new Promise((resolve, reject) => {
        db.all(
          `SELECT m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
           FROM managers m
           LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?`,
          [year],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      const bracket = await sleeperService.getPlayoffMatchups(row.league_id, managers);
      res.json({ bracket });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Get final rosters for a specific season
app.get('/api/seasons/:year/keepers', (req, res) => {
  const year = req.params.year;
  const query = 'SELECT league_id FROM league_settings WHERE year = ?';
  db.get(query, [year], async (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row || !row.league_id) {
      res.status(404).json({ error: 'League ID not found for year' });
      return;
    }
    try {
      const managers = await new Promise((resolve, reject) => {
        db.all(
          `SELECT m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
           FROM managers m
           LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?`,
          [year],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      const rosters = await sleeperService.getFinalRosters(row.league_id, managers);
      res.json({ rosters });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Get stored keeper selections for a season
app.get('/api/keepers/:year', (req, res) => {
  const year = parseInt(req.params.year);
  db.all(
    'SELECT roster_id, player_name, previous_cost, years_kept, trade_from_roster_id, trade_amount FROM keepers WHERE year = ?',
    [year],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ keepers: rows });
    }
  );
});

// Save keeper selections for a roster in a given season
app.post('/api/keepers/:year/:rosterId', async (req, res) => {
  const year = parseInt(req.params.year);
  const rosterId = parseInt(req.params.rosterId);
  const players = Array.isArray(req.body.players) ? req.body.players : [];

  try {
    await runAsync('DELETE FROM keepers WHERE year = ? AND roster_id = ?', [year, rosterId]);

    for (const p of players) {
      const prev = await getAsync(
        'SELECT years_kept FROM keepers WHERE year = ? AND player_name = ?',
        [year - 1, p.name]
      );
      const prevYears = prev ? Math.max(prev.years_kept, 1) : 0;
      const yearsKept = prevYears + 1;
      await runAsync(
        'INSERT INTO keepers (year, roster_id, player_name, previous_cost, years_kept, trade_from_roster_id, trade_amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [year, rosterId, p.name, p.previous_cost, yearsKept, p.trade_from_roster_id || null, p.trade_amount || null]
      );
    }
    await recalcYearsKeptFrom(year);

    res.json({ message: 'Keepers saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get team seasons by manager
app.get('/api/managers/:nameId/seasons', (req, res) => {
  const nameId = req.params.nameId;
  const query = `
    SELECT ts.*, m.full_name as manager_name 
    FROM team_seasons ts 
    LEFT JOIN managers m ON ts.name_id = m.name_id 
    WHERE ts.name_id = ? 
    ORDER BY ts.year DESC
  `;
  db.all(query, [nameId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ teamSeasons: rows });
  });
});

// Get all league settings (league IDs for each year)
app.get('/api/league-settings', (req, res) => {
  const query = 'SELECT * FROM league_settings ORDER BY year DESC';
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ settings: rows });
  });
});

// Update league ID for a specific year
app.put('/api/league-settings/:year', (req, res) => {
  const year = req.params.year;
  const { league_id } = req.body;

  const query = `
    INSERT INTO league_settings (year, league_id, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(year) 
    DO UPDATE SET 
      league_id = excluded.league_id,
      updated_at = CURRENT_TIMESTAMP
  `;

  db.run(query, [year, league_id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      message: 'League ID updated successfully',
      year,
      league_id 
    });
  });
});

// Test Sleeper API connection
app.get('/api/sleeper/test', async (req, res) => {
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

// Sync data from Sleeper for a specific year
app.post('/api/sleeper/sync/:year', async (req, res) => {
  const year = parseInt(req.params.year);
  const { league_id, preserve_manual_fields = true } = req.body;

  if (!league_id) {
    return res.status(400).json({ error: 'League ID is required' });
  }

  try {
    // Update sync status
    db.run(
      'UPDATE league_settings SET sync_status = ?, last_sync = CURRENT_TIMESTAMP WHERE year = ?',
      ['syncing', year]
    );

    // Get all managers for username mapping
    const managers = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM managers', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get seasonal Sleeper ID mappings
    const seasonalIds = await new Promise((resolve, reject) => {
      db.all('SELECT name_id, sleeper_user_id FROM manager_sleeper_ids WHERE season = ?', [year], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Fetch data from Sleeper
    const sleeperResult = await sleeperService.fetchLeagueData(league_id, year, managers, seasonalIds);

    if (!sleeperResult.success) {
      throw new Error(sleeperResult.error);
    }

    // Get existing team_seasons data for this year (to preserve manual fields)
    const existingData = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM team_seasons WHERE year = ?', [year], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Create a map of existing data by name_id for easy lookup
    const existingMap = {};
    existingData.forEach(row => {
      existingMap[row.name_id] = row;
    });

    // Process and merge data
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const teamData of sleeperResult.data) {
      // Skip if no name_id match found
      if (!teamData.name_id) {
        errorCount++;
        errors.push(`No manager match for Sleeper user: ${teamData.sleeper_username || teamData.sleeper_user_id}`);
        continue;
      }

      const existing = existingMap[teamData.name_id];

      // Prepare data for insertion/update
      const dataToSave = {
        ...teamData,
        // Preserve manual fields if requested and they exist
        dues: preserve_manual_fields && existing ? existing.dues : (teamData.dues || 250),
        payout: preserve_manual_fields && existing ? existing.payout : (teamData.payout || 0),
        dues_chumpion: preserve_manual_fields && existing ? existing.dues_chumpion : (teamData.dues_chumpion || 0),
      };

      // Remove Sleeper identifiers as we don't save them to team_seasons
      delete dataToSave.sleeper_username;
      delete dataToSave.sleeper_user_id;

      // Insert or update the record
      const query = `
        INSERT INTO team_seasons (
          year, name_id, team_name, wins, losses, points_for, points_against,
          regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(year, name_id) 
        DO UPDATE SET 
          team_name = excluded.team_name,
          wins = excluded.wins,
          losses = excluded.losses,
          points_for = excluded.points_for,
          points_against = excluded.points_against,
          regular_season_rank = excluded.regular_season_rank,
          playoff_finish = excluded.playoff_finish,
          high_game = excluded.high_game,
          ${preserve_manual_fields ? '' : `
            dues = excluded.dues,
            payout = excluded.payout,
            dues_chumpion = excluded.dues_chumpion,
          `}
          updated_at = CURRENT_TIMESTAMP
      `;

      const values = [
        dataToSave.year,
        dataToSave.name_id,
        dataToSave.team_name,
        dataToSave.wins,
        dataToSave.losses,
        dataToSave.points_for,
        dataToSave.points_against,
        dataToSave.regular_season_rank,
        dataToSave.playoff_finish,
        dataToSave.dues,
        dataToSave.payout,
        dataToSave.dues_chumpion,
        dataToSave.high_game
      ];

      await new Promise((resolve, reject) => {
        db.run(query, values, function(err) {
          if (err) {
            errorCount++;
            errors.push(`Error saving ${dataToSave.name_id}: ${err.message}`);
            reject(err);
          } else {
            successCount++;
            resolve();
          }
        });
      }).catch(() => {}); // Continue on error
    }

    // Update sync status
    db.run(
      'UPDATE league_settings SET sync_status = ?, last_sync = CURRENT_TIMESTAMP WHERE year = ?',
      ['completed', year]
    );

    res.json({
      message: 'Sync completed',
      year,
      league_id,
      summary: {
        total_teams: sleeperResult.data.length,
        successful_updates: successCount,
        errors: errorCount,
        error_details: errors,
        preserved_manual_fields: preserve_manual_fields
      }
    });

  } catch (error) {
    // Update sync status to failed
    db.run(
      'UPDATE league_settings SET sync_status = ? WHERE year = ?',
      ['failed', year]
    );

    console.error('Sync error:', error);
    res.status(500).json({ 
      error: error.message,
      year,
      league_id 
    });
  }
});

// Get sync status for all years
app.get('/api/sleeper/sync-status', async (req, res) => {
  const query = `
    SELECT 
      ls.year,
      ls.league_id,
      ls.last_sync,
      ls.sync_status,
      COUNT(ts.id) as team_count
    FROM league_settings ls
    LEFT JOIN team_seasons ts ON ls.year = ts.year
    GROUP BY ls.year
    ORDER BY ls.year DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ status: rows });
  });
});

// Preview what data would be synced (dry run)
app.post('/api/sleeper/preview/:year', async (req, res) => {
  const year = parseInt(req.params.year);
  const { league_id } = req.body;

  if (!league_id) {
    return res.status(400).json({ error: 'League ID is required' });
  }

  try {
    // Get all managers for username mapping
    const managers = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM managers', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get seasonal Sleeper ID mappings
    const seasonalIds = await new Promise((resolve, reject) => {
      db.all('SELECT name_id, sleeper_user_id FROM manager_sleeper_ids WHERE season = ?', [year], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Fetch data from Sleeper
    const sleeperResult = await sleeperService.fetchLeagueData(league_id, year, managers, seasonalIds);

    if (!sleeperResult.success) {
      throw new Error(sleeperResult.error);
    }

    // Get existing data for comparison
    const existingData = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM team_seasons WHERE year = ?', [year], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Create comparison data
    const preview = sleeperResult.data.map(team => {
      const existing = existingData.find(e => e.name_id === team.name_id);
      return {
        ...team,
        status: !team.name_id ? 'unmatched' : (existing ? 'update' : 'new'),
        existing_data: existing ? {
          wins: existing.wins,
          losses: existing.losses,
          points_for: existing.points_for,
          dues: existing.dues,
          payout: existing.payout,
          dues_chumpion: existing.dues_chumpion
        } : null
      };
    });

    res.json({
      year,
      league_id,
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

// Add a new manager
app.post('/api/managers', (req, res) => {
  const { name_id, full_name, sleeper_username, sleeper_user_id, active } = req.body;
  
  if (!name_id || !full_name) {
    return res.status(400).json({ error: 'name_id and full_name are required' });
  }

  const query = `
    INSERT INTO managers (name_id, full_name, sleeper_username, sleeper_user_id, active)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(query, [name_id, full_name, sleeper_username || '', sleeper_user_id || '', active || 1], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      message: 'Manager added successfully',
      managerId: this.lastID 
    });
  });
});

// Update a manager
app.put('/api/managers/:id', (req, res) => {
  const id = req.params.id;
  const { name_id, full_name, sleeper_username, sleeper_user_id, active } = req.body;

  if (!name_id || !full_name) {
    return res.status(400).json({ error: 'name_id and full_name are required' });
  }

  const query = `
    UPDATE managers SET
      name_id = ?, full_name = ?, sleeper_username = ?, sleeper_user_id = ?, active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  const values = [name_id, full_name, sleeper_username || '', sleeper_user_id || '', active !== undefined ? active : 1, id];
  
  db.run(query, values, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Manager not found' });
      return;
    }
    res.json({ message: 'Manager updated successfully' });
  });
});

// Delete a manager
app.delete('/api/managers/:id', (req, res) => {
  const id = req.params.id;
  
  // First check if manager has any associated team seasons
  db.get('SELECT COUNT(*) as count FROM team_seasons ts JOIN managers m ON ts.name_id = m.name_id WHERE m.id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row.count > 0) {
      res.status(400).json({ error: 'Cannot delete manager with existing season records. Set to inactive instead.' });
      return;
    }
    
    // Safe to delete - no associated records
    db.run('DELETE FROM managers WHERE id = ?', [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Manager not found' });
        return;
      }
      res.json({ message: 'Manager deleted successfully' });
    });
  });
});

// CRUD for manager_sleeper_ids table
app.get('/api/manager-sleeper-ids', (req, res) => {
  const query = `
    SELECT msi.*, m.full_name
    FROM manager_sleeper_ids msi
    LEFT JOIN managers m ON msi.name_id = m.name_id
    ORDER BY msi.season DESC, m.full_name
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ mappings: rows });
  });
});

app.post('/api/manager-sleeper-ids', (req, res) => {
  const { name_id, sleeper_user_id, season } = req.body;
  if (!name_id || !sleeper_user_id || !season) {
    return res.status(400).json({ error: 'name_id, sleeper_user_id and season are required' });
    }

  const query = `
    INSERT INTO manager_sleeper_ids (name_id, sleeper_user_id, season)
    VALUES (?, ?, ?)
  `;
  db.run(query, [name_id, sleeper_user_id, season], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Mapping added successfully', id: this.lastID });
  });
});

app.put('/api/manager-sleeper-ids/:id', (req, res) => {
  const id = req.params.id;
  const { name_id, sleeper_user_id, season } = req.body;
  if (!name_id || !sleeper_user_id || !season) {
    return res.status(400).json({ error: 'name_id, sleeper_user_id and season are required' });
  }

  const query = `
    UPDATE manager_sleeper_ids
    SET name_id = ?, sleeper_user_id = ?, season = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  db.run(query, [name_id, sleeper_user_id, season, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Mapping not found' });
      return;
    }
    res.json({ message: 'Mapping updated successfully' });
  });
});

app.delete('/api/manager-sleeper-ids/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM manager_sleeper_ids WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Mapping not found' });
      return;
    }
    res.json({ message: 'Mapping deleted successfully' });
  });
});

// Add a new team season (updated to include dues_chumpion and FIXED dues handling)
app.post('/api/team-seasons', (req, res) => {
  const {
    year, name_id, team_name, wins, losses, points_for, points_against,
    regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
  } = req.body;
  
  if (!year || !name_id || wins === undefined || losses === undefined) {
    return res.status(400).json({ error: 'year, name_id, wins, and losses are required' });
  }

  const query = `
    INSERT INTO team_seasons (
      year, name_id, team_name, wins, losses, points_for, points_against,
      regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  // FIXED: Don't default dues to 250, use actual value
  const values = [
    year, name_id, team_name || '', wins, losses, points_for || 0, points_against || 0,
    regular_season_rank || null, playoff_finish || null, dues, payout || 0, 
    dues_chumpion || 0, high_game || null
  ];
  
  db.run(query, values, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      message: 'Team season added successfully',
      seasonId: this.lastID 
    });
  });
});

// Update a team season (updated to include dues_chumpion and FIXED dues handling)
app.put('/api/team-seasons/:id', (req, res) => {
  const id = req.params.id;
  const {
    year, name_id, team_name, wins, losses, points_for, points_against,
    regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
  } = req.body;

  const query = `
    UPDATE team_seasons SET
      year = ?, name_id = ?, team_name = ?, wins = ?, losses = ?, 
      points_for = ?, points_against = ?, regular_season_rank = ?, 
      playoff_finish = ?, dues = ?, payout = ?, dues_chumpion = ?, high_game = ?
    WHERE id = ?
  `;
  
  // FIXED: Don't default dues to 250, use actual value
  const values = [
    year, name_id, team_name, wins, losses, points_for, points_against,
    regular_season_rank, playoff_finish, dues, payout, dues_chumpion || 0, high_game, id
  ];
  
  db.run(query, values, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Team season updated successfully' });
  });
});

// Delete a team season
app.delete('/api/team-seasons/:id', (req, res) => {
  const id = req.params.id;
  
  db.run('DELETE FROM team_seasons WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Team season deleted successfully' });
  });
});

// Upload Excel file and import data (updated to include dues_chumpion and FIXED dues handling)
app.post('/api/upload-excel', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    // Clear existing data (optional - comment out if you want to append)
    db.run('DELETE FROM team_seasons', (err) => {
      if (err) {
        console.error('Error clearing data:', err);
      }
    });

    // Insert new data with dues_chumpion support and FIXED dues handling
    const insertQuery = `
      INSERT INTO team_seasons (
        year, name_id, team_name, wins, losses, points_for, points_against,
        regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let insertedCount = 0;
    jsonData.forEach((row) => {
      // FIXED: Don't default dues to 250, use actual value from Excel
      const values = [
        row.year,
        row.name_id,
        row.team_name || '',
        row.wins,
        row.losses,
        row.points_for || 0,
        row.points_against || 0,
        row.regular_season_rank || null,
        row.playoff_finish || null,
        row.dues, // Use actual value from Excel, don't default to 250
        row.payout || 0,
        row.dues_chumpion || 0, // New column support
        row.high_game || null
      ];

      db.run(insertQuery, values, function(err) {
        if (err) {
          console.error('Error inserting row:', err, row);
        } else {
          insertedCount++;
        }
      });
    });

    // Clean up uploaded file
    require('fs').unlinkSync(req.file.path);

    res.json({ 
      message: 'Data imported successfully', 
      rowsProcessed: jsonData.length 
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to process Excel file: ' + error.message });
  }
});

// Get rules - FIXED to read from database instead of hardcoded
app.get('/api/rules', (req, res) => {
  console.log('📖 Fetching rules from database...');
  
  const query = 'SELECT rules_content FROM league_rules WHERE active = 1 ORDER BY created_at DESC LIMIT 1';
  
  db.get(query, [], (err, row) => {
    if (err) {
      console.error('❌ Error fetching rules from database:', err.message);
      res.status(500).json({ error: 'Failed to fetch rules' });
      return;
    }
    
    if (row && row.rules_content) {
      console.log('✅ Rules loaded from database successfully');
      res.json({ rules: row.rules_content });
    } else {
      console.log('ℹ️  No rules found in database, returning empty string');
      res.json({ rules: '' });
    }
  });
});

// Update rules - FIXED to actually save to database
app.put('/api/rules', (req, res) => {
  const { rules } = req.body;
  
  console.log('📝 Updating rules in database...');
  
  if (!rules) {
    return res.status(400).json({ error: 'Rules content is required' });
  }

  // First, deactivate all existing rules
  db.run('UPDATE league_rules SET active = 0 WHERE active = 1', (err) => {
    if (err) {
      console.error('❌ Error deactivating old rules:', err.message);
      res.status(500).json({ error: 'Failed to update rules' });
      return;
    }
    
    console.log('✅ Deactivated previous rules');
    
    // Insert new rules as active
    const insertQuery = `
      INSERT INTO league_rules (rules_content, version, active, created_at, updated_at) 
      VALUES (?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    
    db.run(insertQuery, [rules], function(err) {
      if (err) {
        console.error('❌ Error inserting new rules:', err.message);
        res.status(500).json({ error: 'Failed to save rules' });
        return;
      }
      
      console.log('✅ Rules updated successfully in database (ID:', this.lastID, ')');
      res.json({ message: 'Rules updated successfully' });
    });
  });
});

// Get statistics/aggregated data
app.get('/api/stats', (req, res) => {
  const queries = {
    championships: `
      SELECT m.full_name, COUNT(*) as count 
      FROM team_seasons ts 
      JOIN managers m ON ts.name_id = m.name_id 
      WHERE ts.playoff_finish = 1 
      GROUP BY ts.name_id 
      ORDER BY count DESC
    `,
    totalSeasons: 'SELECT COUNT(DISTINCT year) as count FROM team_seasons',
    totalManagers: 'SELECT COUNT(*) as count FROM managers WHERE active = 1'
  };

  Promise.all([
    new Promise((resolve, reject) => {
      db.all(queries.championships, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.get(queries.totalSeasons, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }),
    new Promise((resolve, reject) => {
      db.get(queries.totalManagers, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    })
  ]).then(([championships, totalSeasons, totalManagers]) => {
    res.json({
      championships,
      totalSeasons: totalSeasons.count,
      totalManagers: totalManagers.count
    });
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`The League Dashboard API running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});