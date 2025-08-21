const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'fantasy_football.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Running migration: add player_id column to keepers table...');

db.serialize(() => {
  db.run(
    `ALTER TABLE keepers ADD COLUMN player_id TEXT;`,
    err => {
      if (err && err.message.includes('duplicate column name')) {
        console.log('ℹ️  player_id column already exists');
      } else if (err) {
        console.error('❌ Error adding player_id column:', err.message);
      } else {
        console.log('✅ Added player_id column');
      }
    }
  );

  db.run(
    `CREATE INDEX IF NOT EXISTS idx_keepers_year_player ON keepers(year, player_id);`,
    err => {
      if (err) {
        console.error('❌ Error creating idx_keepers_year_player index:', err.message);
      } else {
        console.log('✅ Created idx_keepers_year_player index');
      }
    }
  );
});

db.close(err => {
  if (err) {
    console.error('❌ Error closing database:', err.message);
  } else {
    console.log('✅ Migration completed and database closed.');
  }
});
