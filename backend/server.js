const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const dbPath = path.join(__dirname, 'data', 'fantasy_football.db');
const db = new sqlite3.Database(dbPath);

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

// Add a new manager
app.post('/api/managers', (req, res) => {
  const { name_id, full_name, sleeper_username, active } = req.body;
  
  if (!name_id || !full_name) {
    return res.status(400).json({ error: 'name_id and full_name are required' });
  }

  const query = `
    INSERT INTO managers (name_id, full_name, sleeper_username, active)
    VALUES (?, ?, ?, ?)
  `;
  
  db.run(query, [name_id, full_name, sleeper_username || '', active || 1], function(err) {
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

// Add a new team season
app.post('/api/team-seasons', (req, res) => {
  const {
    year, name_id, team_name, wins, losses, points_for, points_against,
    regular_season_rank, playoff_finish, dues, payout, high_game
  } = req.body;
  
  if (!year || !name_id || wins === undefined || losses === undefined) {
    return res.status(400).json({ error: 'year, name_id, wins, and losses are required' });
  }

  const query = `
    INSERT INTO team_seasons (
      year, name_id, team_name, wins, losses, points_for, points_against,
      regular_season_rank, playoff_finish, dues, payout, high_game
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const values = [
    year, name_id, team_name || '', wins, losses, points_for || 0, points_against || 0,
    regular_season_rank || null, playoff_finish || null, dues || 200, payout || 0, high_game || null
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

// Update a team season
app.put('/api/team-seasons/:id', (req, res) => {
  const id = req.params.id;
  const {
    year, name_id, team_name, wins, losses, points_for, points_against,
    regular_season_rank, playoff_finish, dues, payout, high_game
  } = req.body;

  const query = `
    UPDATE team_seasons SET
      year = ?, name_id = ?, team_name = ?, wins = ?, losses = ?, 
      points_for = ?, points_against = ?, regular_season_rank = ?, 
      playoff_finish = ?, dues = ?, payout = ?, high_game = ?
    WHERE id = ?
  `;
  
  const values = [
    year, name_id, team_name, wins, losses, points_for, points_against,
    regular_season_rank, playoff_finish, dues, payout, high_game, id
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

// Upload Excel file and import data
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

    // Insert new data
    const insertQuery = `
      INSERT INTO team_seasons (
        year, name_id, team_name, wins, losses, points_for, points_against,
        regular_season_rank, playoff_finish, dues, payout, high_game
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let insertedCount = 0;
    jsonData.forEach((row) => {
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
        row.dues || 200,
        row.payout || 0,
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
  console.log(`FF Dashboard API running on port ${PORT}`);
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