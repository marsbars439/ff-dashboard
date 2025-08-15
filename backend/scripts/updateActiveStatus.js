// Save this as backend/scripts/updateActiveStatus.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'fantasy_football.db');
const db = new sqlite3.Database(dbPath);

// Based on your seed data - these should be INACTIVE
const inactiveManagers = [
  'samcarlos',      // Sam Carlos
  'scottzagorski',  // Scott Zagorski  
  'steveshiffer'    // Steve Shiffer
];

// These should be ACTIVE
const activeManagers = [
  'byronkou',               // Byron Kou
  'carlosortiz',           // Carlos Ortiz
  'danguadronjasonvoss',   // Dan Guadron/Jason Voss
  'davepasi',              // Dave Pasi
  'markreischel',          // Mark Reischel
  'marshallroshto',        // Marshall Roshto
  'robcolaneri',           // Rob Colaneri
  'ruairilynch',           // Ruairi Lynch
  'stevescicchitano',      // Steve Scicchitano
  'willhubbard'            // Will Hubbard
];

console.log('🔄 Updating manager active status...');
console.log('=====================================');

// First, let's see current status
db.all('SELECT name_id, full_name, active FROM managers ORDER BY full_name', [], (err, rows) => {
  if (err) {
    console.error('❌ Error fetching current status:', err.message);
    return;
  }
  
  console.log('\n📊 CURRENT STATUS:');
  rows.forEach(row => {
    const status = row.active ? '🟢 ACTIVE' : '🔴 INACTIVE';
    console.log(`${status}: ${row.full_name} (${row.name_id})`);
  });
  
  console.log('\n🔧 MAKING UPDATES...');
  
  // Set inactive managers
  if (inactiveManagers.length > 0) {
    const inactiveQuery = `UPDATE managers SET active = 0 WHERE name_id IN (${inactiveManagers.map(() => '?').join(',')})`;
    db.run(inactiveQuery, inactiveManagers, function(err) {
      if (err) {
        console.error('❌ Error updating inactive managers:', err.message);
      } else {
        console.log(`✅ Set ${this.changes} managers to INACTIVE: ${inactiveManagers.join(', ')}`);
      }
      
      // Set active managers
      if (activeManagers.length > 0) {
        const activeQuery = `UPDATE managers SET active = 1 WHERE name_id IN (${activeManagers.map(() => '?').join(',')})`;
        db.run(activeQuery, activeManagers, function(err) {
          if (err) {
            console.error('❌ Error updating active managers:', err.message);
          } else {
            console.log(`✅ Set ${this.changes} managers to ACTIVE: ${activeManagers.join(', ')}`);
          }
          
          // Show final results
          setTimeout(() => {
            console.log('\n📊 FINAL STATUS:');
            console.log('=================');
            db.all('SELECT name_id, full_name, active FROM managers ORDER BY active DESC, full_name', [], (err, finalRows) => {
              if (err) {
                console.error('❌ Error fetching final results:', err.message);
              } else {
                console.log('\n🟢 ACTIVE MANAGERS:');
                finalRows.filter(r => r.active).forEach(row => {
                  console.log(`   ${row.full_name} (${row.name_id})`);
                });
                
                console.log('\n🔴 INACTIVE MANAGERS:');
                finalRows.filter(r => !r.active).forEach(row => {
                  console.log(`   ${row.full_name} (${row.name_id})`);
                });
                
                console.log('\n✅ Update complete! Restart your backend server to see changes.');
              }
              db.close();
            });
          }, 500);
        });
      }
    });
  }
});
