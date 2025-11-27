const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'fantasy_football.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT COUNT(*) as count FROM team_seasons', (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }

  console.log('team_seasons count:', rows[0].count);

  if (rows[0].count > 0) {
    db.all('SELECT * FROM team_seasons LIMIT 3', (err2, samples) => {
      if (err2) {
        console.error('Error fetching samples:', err2);
      } else {
        console.log('Sample records:', JSON.stringify(samples, null, 2));
      }
      db.close();
    });
  } else {
    db.close();
  }
});
