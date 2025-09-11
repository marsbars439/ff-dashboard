const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'fantasy_football.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
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
  `, err => {
    if (err) {
      console.error('Error creating ros_rankings table:', err.message);
    } else {
      console.log('ros_rankings table created or already exists.');
    }
  });
});

db.close();
