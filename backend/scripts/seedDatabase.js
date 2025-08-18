const sqlite3 = require('sqlite3').verbose();
const XLSX = require('xlsx');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'fantasy_football.db');
const db = new sqlite3.Database(dbPath);

// Sample managers data
const managers = [
  {
    name_id: 'byronkou',
    full_name: 'Byron Kou',
    sleeper_username: 'bsbllplyr968',
    sleeper_user_id: '',
    active: 1
  },
  {
    name_id: 'carlosortiz',
    full_name: 'Carlos Ortiz',
    sleeper_username: 'jcmbortiz',
    sleeper_user_id: '',
    active: 1
  },
  {
    name_id: 'danguadronjasonvoss',
    full_name: 'Dan Guadron/Jason Voss',
    sleeper_username: 'jvoss7',
    sleeper_user_id: '',
    active: 1
  },
  {
    name_id: 'davepasi',
    full_name: 'Dave Pasi',
    sleeper_username: 'depiii26',
    sleeper_user_id: '',
    active: 1
  },
  {
    name_id: 'markreischel',
    full_name: 'Mark Reischel',
    sleeper_username: 'markr729',
    sleeper_user_id: '',
    active: 1
  },
  {
    name_id: 'marshallroshto',
    full_name: 'Marshall Roshto',
    sleeper_username: 'roshto',
    sleeper_user_id: '',
    active: 1
  },
  {
    name_id: 'robcolaneri',
    full_name: 'Rob Colaneri',
    sleeper_username: 'raabcalamari',
    sleeper_user_id: '',
    active: 1
  },
  {
    name_id: 'ruairilynch',
    full_name: 'Ruairi Lynch',
    sleeper_username: 'rlynch9',
    sleeper_user_id: '',
    active: 1
  },
  {
    name_id: 'stevescicchitano',
    full_name: 'Steve Scicchitano',
    sleeper_username: 'SteveScicc',
    sleeper_user_id: '',
    active: 1
  },
  {
    name_id: 'willhubbard',
    full_name: 'Will Hubbard',
    sleeper_username: 'whubbard9',
    sleeper_user_id: '',
    active: 1
  },
  {
    name_id: 'samcarlos',
    full_name: 'Sam Carlos',
    sleeper_username: 'samlols',
    sleeper_user_id: '',
    active: 0
  },
  {
    name_id: 'scottzagorski',
    full_name: 'Scott Zagorski',
    sleeper_username: '',
    sleeper_user_id: '',
    active: 0
  },
  {
    name_id: 'steveshiffer',
    full_name: 'Steve Shiffer',
    sleeper_username: 'shiffnasty',
    sleeper_user_id: '',
    active: 0
  }
];

// Function to seed managers
function seedManagers() {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO managers (name_id, full_name, sleeper_username, sleeper_user_id, active)
      VALUES (?, ?, ?, ?, ?)
    `);

    managers.forEach(manager => {
      stmt.run([manager.name_id, manager.full_name, manager.sleeper_username, manager.sleeper_user_id || '', manager.active]);
    });

    stmt.finalize((err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Seeded ${managers.length} managers`);
        resolve();
      }
    });
  });
}

// Function to seed from Excel file if it exists
function seedFromExcel() {
  return new Promise((resolve, reject) => {
    const excelPath = path.join(__dirname, '..', '..', 'team_seasons.xlsx');
    
    // Check if Excel file exists
    const fs = require('fs');
    if (!fs.existsSync(excelPath)) {
      console.log('Excel file not found, skipping Excel import');
      resolve();
      return;
    }

    try {
      const workbook = XLSX.readFile(excelPath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO team_seasons (
          year, name_id, team_name, wins, losses, points_for, points_against,
          regular_season_rank, playoff_finish, dues, payout, high_game
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      jsonData.forEach(row => {
        stmt.run([
          row.year,
          row.name_id,
          row.team_name || '',
          row.wins,
          row.losses,
          row.points_for || 0,
          row.points_against || 0,
          row.regular_season_rank || null,
          row.playoff_finish || null,
          row.dues || 200,
          row.payout || 0,
          row.high_game || null
        ]);
      });

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Seeded ${jsonData.length} team seasons from Excel`);
          resolve();
        }
      });

    } catch (error) {
      console.error('Error reading Excel file:', error);
      resolve(); // Continue even if Excel import fails
    }
  });
}

// Main seeding function
async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    
    await seedManagers();
    await seedFromExcel();
    
    console.log('Database seeding completed successfully!');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed.');
      }
    });
  }
}

// Run seeding
seedDatabase();