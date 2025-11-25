/**
 * Database Initialization and Migrations
 * Creates tables and ensures schema is up to date
 */

const logger = require('../utils/logger');
const { ensureColumnExists, assignInitialProposalDisplayOrder } = require('../utils/database');

/**
 * Initialize all database tables and run migrations
 */
async function initializeDatabaseSchema(db) {
  logger.info('Initializing database schema');

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      try {
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');

        // Create managers table
        db.run(`
          CREATE TABLE IF NOT EXISTS managers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name_id TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            sleeper_username TEXT,
            sleeper_user_id TEXT,
            email TEXT,
            passcode TEXT,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Migrate managers table
        ensureColumnExists(db, 'managers', 'sleeper_user_id', 'TEXT');
        ensureColumnExists(db, 'managers', 'email', 'TEXT');
        ensureColumnExists(db, 'managers', 'passcode', 'TEXT');
        ensureColumnExists(db, 'managers', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

        // Create manager_emails table
        db.run(`
          CREATE TABLE IF NOT EXISTS manager_emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            manager_id INTEGER NOT NULL,
            email TEXT NOT NULL,
            is_primary INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(email),
            FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE CASCADE
          )
        `);

        // Create indexes
        db.run('CREATE INDEX IF NOT EXISTS idx_manager_emails_manager_id ON manager_emails(manager_id)');
        db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_manager_emails_primary ON manager_emails(manager_id) WHERE is_primary = 1');
        db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_manager_emails_unique_email_nocase ON manager_emails(email COLLATE NOCASE)');

        // Create team_seasons table
        db.run(`
          CREATE TABLE IF NOT EXISTS team_seasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            name_id TEXT NOT NULL,
            team_name TEXT,
            wins INTEGER,
            losses INTEGER,
            points_for REAL,
            points_against REAL,
            regular_season_rank INTEGER,
            playoff_finish INTEGER,
            dues REAL,
            payout REAL,
            dues_chumpion REAL DEFAULT 0,
            high_game REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(year, name_id)
          )
        `);

        ensureColumnExists(db, 'team_seasons', 'dues_chumpion', 'REAL DEFAULT 0');
        ensureColumnExists(db, 'team_seasons', 'high_game', 'REAL');

        // Create keepers table
        db.run(`
          CREATE TABLE IF NOT EXISTS keepers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            roster_id INTEGER NOT NULL,
            player_id TEXT NOT NULL,
            player_name TEXT,
            position TEXT,
            team TEXT,
            trade_from_roster_id INTEGER,
            trade_amount REAL,
            trade_note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(year, roster_id, player_id)
          )
        `);

        // Migrate keepers table
        ensureColumnExists(db, 'keepers', 'trade_from_roster_id', 'INTEGER');
        ensureColumnExists(db, 'keepers', 'trade_amount', 'REAL');
        ensureColumnExists(db, 'keepers', 'trade_note', 'TEXT');
        ensureColumnExists(db, 'keepers', 'player_id', 'TEXT');

        // Create keeper_trade_locks table
        db.run(`
          CREATE TABLE IF NOT EXISTS keeper_trade_locks (
            season_year INTEGER PRIMARY KEY,
            locked INTEGER NOT NULL DEFAULT 0,
            locked_at DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create league_settings table
        db.run(`
          CREATE TABLE IF NOT EXISTS league_settings (
            year INTEGER PRIMARY KEY,
            league_id TEXT,
            draft_date TEXT,
            sync_status TEXT DEFAULT 'pending',
            last_synced DATETIME,
            last_sync_attempt DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create rule_change_proposals table
        db.run(`
          CREATE TABLE IF NOT EXISTS rule_change_proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season_year INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            proposed_by TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            options TEXT NOT NULL,
            display_order INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Migrate display_order column
        db.run(
          'ALTER TABLE rule_change_proposals ADD COLUMN display_order INTEGER',
          (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              logger.error('Error adding display_order column to rule_change_proposals', {
                error: err.message
              });
            } else {
              assignInitialProposalDisplayOrder(db);
            }
          }
        );

        // Create rule_votes table
        db.run(`
          CREATE TABLE IF NOT EXISTS rule_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proposal_id INTEGER NOT NULL,
            manager_id TEXT NOT NULL,
            vote TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(proposal_id, manager_id),
            FOREIGN KEY (proposal_id) REFERENCES rule_change_proposals(id) ON DELETE CASCADE
          )
        `);

        // Create summaries table
        db.run(`
          CREATE TABLE IF NOT EXISTS summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            summary TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create previews table
        db.run(`
          CREATE TABLE IF NOT EXISTS previews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            summary TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create ros_rankings table
        db.run(`
          CREATE TABLE IF NOT EXISTS ros_rankings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT NOT NULL,
            team TEXT,
            position TEXT,
            proj_pts REAL,
            sos_season REAL,
            sos_playoffs REAL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        logger.info('Database schema initialized successfully');
        resolve();
      } catch (error) {
        logger.error('Error initializing database schema', { error: error.message });
        reject(error);
      }
    });
  });
}

module.exports = {
  initializeDatabaseSchema
};
