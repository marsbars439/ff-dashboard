const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'fantasy_football.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Running migration: add manager_sleeper_ids table...');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS manager_sleeper_ids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_id TEXT NOT NULL,
      sleeper_user_id TEXT NOT NULL,
      season INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (name_id) REFERENCES managers(name_id),
      UNIQUE(sleeper_user_id, season)
    )
  `, err => {
    if (err) {
      console.error('❌ Error creating manager_sleeper_ids table:', err.message);
    } else {
      console.log('✅ manager_sleeper_ids table ready');
    }
  });

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_manager_sleeper_ids_user
    ON manager_sleeper_ids(sleeper_user_id)
  `, err => {
    if (err) {
      console.error('❌ Error creating index idx_manager_sleeper_ids_user:', err.message);
    } else {
      console.log('✅ Created index idx_manager_sleeper_ids_user');
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
