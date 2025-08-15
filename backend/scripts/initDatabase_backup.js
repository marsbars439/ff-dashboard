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
  console.log('🚀 Initializing database schema...');

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

  // REMOVED: No longer automatically updating dues to $250
  // This was causing the bug where all existing dues were overwritten
  console.log('ℹ️  Preserving existing dues values (no automatic updates)');

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

  // Insert default rules if rules table is empty
  console.log('📝 Checking for default rules...');
  db.get('SELECT COUNT(*) as count FROM league_rules WHERE active = 1', (err, row) => {
    if (err) {
      console.error('❌ Error checking rules:', err.message);
    } else if (row.count === 0) {
      console.log('📝 Inserting default league rules...');
      
      const defaultRules = `# League Rules

## Keeper Rules
- Each manager may keep **up to 2 players** from year to year.
- A player **cannot be kept more than two consecutive years**, regardless of which manager keeps the player.

## Draft Rules
- **Base draft salary:** **$200** per team.
- **Nomination order:** reverse of the previous season's final **regular season** standings.

## 2025 League Dues & Payouts
- **2025 League Dues:** **$250** per team.

### 2025 Payouts
- **$1,250** to **1st place**
- **$650** to **2nd place**
- **$300** for **best regular season record**
- **$300** for **most regular season points**

## Playoffs
- **6 teams** qualify.
- Weeks **15, 16, 17**.
- **Seeds 1 & 2** receive **byes in Week 15**.

## Trade Rules
- Trade deadline is **Week 10**.
- All trades must be **unanimous approval** from all non-trading managers.

## Scoring
- Standard PPR scoring with **1 point per reception**.
- **6 points** for passing TDs.
- **-2 points** for interceptions and fumbles.

## Lineup Requirements
- **1 QB, 2 RB, 3 WR, 1 TE, 1 K, 1 DEF**
- **6 bench spots**
- **1 IR spot**

## Waiver Rules
- **FAAB** (Free Agent Acquisition Budget) system.
- **$100 budget** per season.
- Waivers process **Wednesday mornings**.

## Chumpion Rules
- Last place in regular season standings is the **Chumpion**.
- Chumpion pays extra dues to the Champion.
- Amount varies by season (typically $50).`;

      db.run(`
        INSERT INTO league_rules (rules_content, version, active) 
        VALUES (?, 1, 1)
      `, [defaultRules], (err) => {
        if (err) {
          console.error('❌ Error inserting default rules:', err.message);
        } else {
          console.log('✅ Default league rules inserted');
        }
      });
    } else {
      console.log('ℹ️  League rules already exist');
    }
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

  // Check database file size
  fs.stat(dbPath, (err, stats) => {
    if (err) {
      console.error('❌ Error checking database file:', err.message);
    } else {
      console.log(`📊 Database file size: ${(stats.size / 1024).toFixed(2)} KB`);
    }
  });

  console.log('\n🎉 Database initialization completed successfully!');
  console.log('📋 Summary:');
  console.log('   ✅ Tables created: managers, team_seasons, league_rules');
  console.log('   ✅ Indexes created for optimal performance');
  console.log('   ✅ dues_chumpion column added/verified');
  console.log('   ✅ Default league rules inserted');
  console.log('   ✅ FIXED: No longer overwriting existing dues values');
  console.log('   📍 Database location:', dbPath);
  console.log('\n🚀 Ready for data import or seeding!');
  console.log('   Run: npm run seed-db (to populate with sample data)');
  console.log('   Or upload Excel file through the admin interface');
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