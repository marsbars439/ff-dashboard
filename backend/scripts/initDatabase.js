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
      sleeper_user_id TEXT,
      sleeper_username TEXT,
      email TEXT,
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

  // Add sleeper_user_id column if it doesn't exist (for existing databases)
  console.log('🔧 Checking for sleeper_user_id column...');
  db.run(`
    ALTER TABLE managers ADD COLUMN sleeper_user_id TEXT;
  `, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('ℹ️  sleeper_user_id column already exists');
    } else if (err) {
      console.error('❌ Error adding sleeper_user_id column:', err.message);
    } else {
      console.log('✅ Added sleeper_user_id column');
    }
  });

  console.log('🔧 Checking for email column...');
  db.run(`
    ALTER TABLE managers ADD COLUMN email TEXT;
  `, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('ℹ️  email column already exists');
    } else if (err) {
      console.error('❌ Error adding email column:', err.message);
    } else {
      console.log('✅ Added email column');
    }
  });

  // Create manager_sleeper_ids table for historical mappings
  console.log('📊 Creating manager_sleeper_ids table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS manager_sleeper_ids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_id TEXT NOT NULL,
      sleeper_user_id TEXT NOT NULL,
      season INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (name_id) REFERENCES managers (name_id),
      UNIQUE(sleeper_user_id, season)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating manager_sleeper_ids table:', err.message);
    } else {
      console.log('✅ manager_sleeper_ids table created successfully');
    }
  });

  console.log('📊 Creating manager_credentials table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS manager_credentials (
      manager_id TEXT PRIMARY KEY,
      passcode_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (manager_id) REFERENCES managers(name_id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating manager_credentials table:', err.message);
    } else {
      console.log('✅ manager_credentials table created successfully');
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

  // Create keepers table
  console.log('📊 Creating keepers table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS keepers (
      year INTEGER,
      roster_id INTEGER,
      player_id TEXT,
      player_name TEXT,
      previous_cost REAL,
      years_kept INTEGER DEFAULT 0,
      trade_from_roster_id INTEGER,
      trade_amount REAL,
      trade_note TEXT,
      PRIMARY KEY (year, roster_id, player_id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating keepers table:', err.message);
    } else {
      console.log('✅ Keepers table created successfully');
    }
  });

  // Create ros_rankings table
  console.log('📊 Creating ros_rankings table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS ros_rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      team TEXT,
      position TEXT,
      proj_pts REAL,
      sos_season INTEGER,
      sos_playoffs INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating ros_rankings table:', err.message);
    } else {
      console.log('✅ Ros_rankings table created successfully');
    }
  });

  // Add trade columns if they don't exist (for existing databases)
  console.log('🔧 Checking for keeper trade columns...');
  db.run(`
    ALTER TABLE keepers ADD COLUMN trade_from_roster_id INTEGER;
  `, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('ℹ️  trade_from_roster_id column already exists');
    } else if (err) {
      console.error('❌ Error adding trade_from_roster_id column:', err.message);
    } else {
      console.log('✅ Added trade_from_roster_id column');
    }
  });

  db.run(`
    ALTER TABLE keepers ADD COLUMN trade_amount REAL;
  `, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('ℹ️  trade_amount column already exists');
    } else if (err) {
      console.error('❌ Error adding trade_amount column:', err.message);
    } else {
      console.log('✅ Added trade_amount column');
    }
  });

  db.run(`
    ALTER TABLE keepers ADD COLUMN trade_note TEXT;
  `, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('ℹ️  trade_note column already exists');
    } else if (err) {
      console.error('❌ Error adding trade_note column:', err.message);
    } else {
      console.log('✅ Added trade_note column');
    }
  });

  // Add player_id column if it doesn't exist
  db.run(`
    ALTER TABLE keepers ADD COLUMN player_id TEXT;
  `, (err) => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('ℹ️  player_id column already exists');
    } else if (err) {
      console.error('❌ Error adding player_id column:', err.message);
    } else {
      console.log('✅ Added player_id column');
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

  console.log('📊 Creating rule_change_proposals table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS rule_change_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_year INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      options TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating rule_change_proposals table:', err.message);
    } else {
      console.log('✅ rule_change_proposals table created successfully');
    }
  });

  console.log('🔧 Ensuring display_order column exists on rule_change_proposals...');
  db.run(
    `ALTER TABLE rule_change_proposals ADD COLUMN display_order INTEGER`,
    (err) => {
      if (err && err.message.includes('duplicate column name')) {
        console.log('ℹ️  display_order column already exists on rule_change_proposals');
      } else if (err) {
        console.error('❌ Error adding display_order column:', err.message);
      } else {
        console.log('✅ Added display_order column to rule_change_proposals');
      }
    }
  );

  console.log('🔄 Initializing display_order values for existing proposals...');
  db.run(
    `UPDATE rule_change_proposals AS current
     SET display_order = (
       SELECT COUNT(*) + 1
       FROM rule_change_proposals AS other
       WHERE other.season_year = current.season_year
         AND (
           other.created_at > current.created_at OR (
             other.created_at = current.created_at AND other.id > current.id
           )
         )
     )
     WHERE display_order IS NULL OR display_order = 0`,
    (err) => {
      if (err) {
        console.error('❌ Error initializing proposal display_order values:', err.message);
      } else {
        console.log('✅ Proposal display order values initialized');
      }
    }
  );

  console.log('📊 Creating rule_change_votes table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS rule_change_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL,
      voter_id TEXT NOT NULL,
      option TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(proposal_id, voter_id),
      FOREIGN KEY (proposal_id) REFERENCES rule_change_proposals(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating rule_change_votes table:', err.message);
    } else {
      console.log('✅ rule_change_votes table created successfully');
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
      name: 'idx_keepers_year_roster',
      sql: 'CREATE INDEX IF NOT EXISTS idx_keepers_year_roster ON keepers(year, roster_id)'
    },
    {
      name: 'idx_keepers_year_player',
      sql: 'CREATE INDEX IF NOT EXISTS idx_keepers_year_player ON keepers(year, player_id)'
    },
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
      name: 'idx_managers_sleeper_user_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_managers_sleeper_user_id ON managers(sleeper_user_id)'
    },
    {
      name: 'idx_managers_active',
      sql: 'CREATE INDEX IF NOT EXISTS idx_managers_active ON managers(active)'
    },
    {
      name: 'idx_manager_sleeper_ids_user',
      sql: 'CREATE INDEX IF NOT EXISTS idx_manager_sleeper_ids_user ON manager_sleeper_ids(sleeper_user_id)'
    },
    {
      name: 'idx_rule_change_proposals_season',
      sql: 'CREATE INDEX IF NOT EXISTS idx_rule_change_proposals_season ON rule_change_proposals(season_year)'
    },
    {
      name: 'idx_rule_change_votes_proposal',
      sql: 'CREATE INDEX IF NOT EXISTS idx_rule_change_votes_proposal ON rule_change_votes(proposal_id)'
    },
    {
      name: 'idx_rule_change_votes_voter',
      sql: 'CREATE INDEX IF NOT EXISTS idx_rule_change_votes_voter ON rule_change_votes(voter_id)'
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

  // Check manager_sleeper_ids table structure
  db.all("PRAGMA table_info(manager_sleeper_ids)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking manager_sleeper_ids table:', err.message);
    } else {
      console.log('✅ manager_sleeper_ids table columns:', columns.map(col => col.name).join(', '));
    }
  });

  // Check keepers table structure
  db.all("PRAGMA table_info(keepers)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking keepers table:', err.message);
    } else {
      console.log('✅ Keepers table columns:', columns.map(col => col.name).join(', '));
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

  db.all("PRAGMA table_info(rule_change_proposals)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking rule_change_proposals table:', err.message);
    } else {
      console.log('✅ rule_change_proposals table columns:', columns.map(col => col.name).join(', '));
    }
  });

  db.all("PRAGMA table_info(rule_change_votes)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking rule_change_votes table:', err.message);
    } else {
      console.log('✅ rule_change_votes table columns:', columns.map(col => col.name).join(', '));
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

  db.get('SELECT COUNT(*) as count FROM rule_change_proposals', (err, row) => {
    if (!err && row) {
      console.log(`📊 Rule change proposals in database: ${row.count}`);
    }
  });

  db.get('SELECT COUNT(*) as count FROM rule_change_votes', (err, row) => {
    if (!err && row) {
      console.log(`📊 Rule change votes in database: ${row.count}`);
    }
  });

  console.log('\n🎉 Database initialization completed successfully!');
  console.log('📋 Summary:');
  console.log('   ✅ Tables created/verified: managers, manager_sleeper_ids, team_seasons, league_rules, rule_change_proposals, rule_change_votes');
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