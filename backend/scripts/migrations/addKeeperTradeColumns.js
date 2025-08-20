const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'fantasy_football.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Running migration: add trade columns to keepers table...');

db.serialize(() => {
  db.run(`
    ALTER TABLE keepers ADD COLUMN trade_from_roster_id INTEGER;
  `, err => {
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
  `, err => {
    if (err && err.message.includes('duplicate column name')) {
      console.log('ℹ️  trade_amount column already exists');
    } else if (err) {
      console.error('❌ Error adding trade_amount column:', err.message);
    } else {
      console.log('✅ Added trade_amount column');
    }
  });
});

db.close(err => {
  if (err) {
    console.error('❌ Error closing database:', err.message);
  } else {
    console.log('✅ Migration completed and database closed.');
  }
});
