const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'fantasy_football.db');

// Create database and tables
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Create managers table
  db.run(`
    CREATE TABLE IF NOT EXISTS managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      sleeper_username TEXT,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create team_seasons table
  db.run(`
    CREATE TABLE IF NOT EXISTS team_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      name_id TEXT NOT NULL,
      team_name TEXT,
      wins INTEGER NOT NULL,
      losses INTEGER NOT NULL,
      points_for REAL DEFAULT 0,
      points_against REAL DEFAULT 0,
      regular_season_rank INTEGER,
      playoff_finish INTEGER,
      dues REAL DEFAULT 200,
      payout REAL DEFAULT 0,
      high_game REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (name_id) REFERENCES managers (name_id),
      UNIQUE(year, name_id)
    )
  `);

  // Create indexes for better performance
  db.run('CREATE INDEX IF NOT EXISTS idx_team_seasons_year ON team_seasons(year)');
  db.run('CREATE INDEX IF NOT EXISTS idx_team_seasons_name_id ON team_seasons(name_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_team_seasons_playoff_finish ON team_seasons(playoff_finish)');

  console.log('Database initialized successfully!');
  console.log('Tables created: managers, team_seasons');
  console.log('Database location:', dbPath);
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database connection closed.');
  }
});