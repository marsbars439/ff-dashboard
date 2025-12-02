/**
 * Database utility functions
 * Promisified SQLite operations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./logger');

/**
 * Initialize database connection
 */
function initDatabase() {
  const dbPath = path.join(__dirname, '..', 'data', 'fantasy_football.db');
  const db = new sqlite3.Database(dbPath);

  logger.info('Database connected', { path: dbPath });

  return db;
}

/**
 * Promisified database operations
 */
function promisifyDb(db) {
  const runAsync = (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  const getAsync = (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  const allAsync = (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  return { db, runAsync, getAsync, allAsync };
}

/**
 * Ensure a column exists in a table (for migrations)
 */
async function ensureColumnExists(db, tableName, columnName, definition) {
  if (!tableName || !columnName || !definition) {
    return;
  }

  return new Promise((resolve) => {
    db.run(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
      (err) => {
        if (err && !/duplicate column name/i.test(err.message)) {
          logger.error('Error adding column to table', {
            tableName,
            columnName,
            error: err.message
          });
        }
        resolve();
      }
    );
  });
}

/**
 * Initialize proposal display order
 */
async function assignInitialProposalDisplayOrder(db) {
  return new Promise((resolve) => {
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
        if (err && !/no such column/i.test(err.message)) {
          logger.error('Error initializing proposal display order', { error: err.message });
        }
        resolve();
      }
    );
  });
}

/**
 * Database middleware for Express
 * Attaches db helpers to req object
 */
function databaseMiddleware(db) {
  const { runAsync, getAsync, allAsync } = promisifyDb(db);

  return (req, res, next) => {
    req.db = { db, runAsync, getAsync, allAsync };
    next();
  };
}

module.exports = {
  initDatabase,
  promisifyDb,
  ensureColumnExists,
  assignInitialProposalDisplayOrder,
  databaseMiddleware
};
