// Add this to the top of your backend/server.js file, after the database connection

// Auto-initialize database on startup
const initDatabase = () => {
  console.log('🗄️  Checking database tables...');
  
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
  `, (err) => {
    if (err) {
      console.error('❌ Error creating managers table:', err.message);
    } else {
      console.log('✅ Managers table ready');
    }
  });

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
  `, (err) => {
    if (err) {
      console.error('❌ Error creating team_seasons table:', err.message);
    } else {
      console.log('✅ Team seasons table ready');
    }
  });

  // Create indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_team_seasons_year ON team_seasons(year)');
  db.run('CREATE INDEX IF NOT EXISTS idx_team_seasons_name_id ON team_seasons(name_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_team_seasons_playoff_finish ON team_seasons(playoff_finish)');
  
  console.log('✅ Database initialization completed');
};

// Call initialization
initDatabase();

// Rest of your existing server.js code below...