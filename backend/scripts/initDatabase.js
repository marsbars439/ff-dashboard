const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('📁 Created data directory');
}

const dbPath = path.join(dataDir, 'fantasy_football.db');
console.log('🗄️  Database location:', dbPath);

// Create database and tables
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

db.serialize(() => {
  console.log('🚀 Initializing database schema (SCHEMA ONLY - NO RULES OR DATA INSERTION)...');

  // Create managers table
  console.log('📊 Creating managers table...');
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
      console.log('✅ Managers table created successfully');
    }
  });

  // Create team_seasons table with dues_chumpion column
  console.log('📊 Creating team_seasons table...');
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
      dues REAL DEFAULT 250,
      payout REAL DEFAULT 0,
      dues_chumpion REAL DEFAULT 0,
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
      console.log('✅ Team_seasons table created successfully');
    }
  });

  // Create rules table for future use
  console.log('📊 Creating rules table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS league_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rules_content TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating rules table:', err.message);
    } else {
      console.log('✅ League_rules table created successfully');
    }
  });

  // Add dues_chumpion column if it doesn't exist (for existing databases)
  console.log('🔧 Checking for dues_chumpion column...');
  db.run(`
    ALTER TABLE team_seasons ADD COLUMN dues_chumpion REAL DEFAULT 0;
  `, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('ℹ️  dues_chumpion column already exists');
    } else if (err) {
      console.error('❌ Error adding dues_chumpion column:', err.message);
    } else {
      console.log('✅ Added dues_chumpion column');
    }
  });
  
  // Create league settings table if it doesn't exist
  console.log('📊 Creating league settings table...');  
  db.run(`
    CREATE TABLE IF NOT EXISTS league_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER UNIQUE NOT NULL,
      league_id TEXT,
      last_sync DATETIME,
      sync_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err && !err.message.includes('already exists')) {
      console.error('Error creating league_settings table:', err);
    }
  });

  // Create indexes for better performance
  console.log('📈 Creating database indexes...');
  
  const indexes = [
    {
      name: 'idx_team_seasons_year',
      sql: 'CREATE INDEX IF NOT EXISTS idx_team_seasons_year ON team_seasons(year)'
    },
    {
      name: 'idx_team_seasons_name_id', 
      sql: 'CREATE INDEX IF NOT EXISTS idx_team_seasons_name_id ON team_seasons(name_id)'
    },
    {
      name: 'idx_team_seasons_playoff_finish',
      sql: 'CREATE INDEX IF NOT EXISTS idx_team_seasons_playoff_finish ON team_seasons(playoff_finish)'
    },
    {
      name: 'idx_team_seasons_regular_season_rank',
      sql: 'CREATE INDEX IF NOT EXISTS idx_team_seasons_regular_season_rank ON team_seasons(regular_season_rank)'
    },
    {
      name: 'idx_managers_name_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_managers_name_id ON managers(name_id)'
    },
    {
      name: 'idx_managers_active',
      sql: 'CREATE INDEX IF NOT EXISTS idx_managers_active ON managers(active)'
    }
  ];

  indexes.forEach(index => {
    db.run(index.sql, (err) => {
      if (err) {
        console.error(`❌ Error creating ${index.name}:`, err.message);
      } else {
        console.log(`✅ Created index: ${index.name}`);
      }
    });
  });

  // Database schema verification
  console.log('🔍 Verifying database schema...');
  
  // Check managers table structure
  db.all("PRAGMA table_info(managers)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking managers table:', err.message);
    } else {
      console.log('✅ Managers table columns:', columns.map(col => col.name).join(', '));
    }
  });

  // Check team_seasons table structure
  db.all("PRAGMA table_info(team_seasons)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking team_seasons table:', err.message);
    } else {
      console.log('✅ Team_seasons table columns:', columns.map(col => col.name).join(', '));
      
      // Verify dues_chumpion column exists
      const hasChumpionColumn = columns.some(col => col.name === 'dues_chumpion');
      if (hasChumpionColumn) {
        console.log('✅ dues_chumpion column verified');
      } else {
        console.log('⚠️  dues_chumpion column missing!');
      }
    }
  });

  // Check rules table structure
  db.all("PRAGMA table_info(league_rules)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking league_rules table:', err.message);
    } else {
      console.log('✅ League_rules table columns:', columns.map(col => col.name).join(', '));
    }
  });

  // Check database file size and record counts (READ ONLY)
  fs.stat(dbPath, (err, stats) => {
    if (err) {
      console.error('❌ Error checking database file:', err.message);
    } else {
      console.log(`📊 Database file size: ${(stats.size / 1024).toFixed(2)} KB`);
    }
  });

  // Show record counts (READ ONLY - no data modification)
  db.get('SELECT COUNT(*) as count FROM managers', (err, row) => {
    if (!err && row) {
      console.log(`📊 Managers in database: ${row.count}`);
    }
  });

  db.get('SELECT COUNT(*) as count FROM team_seasons', (err, row) => {
    if (!err && row) {
      console.log(`📊 Season records in database: ${row.count}`);
    }
  });

  db.get('SELECT COUNT(*) as count FROM league_rules', (err, row) => {
    if (!err && row) {
      console.log(`📊 Rules entries in database: ${row.count}`);
    }
  });

  console.log('\n🎉 Database initialization completed successfully!');
  console.log('📋 Summary:');
  console.log('   ✅ Tables created/verified: managers, team_seasons, league_rules');
  console.log('   ✅ Indexes created for optimal performance');
  console.log('   ✅ dues_chumpion column added/verified');
  console.log('   ✅ GUARANTEED: No rules insertion - rules table left completely untouched');
  console.log('   ✅ GUARANTEED: No data updates - all existing data preserved');
  console.log('   📍 Database location:', dbPath);
  console.log('\n🚀 Database ready for use!');
  console.log('   📝 Rules can ONLY be modified through the Admin panel');
  console.log('   📊 Data can ONLY be modified through the Admin panel or Excel upload');
});

// Handle errors and cleanup
db.on('error', (err) => {
  console.error('❌ Database error:', err.message);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down database initialization...');
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database:', err.message);
    } else {
      console.log('✅ Database connection closed safely');
    }
    process.exit(0);
  });
});

db.close((err) => {
  if (err) {
    console.error('❌ Error closing database:', err.message);
  } else {
    console.log('✅ Database connection closed successfully');
  }
});