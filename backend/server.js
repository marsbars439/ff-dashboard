const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const crypto = require('crypto');
const sleeperService = require('./services/sleeperService');
const summaryService = require('./services/summaryService');
const weeklySummaryService = require('./services/weeklySummaryService');
const fantasyProsService = require('./services/fantasyProsService');
const { createAuthRouter } = require('./routes/auth');
const { createRulesRouter } = require('./routes/rules');
const { createSleeperRouter } = require('./routes/sleeper');
const { createSummariesRouter } = require('./routes/summaries');
const { createCloudflareAccessService } = require('./services/cloudflareAccess');
const { createRateLimiters } = require('./services/rateLimit');
const { scheduleBackgroundJobs } = require('./services/backgroundJobs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const resolveTrustProxySetting = () => {
  const envValue =
    typeof process.env.EXPRESS_TRUST_PROXY === 'string'
      ? process.env.EXPRESS_TRUST_PROXY
      : typeof process.env.TRUST_PROXY === 'string'
        ? process.env.TRUST_PROXY
        : '';

  const rawValue = envValue.trim();

  if (!rawValue) {
    return process.env.NODE_ENV === 'production' ? 1 : false;
  }

  const normalizedValue = rawValue.toLowerCase();

  if (['true', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['false', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  const numericValue = Number(rawValue);

  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }

  return rawValue;
};

const trustProxySetting = resolveTrustProxySetting();
app.set('trust proxy', trustProxySetting);

if (trustProxySetting) {
  console.log(`Express trust proxy configuration enabled: ${trustProxySetting}`);
} else {
  console.warn(
    'Express trust proxy configuration disabled; forwarded headers from proxies will be ignored.'
  );
}

const envAdminPassword =
  process.env.ADMIN_PASSWORD !== undefined
    ? process.env.ADMIN_PASSWORD
    : process.env.REACT_APP_ANALYTICS_PASSWORD;
const ADMIN_PASSWORD = typeof envAdminPassword === 'string' ? envAdminPassword : '';

const { summarizeLimiter, cloudflareAccessLimiter } = createRateLimiters({
  summaryWindowMs: process.env.SUMMARY_RATE_LIMIT_WINDOW_MS,
  summaryMax: process.env.SUMMARY_RATE_LIMIT_MAX,
  cloudflareWindowMs: process.env.CF_MANAGER_AUTH_RATE_LIMIT_WINDOW_MS,
  cloudflareMax: process.env.CF_MANAGER_AUTH_RATE_LIMIT_MAX
});

const cloudflareAccessService = createCloudflareAccessService({
  teamDomain: process.env.CF_ACCESS_TEAM_DOMAIN,
  jwtAudience: process.env.CF_ACCESS_JWT_AUD,
  validateJwt: process.env.CF_ACCESS_VALIDATE_JWT,
  jwksCacheMs: process.env.CF_ACCESS_JWKS_CACHE_MS,
  jwksTimeoutMs: process.env.CF_ACCESS_JWKS_TIMEOUT_MS
});

const normalizeOrigin = origin => {
  if (typeof origin !== 'string') {
    return '';
  }

  const trimmedOrigin = origin.trim();

  if (!trimmedOrigin) {
    return '';
  }

  try {
    const parsed = new URL(trimmedOrigin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (error) {
    return trimmedOrigin.replace(/\/+$/, '');
  }
};

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

const isLoopbackOrigin = (origin) => {
  if (!origin) {
    return false;
  }

  try {
    const { hostname } = new URL(origin);
    return loopbackHosts.has(hostname);
  } catch (error) {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);
  }
};

const resolveAllowedCorsOrigins = () => {
  const envValue =
    typeof process.env.CORS_ALLOWED_ORIGINS === 'string'
      ? process.env.CORS_ALLOWED_ORIGINS
      : '';

  if (envValue.trim()) {
    return {
      origins: envValue
        .split(',')
        .map(normalizeOrigin)
        .filter(Boolean),
      inferred: false
    };
  }

  const inferredOrigins = new Set();

  if (process.env.FRONTEND_ORIGIN) {
    inferredOrigins.add(normalizeOrigin(process.env.FRONTEND_ORIGIN));
  }

  if (process.env.REACT_APP_BASE_URL) {
    inferredOrigins.add(normalizeOrigin(process.env.REACT_APP_BASE_URL));
  }

  if (process.env.PUBLIC_URL) {
    inferredOrigins.add(normalizeOrigin(process.env.PUBLIC_URL));
  }

  if (process.env.NODE_ENV !== 'production') {
    inferredOrigins.add(normalizeOrigin('http://localhost:3000'));
    inferredOrigins.add(normalizeOrigin('http://127.0.0.1:3000'));
  }

  const portNumber = Number(process.env.PORT || PORT);
  if (!Number.isNaN(portNumber)) {
    inferredOrigins.add(normalizeOrigin(`http://localhost:${portNumber}`));
    inferredOrigins.add(normalizeOrigin(`http://127.0.0.1:${portNumber}`));
  }

  return {
    origins: Array.from(inferredOrigins).filter(Boolean),
    inferred: true
  };
};

const { origins: resolvedCorsOrigins, inferred: corsOriginsWereInferred } =
  resolveAllowedCorsOrigins();
const hasNonLoopbackCorsOrigin = resolvedCorsOrigins.some((origin) => !isLoopbackOrigin(origin));
const allowedCorsOrigins =
  !corsOriginsWereInferred || hasNonLoopbackCorsOrigin ? resolvedCorsOrigins : [];
const normalizedAllowedCorsOrigins = new Set(allowedCorsOrigins.map(normalizeOrigin));

if (allowedCorsOrigins.length) {
  console.log(`CORS allowed origins: ${allowedCorsOrigins.join(', ')}`);
} else {
  console.log('CORS allowed origins: reflecting request origin');
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (
      !allowedCorsOrigins.length ||
      normalizedAllowedCorsOrigins.has(normalizeOrigin(origin))
    ) {
      return callback(null, origin);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Database connection
const dbPath = path.join(__dirname, 'data', 'fantasy_football.db');
const db = new sqlite3.Database(dbPath);

const ensureColumnExists = (tableName, columnName, definition) => {
  if (!tableName || !columnName || !definition) {
    return;
  }

  db.run(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
    err => {
      if (err && !/duplicate column name/i.test(err.message)) {
        console.error(`Error adding ${columnName} column to ${tableName}:`, err.message);
      }
    }
  );
};

const assignInitialProposalDisplayOrder = () => {
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
    err => {
      if (err && !/no such column/i.test(err.message)) {
        console.error('Error initializing proposal display order:', err.message);
      }
    }
  );
};

// Ensure keepers table exists
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      sleeper_username TEXT,
      sleeper_user_id TEXT,
      email TEXT,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  ensureColumnExists('managers', 'sleeper_user_id', 'TEXT');
  ensureColumnExists('managers', 'email', 'TEXT');
  ensureColumnExists('managers', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

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

  db.run(
    `DELETE FROM manager_emails
     WHERE email IS NOT NULL AND LENGTH(TRIM(email)) > 0
       AND id NOT IN (
         SELECT MIN(id)
         FROM manager_emails
         WHERE email IS NOT NULL AND LENGTH(TRIM(email)) > 0
         GROUP BY LOWER(email)
       )`
  );

  db.run(
    `UPDATE manager_emails
     SET email = LOWER(TRIM(email))
     WHERE email IS NOT NULL AND email != LOWER(TRIM(email))`
  );

  db.run(
    'CREATE INDEX IF NOT EXISTS idx_manager_emails_manager_id ON manager_emails(manager_id)'
  );

  db.run(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_manager_emails_primary ON manager_emails(manager_id) WHERE is_primary = 1'
  );

  db.run(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_manager_emails_unique_email_nocase ON manager_emails(email COLLATE NOCASE)'
  );

  db.run(
    `INSERT OR IGNORE INTO manager_emails (manager_id, email, is_primary)
     SELECT id, LOWER(TRIM(email)), 1
      FROM managers
      WHERE email IS NOT NULL AND LENGTH(TRIM(email)) > 0`
  );

  db.run(
    `UPDATE managers
     SET email = LOWER(TRIM(email))
     WHERE email IS NOT NULL AND email != LOWER(TRIM(email))`
  );

  db.run(
    `UPDATE managers
     SET email = (
       SELECT email
       FROM manager_emails
       WHERE manager_id = managers.id AND is_primary = 1
       ORDER BY id ASC
       LIMIT 1
     )
     WHERE EXISTS (
       SELECT 1
       FROM manager_emails
       WHERE manager_id = managers.id
     )`
  );

  db.run(
    `UPDATE managers
     SET email = NULL
     WHERE NOT EXISTS (
       SELECT 1
       FROM manager_emails
       WHERE manager_id = managers.id
     )`
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS keepers (
      year INTEGER,
      roster_id INTEGER,
      player_id TEXT,
      player_name TEXT,
      previous_cost REAL,
      years_kept INTEGER DEFAULT 0,
      trade_from_roster_id INTEGER,
      trade_amount REAL,
      trade_note TEXT,
      PRIMARY KEY (year, roster_id, player_id)
    )
  `);

  // Ensure new trade columns exist for legacy databases
  db.run(
    `ALTER TABLE keepers ADD COLUMN trade_from_roster_id INTEGER`,
    err => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding trade_from_roster_id column:', err.message);
      }
    }
  );

  db.run(
    `ALTER TABLE keepers ADD COLUMN trade_amount REAL`,
    err => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding trade_amount column:', err.message);
      }
    }
  );

  db.run(
    `ALTER TABLE keepers ADD COLUMN trade_note TEXT`,
    err => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding trade_note column:', err.message);
      }
    }
  );

  // Ensure player_id column exists for legacy databases
  db.run(
    `ALTER TABLE keepers ADD COLUMN player_id TEXT`,
    err => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding player_id column:', err.message);
      }
    }
  );

  // Index to speed up lookup by year and player
  db.run(
    'CREATE INDEX IF NOT EXISTS idx_keepers_year_player ON keepers(year, player_id)'
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS keeper_trade_locks (
      season_year INTEGER PRIMARY KEY,
      locked INTEGER NOT NULL DEFAULT 0,
      locked_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table for rest-of-season rankings
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
  `);

  // Table for manually entered trades not tied to keepers
  db.run(`
    CREATE TABLE IF NOT EXISTS manual_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER,
      from_roster_id INTEGER,
      to_roster_id INTEGER,
      amount REAL,
      description TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rule_change_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_year INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      options TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(
    `ALTER TABLE rule_change_proposals ADD COLUMN display_order INTEGER`,
    err => {
      if (err) {
        if (!err.message.includes('duplicate column name')) {
          console.error('Error adding display_order column to rule_change_proposals:', err.message);
        }
      } else {
        assignInitialProposalDisplayOrder();
      }
    }
  );

  assignInitialProposalDisplayOrder();

  db.run(`
    CREATE TABLE IF NOT EXISTS rule_change_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL,
      voter_id TEXT NOT NULL,
      option TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(proposal_id, voter_id),
      FOREIGN KEY (proposal_id) REFERENCES rule_change_proposals(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rule_change_voting_locks (
      season_year INTEGER PRIMARY KEY,
      locked INTEGER NOT NULL DEFAULT 0,
      locked_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(
    'CREATE INDEX IF NOT EXISTS idx_rule_change_proposals_season ON rule_change_proposals(season_year)'
  );

  db.run(
    'CREATE INDEX IF NOT EXISTS idx_rule_change_votes_proposal ON rule_change_votes(proposal_id)'
  );

  db.run(
    'CREATE INDEX IF NOT EXISTS idx_rule_change_votes_voter ON rule_change_votes(voter_id)'
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS manager_credentials (
      manager_id TEXT PRIMARY KEY,
      passcode_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (manager_id) REFERENCES managers(name_id) ON DELETE CASCADE
    )
  `);

  // Table for cached weekly AI summaries
  db.run(`
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table for cached weekly AI previews
  db.run(`
    CREATE TABLE IF NOT EXISTS previews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Helper functions for async DB operations
const runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

const normalizeSqliteTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return null;
  }

  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  const normalized = hasTimezone ? trimmed : `${trimmed}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const isValidEmailFormat = (email) => {
  if (typeof email !== 'string') {
    return false;
  }

  const trimmed = email.trim();
  if (!trimmed) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

const normalizeEmailForStorage = (email) => {
  if (typeof email !== 'string') {
    return '';
  }

  const trimmed = email.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.toLowerCase();
};

const collectManagerEmails = (payload = {}) => {
  const emailsInput = payload.emails;
  const fallbackEmail = typeof payload.email === 'string' ? payload.email : null;
  const candidates = [];

  if (Array.isArray(emailsInput)) {
    candidates.push(...emailsInput);
  }

  if (typeof fallbackEmail === 'string') {
    candidates.push(fallbackEmail);
  }

  const sanitized = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const normalized = normalizeEmailForStorage(candidate);
    if (seen.has(normalized)) {
      continue;
    }

    if (!normalized) {
      continue;
    }

    seen.add(normalized);
    sanitized.push(normalized);
  }

  return sanitized;
};

const getEmailsForManagerIds = async (managerIds = []) => {
  if (!Array.isArray(managerIds) || managerIds.length === 0) {
    return new Map();
  }

  const validIds = managerIds
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && !Number.isNaN(id));

  if (validIds.length === 0) {
    return new Map();
  }

  const placeholders = validIds.map(() => '?').join(', ');
  const rows = await allAsync(
    `SELECT manager_id, email, is_primary
     FROM manager_emails
     WHERE manager_id IN (${placeholders})
     ORDER BY manager_id, is_primary DESC, id ASC`,
    validIds
  );

  const emailMap = new Map();

  rows.forEach(row => {
    if (!emailMap.has(row.manager_id)) {
      emailMap.set(row.manager_id, []);
    }

    emailMap.get(row.manager_id).push(row.email);
  });

  return emailMap;
};

const hydrateManagersWithEmails = async (managerRows = []) => {
  if (!Array.isArray(managerRows) || managerRows.length === 0) {
    return [];
  }

  const ids = managerRows
    .map(row => Number(row?.id))
    .filter(id => Number.isInteger(id) && !Number.isNaN(id));

  const emailMap = await getEmailsForManagerIds(ids);

  return managerRows.map(row => {
    const emails = emailMap.get(row.id) || [];
    return {
      ...row,
      emails,
      email: emails[0] || (typeof row.email === 'string' ? row.email : '')
    };
  });
};

const getManagerWithEmailsById = async (managerId) => {
  if (managerId == null) {
    return null;
  }

  const row = await getAsync('SELECT * FROM managers WHERE id = ?', [managerId]);
  if (!row) {
    return null;
  }

  const [manager] = await hydrateManagersWithEmails([row]);
  return manager || null;
};

const replaceManagerEmails = async (managerId, emails = []) => {
  if (managerId == null) {
    return;
  }

  await runAsync('DELETE FROM manager_emails WHERE manager_id = ?', [managerId]);

  let insertedCount = 0;
  for (let index = 0; index < emails.length; index += 1) {
    const email = normalizeEmailForStorage(emails[index]);
    if (!email) {
      continue;
    }
    await runAsync(
      'INSERT INTO manager_emails (manager_id, email, is_primary) VALUES (?, ?, ?)',
      [managerId, email, insertedCount === 0 ? 1 : 0]
    );
    insertedCount += 1;
  }
};

const findManagerByEmail = async (email) => {
  if (typeof email !== 'string' || !email.trim()) {
    return null;
  }

  return getAsync(
    `SELECT m.id, m.name_id, m.full_name
     FROM manager_emails me
     INNER JOIN managers m ON me.manager_id = m.id
     WHERE LOWER(me.email) = LOWER(?)
     LIMIT 1`,
    [email.trim()]
  );
};

const parseBooleanFlag = (value) => {
  if (typeof value === 'boolean') {
    return { valid: true, value };
  }

  if (typeof value === 'number') {
    return { valid: true, value: value !== 0 };
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'locked'].includes(normalized)) {
      return { valid: true, value: true };
    }
    if (['false', '0', 'no', 'n', 'unlocked'].includes(normalized)) {
      return { valid: true, value: false };
    }
    if (!normalized.length) {
      return { valid: false, value: false };
    }
  }

  return { valid: false, value: false };
};



const setKeeperTradeLock = async (seasonYear, locked) => {
  const numericYear = parseInt(seasonYear, 10);
  if (Number.isNaN(numericYear)) {
    throw new Error('A valid season year is required to update the preseason lock.');
  }

  const normalizedLocked = locked ? 1 : 0;

  await runAsync(
    `INSERT INTO keeper_trade_locks (season_year, locked, locked_at, updated_at)
     VALUES (?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)
     ON CONFLICT(season_year) DO UPDATE SET
       locked = excluded.locked,
       locked_at = CASE WHEN excluded.locked = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
       updated_at = CURRENT_TIMESTAMP`,
    [numericYear, normalizedLocked, normalizedLocked]
  );

  return getKeeperTradeLockRow(numericYear);
};

const getKeeperTradeLockRow = async (seasonYear) => {
  const numericYear = parseInt(seasonYear, 10);

  if (Number.isNaN(numericYear)) {
    throw new Error('A valid season year is required to fetch the preseason lock.');
  }

  return getAsync(
    `SELECT season_year, locked, locked_at, updated_at FROM keeper_trade_locks WHERE season_year = ?`,
    [numericYear]
  );
};

const isKeeperTradeLocked = async (seasonYear) => {
  try {
    const lockRow = await getKeeperTradeLockRow(seasonYear);
    return Boolean(lockRow?.locked);
  } catch (error) {
    console.error('Error checking keeper trade lock:', error);
    return false;
  }
};

const getNextProposalDisplayOrder = async (seasonYear) => {
  const numericYear = parseInt(seasonYear, 10);

  if (Number.isNaN(numericYear)) {
    throw new Error('A valid season year is required to determine proposal order.');
  }

  const row = await getAsync(
    'SELECT MAX(display_order) AS maxOrder FROM rule_change_proposals WHERE season_year = ?',
    [numericYear]
  );

  const maxOrder = typeof row?.maxOrder === 'number' ? row.maxOrder : parseInt(row?.maxOrder, 10);
  const normalizedMax = Number.isFinite(maxOrder) ? maxOrder : 0;

  return normalizedMax + 1;
};

const ADMIN_TOKEN_TTL_MS = 1000 * 60 * 15; // 15 minutes
const activeAdminTokens = new Map();

const MANAGER_TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const activeManagerTokens = new Map();

const cleanupExpiredAdminTokens = () => {
  const now = Date.now();
  for (const [token, session] of activeAdminTokens.entries()) {
    if (!session || session.expiresAt <= now) {
      activeAdminTokens.delete(token);
    }
  }
};

setInterval(cleanupExpiredAdminTokens, ADMIN_TOKEN_TTL_MS).unref?.();

const createAdminToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ADMIN_TOKEN_TTL_MS;
  activeAdminTokens.set(token, { expiresAt });
  return { token, expiresAt };
};

const isAdminTokenValid = (token) => {
  if (!token) {
    return false;
  }

  const session = activeAdminTokens.get(token);
  if (!session) {
    return false;
  }

  if (session.expiresAt <= Date.now()) {
    activeAdminTokens.delete(token);
    return false;
  }

  session.expiresAt = Date.now() + ADMIN_TOKEN_TTL_MS;
  activeAdminTokens.set(token, session);
  return true;
};

const cleanupExpiredManagerTokens = () => {
  const now = Date.now();
  for (const [token, session] of activeManagerTokens.entries()) {
    if (!session || session.expiresAt <= now) {
      activeManagerTokens.delete(token);
    }
  }
};

setInterval(cleanupExpiredManagerTokens, MANAGER_TOKEN_TTL_MS).unref?.();

const createManagerToken = (managerId) => {
  if (!managerId) {
    throw new Error('Manager ID is required to create a token');
  }

  for (const [token, session] of activeManagerTokens.entries()) {
    if (session.managerId === managerId) {
      activeManagerTokens.delete(token);
    }
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + MANAGER_TOKEN_TTL_MS;
  activeManagerTokens.set(token, { managerId, expiresAt });
  return { token, expiresAt };
};

const isManagerTokenValid = (managerId, token) => {
  if (!managerId || !token) {
    return false;
  }

  const session = activeManagerTokens.get(token);
  if (!session || session.managerId !== managerId) {
    return false;
  }

  if (session.expiresAt <= Date.now()) {
    activeManagerTokens.delete(token);
    return false;
  }

  session.expiresAt = Date.now() + MANAGER_TOKEN_TTL_MS;
  activeManagerTokens.set(token, session);
  return true;
};

const createPasscodeHash = (passcode) => {
  if (typeof passcode !== 'string' || !passcode) {
    throw new Error('Passcode must be a non-empty string');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
};

const verifyPasscodeHash = (passcode, storedHash) => {
  if (typeof passcode !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const [salt, hashHex] = storedHash.split(':');
  if (!salt || !hashHex) {
    return false;
  }

  try {
    const derived = crypto.scryptSync(passcode, salt, 64);
    const storedBuffer = Buffer.from(hashHex, 'hex');

    if (storedBuffer.length !== derived.length) {
      return false;
    }

    return crypto.timingSafeEqual(derived, storedBuffer);
  } catch (error) {
    console.error('Failed to verify manager passcode hash:', error);
    return false;
  }
};

const extractManagerAuthFromRequest = (req) => {
  const managerIdHeader = req.headers['x-manager-id'];
  const tokenHeader = req.headers['x-manager-token'];

  const managerId = typeof managerIdHeader === 'string' ? managerIdHeader.trim() : '';
  const token = typeof tokenHeader === 'string' ? tokenHeader.trim() : '';

  return { managerId, token };
};

const requireManagerAuth = async (req, res) => {
  const { managerId, token } = extractManagerAuthFromRequest(req);

  if (!managerId || !token) {
    res.status(401).json({ error: 'Manager authentication required' });
    return null;
  }

  try {
    const managerRow = await getAsync('SELECT name_id, full_name FROM managers WHERE name_id = ?', [managerId]);

    if (!managerRow) {
      res.status(401).json({ error: 'Invalid manager identifier' });
      return null;
    }

    if (!isManagerTokenValid(managerRow.name_id, token)) {
      res.status(401).json({ error: 'Invalid or expired manager token' });
      return null;
    }

    return managerRow;
  } catch (error) {
    console.error('Error verifying manager authentication:', error);
    res.status(500).json({ error: 'Failed to verify manager authentication' });
    return null;
  }
};


const normalizeSummaryLine = line =>
  typeof line === 'string' ? line.trim().replace(/^[-*]\s*/, '') : '';

const extractSummaryLines = summary => {
  if (typeof summary !== 'string') {
    return [];
  }

  return summary
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(normalizeSummaryLine);
};

const refreshCachedSummary = async () => {
  const { summary } = await weeklySummaryService.generateWeeklySummary(db);
  await runAsync('INSERT INTO summaries (summary) VALUES (?)', [summary]);
  return summary;
};

const refreshCachedPreview = async () => {
  const { summary } = await weeklySummaryService.generateWeeklyPreview(db);
  await runAsync('INSERT INTO previews (summary) VALUES (?)', [summary]);
  return summary;
};

const refreshRosRankings = async () => {
  try {
    const { players = [], failed = [] } = await fantasyProsService.scrapeRosRankings();

    if (!players.length) {
      console.warn('No ROS rankings retrieved.');
      const error = new Error('No ROS rankings retrieved.');
      error.failed = failed;
      throw error;
    }

    await runAsync('DELETE FROM ros_rankings');
    const stmt = db.prepare(
      'INSERT INTO ros_rankings (player_name, team, position, proj_pts, sos_season, sos_playoffs) VALUES (?, ?, ?, ?, ?, ?)'
    );
    players.forEach(p => {
      stmt.run(p.player_name, p.team, p.position, p.proj_pts, p.sos_season, p.sos_playoffs);
    });
    stmt.finalize();
    console.log(`Updated ROS rankings: ${players.length} players`);

    const lastUpdatedRow = await getAsync('SELECT MAX(updated_at) AS last_updated FROM ros_rankings');
    const lastUpdated = normalizeSqliteTimestamp(lastUpdatedRow?.last_updated) || new Date().toISOString();

    if (failed.length) {
      console.warn(`Failed to fetch rankings for: ${failed.join(', ')}`);
    }

    return { updated: players.length, failed, lastUpdated };
  } catch (err) {
    const failureDetails = Array.isArray(err?.failed) ? err.failed : [];
    console.error('Failed to refresh ROS rankings:', err.message);
    if (failureDetails.length) {
      console.error(`Failure details: ${failureDetails.join(', ')}`);
    }
    err.failed = failureDetails;
    throw err;
  }
};

const syncSleeperSeason = async ({ year, leagueId, preserveManualFields = true } = {}) => {
  if (!year) {
    throw new Error('Year is required for Sleeper sync');
  }
  if (!leagueId) {
    throw new Error('League ID is required for Sleeper sync');
  }

  await runAsync(
    'UPDATE league_settings SET sync_status = ?, last_sync = CURRENT_TIMESTAMP WHERE year = ?',
    ['syncing', year]
  );

  try {
    const managers = await allAsync('SELECT * FROM managers');
    const seasonalIds = await allAsync(
      'SELECT name_id, sleeper_user_id FROM manager_sleeper_ids WHERE season = ?',
      [year]
    );

    const sleeperResult = await sleeperService.fetchLeagueData(
      leagueId,
      year,
      managers,
      seasonalIds
    );

    if (!sleeperResult.success) {
      throw new Error(sleeperResult.error);
    }

    const sleeperTeams = Array.isArray(sleeperResult.data) ? sleeperResult.data : [];
    const leagueStatus = sleeperResult.leagueStatus || null;

    const existingData = await allAsync('SELECT * FROM team_seasons WHERE year = ?', [year]);
    const existingMap = {};
    existingData.forEach(row => {
      existingMap[row.name_id] = row;
    });

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const teamData of sleeperTeams) {
      if (!teamData.name_id) {
        errorCount++;
        errors.push(
          `No manager match for Sleeper user: ${teamData.sleeper_username || teamData.sleeper_user_id}`
        );
        continue;
      }

      const existing = existingMap[teamData.name_id];

      const dataToSave = {
        ...teamData,
        dues: preserveManualFields && existing ? existing.dues : teamData.dues || 250,
        payout: preserveManualFields && existing ? existing.payout : teamData.payout || 0,
        dues_chumpion:
          preserveManualFields && existing
            ? existing.dues_chumpion
            : teamData.dues_chumpion || 0
      };

      delete dataToSave.sleeper_username;
      delete dataToSave.sleeper_user_id;

      const query = `
        INSERT INTO team_seasons (
          year, name_id, team_name, wins, losses, points_for, points_against,
          regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(year, name_id)
        DO UPDATE SET
          team_name = excluded.team_name,
          wins = excluded.wins,
          losses = excluded.losses,
          points_for = excluded.points_for,
          points_against = excluded.points_against,
          regular_season_rank = excluded.regular_season_rank,
          playoff_finish = excluded.playoff_finish,
          high_game = excluded.high_game,
          ${preserveManualFields
            ? ''
            : `
          dues = excluded.dues,
          payout = excluded.payout,
          dues_chumpion = excluded.dues_chumpion,
          `}
          updated_at = CURRENT_TIMESTAMP
      `;

      const values = [
        dataToSave.year,
        dataToSave.name_id,
        dataToSave.team_name,
        dataToSave.wins,
        dataToSave.losses,
        dataToSave.points_for,
        dataToSave.points_against,
        dataToSave.regular_season_rank,
        dataToSave.playoff_finish,
        dataToSave.dues,
        dataToSave.payout,
        dataToSave.dues_chumpion,
        dataToSave.high_game
      ];

      try {
        await runAsync(query, values);
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push(`Error saving ${dataToSave.name_id}: ${err.message}`);
      }
    }

    await runAsync(
      `UPDATE league_settings
       SET sync_status = ?,
           last_sync = CURRENT_TIMESTAMP,
           sleeper_status = ?,
           manual_complete = 0
       WHERE year = ?`,
      ['completed', leagueStatus, year]
    );

    return {
      message: 'Sync completed',
      year,
      league_id: leagueId,
      league_status: leagueStatus,
      summary: {
        total_teams: sleeperTeams.length,
        successful_updates: successCount,
        errors: errorCount,
        error_details: errors,
        preserved_manual_fields: preserveManualFields
      }
    };
  } catch (error) {
    await runAsync('UPDATE league_settings SET sync_status = ? WHERE year = ?', ['failed', year]);
    throw error;
  }
};

const syncCurrentSeasonFromSleeper = async () => {
  const seasonSettings = await getAsync(
    'SELECT year, league_id FROM league_settings WHERE year = (SELECT MAX(year) FROM league_settings)'
  );

  if (!seasonSettings || !seasonSettings.year) {
    console.warn('Skipping scheduled Sleeper sync: no season configuration found.');
    return null;
  }

  if (!seasonSettings.league_id) {
    console.warn(
      `Skipping scheduled Sleeper sync for ${seasonSettings.year}: missing league ID configuration.`
    );
    return null;
  }

  return syncSleeperSeason({
    year: seasonSettings.year,
    leagueId: seasonSettings.league_id,
    preserveManualFields: true
  });
};


// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

const getAdminTokenSession = (token) => (token ? activeAdminTokens.get(token) || null : null);
const getManagerTokenSession = (token) => (token ? activeManagerTokens.get(token) || null : null);

const authRouter = createAuthRouter({
  adminPassword: ADMIN_PASSWORD,
  createAdminToken,
  isAdminTokenValid,
  getAdminTokenSession,
  createManagerToken,
  isManagerTokenValid,
  getManagerTokenSession,
  createPasscodeHash,
  verifyPasscodeHash,
  getAsync,
  runAsync,
  findManagerByEmail,
  cloudflareAccessLimiter,
  cloudflareAccessService
});

const rulesRouter = createRulesRouter({
  getAsync,
  runAsync,
  allAsync,
  isAdminTokenValid,
  requireManagerAuth,
  parseBooleanFlag
});

const sleeperRouter = createSleeperRouter({
  allAsync,
  sleeperService,
  syncSleeperSeason
});

const summariesRouter = createSummariesRouter({
  summaryService,
  generateWeeklySummary: () => weeklySummaryService.generateWeeklySummary(db),
  generateWeeklyPreview: () => weeklySummaryService.generateWeeklyPreview(db),
  getAsync,
  runAsync,
  summarizeLimiter,
  refreshCachedSummary,
  refreshCachedPreview,
  extractSummaryLines
});

app.use('/api', authRouter);
app.use('/api', rulesRouter);
app.use('/api', sleeperRouter);
app.use('/api', summariesRouter);

// Routes

app.get('/api/managers', async (req, res) => {
  try {
    const rows = await allAsync('SELECT * FROM managers ORDER BY full_name');
    const managersWithEmails = await hydrateManagersWithEmails(rows);
    res.json({ managers: managersWithEmails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ROS rankings
app.get('/api/ros-rankings', async (req, res) => {
  try {
    const [rows, lastUpdatedRow] = await Promise.all([
      allAsync(
        'SELECT player_name, team, position, proj_pts, sos_season, sos_playoffs FROM ros_rankings ORDER BY player_name'
      ),
      getAsync('SELECT MAX(updated_at) AS last_updated FROM ros_rankings')
    ]);
    const lastUpdated = normalizeSqliteTimestamp(lastUpdatedRow?.last_updated);
    res.json({ rankings: rows, lastUpdated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ros-rankings/refresh', async (req, res) => {
  try {
    const result = await refreshRosRankings();
    res.json({ status: 'ok', ...result });
  } catch (err) {
    const failureDetails = Array.isArray(err?.failed) ? err.failed : [];
    res.status(500).json({ error: err.message, failed: failureDetails });
  }
});

// Get all team seasons
app.get('/api/team-seasons', (req, res) => {
  const query = `
    SELECT ts.*, m.full_name as manager_name 
    FROM team_seasons ts 
    LEFT JOIN managers m ON ts.name_id = m.name_id 
    ORDER BY ts.year DESC, ts.regular_season_rank ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ teamSeasons: rows });
  });
});

// Get team seasons by year
app.get('/api/team-seasons/:year', (req, res) => {
  const year = req.params.year;
  const query = `
    SELECT ts.*, m.full_name as manager_name 
    FROM team_seasons ts 
    LEFT JOIN managers m ON ts.name_id = m.name_id 
    WHERE ts.year = ? 
    ORDER BY ts.regular_season_rank ASC
  `;
  db.all(query, [year], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ teamSeasons: rows });
  });
});

// Get weekly matchups for a specific season
app.get('/api/seasons/:year/matchups', (req, res) => {
  const year = req.params.year;
  const query = 'SELECT league_id FROM league_settings WHERE year = ?';
  db.get(query, [year], async (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row || !row.league_id) {
      res.status(404).json({ error: 'League ID not found for year' });
      return;
    }
    try {
      const managers = await new Promise((resolve, reject) => {
        db.all(
          `SELECT m.name_id, m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
           FROM managers m
           LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?`,
          [year],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      const matchups = await sleeperService.getSeasonMatchups(row.league_id, managers);
      res.json({ matchups });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Get active week matchups with starting lineups
app.get('/api/seasons/:year/active-week/matchups', (req, res) => {
  const year = parseInt(req.params.year, 10);
  const requestedWeek = req.query.week ? parseInt(req.query.week, 10) : null;
  const query = 'SELECT league_id FROM league_settings WHERE year = ?';

  db.get(query, [year], async (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!row || !row.league_id) {
      res.status(404).json({ error: 'League ID not found for year' });
      return;
    }

    try {
      const managers = await allAsync(
        `SELECT m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
         FROM managers m
         LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?`,
        [year]
      );

      let week = Number.isInteger(requestedWeek) ? requestedWeek : null;
      if (!week) {
        week = await sleeperService.getCurrentNFLWeek();
      }

      if (!week) {
        res.status(400).json({ error: 'Unable to determine active week' });
        return;
      }

      const data = await sleeperService.getWeeklyMatchupsWithLineups(
        row.league_id,
        week,
        managers,
        year
      );

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Get playoff matchups for a specific season
app.get('/api/seasons/:year/playoffs', (req, res) => {
  const year = req.params.year;
  const query = 'SELECT league_id FROM league_settings WHERE year = ?';
  db.get(query, [year], async (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row || !row.league_id) {
      res.status(404).json({ error: 'League ID not found for year' });
      return;
    }
    try {
      const managers = await new Promise((resolve, reject) => {
        db.all(
          `SELECT m.name_id, m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
           FROM managers m
           LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?`,
          [year],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      const bracket = await sleeperService.getPlayoffMatchups(row.league_id, managers);
      res.json({ bracket });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Get final rosters for a specific season
app.get('/api/seasons/:year/keepers', (req, res) => {
  const year = req.params.year;
  const query = 'SELECT league_id FROM league_settings WHERE year = ?';
  db.get(query, [year], async (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row || !row.league_id) {
      res.status(404).json({ error: 'League ID not found for year' });
      return;
    }
    try {
      const managers = await new Promise((resolve, reject) => {
        db.all(
          `SELECT m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
           FROM managers m
           LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?`,
          [year],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      const { rosters, draftedPlayers } = await sleeperService.getFinalRosters(row.league_id, managers);
      res.json({ rosters, draftedPlayers });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Get stored keeper selections for a season
app.get('/api/keepers/:year', async (req, res) => {
  const year = parseInt(req.params.year);

  try {
    const rows = await allAsync(
      'SELECT roster_id, player_id, player_name, previous_cost, years_kept, trade_from_roster_id, trade_amount, trade_note FROM keepers WHERE year = ?',
      [year]
    );
    const lockRow = await getKeeperTradeLockRow(year);

    res.json({
      keepers: rows,
      locked: lockRow ? lockRow.locked === 1 : false,
      lockedAt: lockRow?.locked_at || null,
      updatedAt: lockRow?.updated_at || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/keepers/lock', async (req, res) => {
  const adminTokenHeader = req.headers['x-admin-token'];
  const adminToken = typeof adminTokenHeader === 'string' ? adminTokenHeader.trim() : '';

  if (!adminToken || !isAdminTokenValid(adminToken)) {
    return res.status(401).json({ error: 'Admin authentication is required' });
  }

  const { seasonYear, locked } = req.body || {};
  const numericYear = parseInt(seasonYear, 10);

  if (Number.isNaN(numericYear)) {
    return res.status(400).json({ error: 'A valid seasonYear is required' });
  }

  const { valid, value: desiredLocked } = parseBooleanFlag(locked);

  if (!valid) {
    return res.status(400).json({ error: 'locked must be a boolean value' });
  }

  try {
    const updatedRow = await setKeeperTradeLock(numericYear, desiredLocked);
    res.json({
      seasonYear: updatedRow?.season_year ?? numericYear,
      locked: updatedRow ? updatedRow.locked === 1 : desiredLocked,
      lockedAt: updatedRow?.locked_at || null,
      updatedAt: updatedRow?.updated_at || null
    });
  } catch (error) {
    console.error('Error updating keeper trade lock:', error);
    res.status(500).json({ error: 'Failed to update preseason lock' });
  }
});

// Save keeper selections for a roster in a given season
app.post('/api/keepers/:year/:rosterId', async (req, res) => {
  const year = parseInt(req.params.year);
  const rosterId = parseInt(req.params.rosterId);
  const players = Array.isArray(req.body.players) ? req.body.players : [];

  try {
    if (await isKeeperTradeLocked(year)) {
      return res.status(423).json({ error: 'Keeper selections are locked for this season.' });
    }

    await runAsync('DELETE FROM keepers WHERE year = ? AND roster_id = ?', [year, rosterId]);

    for (const p of players) {
      const prev = await getAsync(
        'SELECT years_kept FROM keepers WHERE year = ? AND player_id = ?',
        [year - 1, p.player_id]
      );
      const yearsKept = prev ? prev.years_kept + 1 : 0;

      await runAsync(
        'INSERT INTO keepers (year, roster_id, player_id, player_name, previous_cost, years_kept, trade_from_roster_id, trade_amount, trade_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          year,
          rosterId,
          p.player_id,
          p.name,
          p.previous_cost,
          yearsKept,
          p.trade_from_roster_id || null,
          p.trade_amount || null,
          p.trade_note || null,
        ]
      );
    }

    res.json({ message: 'Keepers saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manually entered trades not tied to keepers
app.get('/api/trades/:year', (req, res) => {
  const year = parseInt(req.params.year);
  db.all(
    'SELECT id, year, from_roster_id, to_roster_id, amount, description FROM manual_trades WHERE year = ?',
    [year],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ trades: rows });
    }
  );
});

app.post('/api/trades', async (req, res) => {
  const { year, from_roster_id, to_roster_id, amount, description } = req.body;
  if (
    year == null ||
    from_roster_id == null ||
    to_roster_id == null ||
    amount == null
  ) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await runAsync(
      'INSERT INTO manual_trades (year, from_roster_id, to_roster_id, amount, description) VALUES (?, ?, ?, ?, ?)',
      [year, from_roster_id, to_roster_id, amount, description || null]
    );
    res.json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/trades/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await runAsync('DELETE FROM manual_trades WHERE id = ?', [id]);
    res.json({ message: 'Trade deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get team seasons by manager
app.get('/api/managers/:nameId/seasons', (req, res) => {
  const nameId = req.params.nameId;
  const query = `
    SELECT ts.*, m.full_name as manager_name 
    FROM team_seasons ts 
    LEFT JOIN managers m ON ts.name_id = m.name_id 
    WHERE ts.name_id = ? 
    ORDER BY ts.year DESC
  `;
  db.all(query, [nameId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ teamSeasons: rows });
  });
});

// Get all league settings (league IDs for each year)
app.get('/api/league-settings', (req, res) => {
  const query = `
    SELECT
      ls.year,
      ls.league_id,
      ls.created_at,
      ls.updated_at,
      ktl.locked AS keeper_locked,
      ktl.locked_at AS keeper_locked_at,
      ktl.updated_at AS keeper_lock_updated_at,
      rcv.locked AS voting_locked,
      rcv.locked_at AS voting_locked_at,
      rcv.updated_at AS voting_lock_updated_at
    FROM league_settings ls
    LEFT JOIN keeper_trade_locks ktl ON ktl.season_year = ls.year
    LEFT JOIN rule_change_voting_locks rcv ON rcv.season_year = ls.year
    ORDER BY ls.year DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ settings: rows });
  });
});

// Update league ID for a specific year
app.put('/api/league-settings/:year', (req, res) => {
  const year = req.params.year;
  const { league_id } = req.body;

  const query = `
    INSERT INTO league_settings (year, league_id, manual_complete, updated_at)
    VALUES (?, ?, 0, CURRENT_TIMESTAMP)
    ON CONFLICT(year)
    DO UPDATE SET
      league_id = excluded.league_id,
      manual_complete = CASE
        WHEN excluded.league_id IS NOT NULL AND TRIM(excluded.league_id) != '' THEN 0
        ELSE league_settings.manual_complete
      END,
      updated_at = CURRENT_TIMESTAMP
  `;

  db.run(query, [year, league_id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: 'League ID updated successfully',
      year,
      league_id
    });
  });
});

app.post('/api/league-settings/:year/manual-complete', (req, res) => {
  const year = parseInt(req.params.year, 10);
  const { complete } = req.body || {};

  if (!Number.isInteger(year)) {
    return res.status(400).json({ error: 'Invalid year provided' });
  }

  const normalizedComplete = complete ? 1 : 0;

  const query = `
    INSERT INTO league_settings (year, manual_complete, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(year)
    DO UPDATE SET
      manual_complete = excluded.manual_complete,
      updated_at = CURRENT_TIMESTAMP
  `;

  db.run(query, [year, normalizedComplete], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    res.json({
      message: normalizedComplete ? 'Season marked complete' : 'Season reopened',
      year,
      manual_complete: Boolean(normalizedComplete)
    });
  });
});

// Test Sleeper API connection

// Add a new manager
app.post('/api/managers', async (req, res) => {
  const { name_id, full_name, sleeper_username, sleeper_user_id, active } = req.body;
  const emails = collectManagerEmails(req.body);
  const primaryEmail = emails[0] || '';

  if (!name_id || !full_name) {
    return res.status(400).json({ error: 'name_id and full_name are required' });
  }

  const invalidEmail = emails.find(email => !isValidEmailFormat(email));
  if (invalidEmail) {
    return res.status(400).json({ error: `Invalid email address: ${invalidEmail}` });
  }

  try {
    await runAsync('BEGIN TRANSACTION');

    const insertResult = await runAsync(
      `INSERT INTO managers (name_id, full_name, sleeper_username, sleeper_user_id, email, active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name_id,
        full_name,
        sleeper_username || '',
        sleeper_user_id || '',
        primaryEmail,
        active != null ? active : 1
      ]
    );

    const managerId = insertResult.lastID;

    if (emails.length > 0) {
      await replaceManagerEmails(managerId, emails);
    }

    await runAsync('COMMIT');

    const manager = await getManagerWithEmailsById(managerId);

    res.json({
      message: 'Manager added successfully',
      manager
    });
  } catch (error) {
    await runAsync('ROLLBACK').catch(() => {});

    if (error?.message && error.message.includes('manager_emails.email')) {
      return res.status(409).json({ error: 'Email address is already assigned to another manager' });
    }

    res.status(500).json({ error: error.message });
  }
});

// Update a manager
app.put('/api/managers/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name_id, full_name, sleeper_username, sleeper_user_id, active } = req.body;
  const emails = collectManagerEmails(req.body);
  const primaryEmail = emails[0] || '';

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid manager identifier' });
  }

  if (!name_id || !full_name) {
    return res.status(400).json({ error: 'name_id and full_name are required' });
  }

  const invalidEmail = emails.find(email => !isValidEmailFormat(email));
  if (invalidEmail) {
    return res.status(400).json({ error: `Invalid email address: ${invalidEmail}` });
  }

  try {
    await runAsync('BEGIN TRANSACTION');

    const updateResult = await runAsync(
      `UPDATE managers SET
         name_id = ?,
         full_name = ?,
         sleeper_username = ?,
         sleeper_user_id = ?,
         email = ?,
         active = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name_id,
        full_name,
        sleeper_username || '',
        sleeper_user_id || '',
        primaryEmail,
        active != null ? active : 1,
        id
      ]
    );

    if (updateResult.changes === 0) {
      await runAsync('ROLLBACK');
      return res.status(404).json({ error: 'Manager not found' });
    }

    await replaceManagerEmails(id, emails);

    await runAsync('COMMIT');

    const manager = await getManagerWithEmailsById(id);

    res.json({ message: 'Manager updated successfully', manager });
  } catch (error) {
    await runAsync('ROLLBACK').catch(() => {});

    if (error?.message && error.message.includes('manager_emails.email')) {
      return res.status(409).json({ error: 'Email address is already assigned to another manager' });
    }

    res.status(500).json({ error: error.message });
  }
});

// Delete a manager
app.delete('/api/managers/:id', (req, res) => {
  const id = req.params.id;
  
  // First check if manager has any associated team seasons
  db.get('SELECT COUNT(*) as count FROM team_seasons ts JOIN managers m ON ts.name_id = m.name_id WHERE m.id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row.count > 0) {
      res.status(400).json({ error: 'Cannot delete manager with existing season records. Set to inactive instead.' });
      return;
    }
    
    // Safe to delete - no associated records
    db.run('DELETE FROM managers WHERE id = ?', [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Manager not found' });
        return;
      }
      res.json({ message: 'Manager deleted successfully' });
    });
  });
});

// CRUD for manager_sleeper_ids table
app.get('/api/manager-sleeper-ids', (req, res) => {
  const query = `
    SELECT msi.*, m.full_name
    FROM manager_sleeper_ids msi
    LEFT JOIN managers m ON msi.name_id = m.name_id
    ORDER BY msi.season DESC, m.full_name
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ mappings: rows });
  });
});

app.post('/api/manager-sleeper-ids', (req, res) => {
  const { name_id, sleeper_user_id, season } = req.body;
  if (!name_id || !sleeper_user_id || !season) {
    return res.status(400).json({ error: 'name_id, sleeper_user_id and season are required' });
    }

  const query = `
    INSERT INTO manager_sleeper_ids (name_id, sleeper_user_id, season)
    VALUES (?, ?, ?)
  `;
  db.run(query, [name_id, sleeper_user_id, season], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Mapping added successfully', id: this.lastID });
  });
});

app.put('/api/manager-sleeper-ids/:id', (req, res) => {
  const id = req.params.id;
  const { name_id, sleeper_user_id, season } = req.body;
  if (!name_id || !sleeper_user_id || !season) {
    return res.status(400).json({ error: 'name_id, sleeper_user_id and season are required' });
  }

  const query = `
    UPDATE manager_sleeper_ids
    SET name_id = ?, sleeper_user_id = ?, season = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  db.run(query, [name_id, sleeper_user_id, season, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Mapping not found' });
      return;
    }
    res.json({ message: 'Mapping updated successfully' });
  });
});

app.delete('/api/manager-sleeper-ids/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM manager_sleeper_ids WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Mapping not found' });
      return;
    }
    res.json({ message: 'Mapping deleted successfully' });
  });
});

// Add a new team season (updated to include dues_chumpion and FIXED dues handling)
app.post('/api/team-seasons', (req, res) => {
  const {
    year, name_id, team_name, wins, losses, points_for, points_against,
    regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
  } = req.body;
  
  if (!year || !name_id || wins === undefined || losses === undefined) {
    return res.status(400).json({ error: 'year, name_id, wins, and losses are required' });
  }

  const query = `
    INSERT INTO team_seasons (
      year, name_id, team_name, wins, losses, points_for, points_against,
      regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  // FIXED: Don't default dues to 250, use actual value
  const values = [
    year, name_id, team_name || '', wins, losses, points_for || 0, points_against || 0,
    regular_season_rank || null, playoff_finish || null, dues, payout || 0, 
    dues_chumpion || 0, high_game || null
  ];
  
  db.run(query, values, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      message: 'Team season added successfully',
      seasonId: this.lastID 
    });
  });
});

// Update a team season (updated to include dues_chumpion and FIXED dues handling)
app.put('/api/team-seasons/:id', (req, res) => {
  const id = req.params.id;
  const {
    year, name_id, team_name, wins, losses, points_for, points_against,
    regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
  } = req.body;

  const query = `
    UPDATE team_seasons SET
      year = ?, name_id = ?, team_name = ?, wins = ?, losses = ?, 
      points_for = ?, points_against = ?, regular_season_rank = ?, 
      playoff_finish = ?, dues = ?, payout = ?, dues_chumpion = ?, high_game = ?
    WHERE id = ?
  `;
  
  // FIXED: Don't default dues to 250, use actual value
  const values = [
    year, name_id, team_name, wins, losses, points_for, points_against,
    regular_season_rank, playoff_finish, dues, payout, dues_chumpion || 0, high_game, id
  ];
  
  db.run(query, values, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Team season updated successfully' });
  });
});

// Delete a team season
app.delete('/api/team-seasons/:id', (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM team_seasons WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Team season deleted successfully' });
  });
});

app.get('/api/stats', (_req, res) => {
  const queries = {
    championships: `
      SELECT m.full_name, COUNT(*) as count
      FROM team_seasons ts
      JOIN managers m ON ts.name_id = m.name_id
      WHERE ts.playoff_finish = 1
      GROUP BY ts.name_id
      ORDER BY count DESC
    `,
    totalSeasons: 'SELECT COUNT(DISTINCT year) as count FROM team_seasons',
    totalManagers: 'SELECT COUNT(*) as count FROM managers WHERE active = 1'
  };

  Promise.all([
    new Promise((resolve, reject) => {
      db.all(queries.championships, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    }),
    new Promise((resolve, reject) => {
      db.get(queries.totalSeasons, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || { count: 0 });
        }
      });
    }),
    new Promise((resolve, reject) => {
      db.get(queries.totalManagers, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || { count: 0 });
        }
      });
    })
  ])
    .then(([championships, totalSeasonsRow, totalManagersRow]) => {
      res.json({
        championships,
        totalSeasons: totalSeasonsRow.count,
        totalManagers: totalManagersRow.count
      });
    })
    .catch((error) => {
      console.error('Error fetching league stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Upload Excel file and import data (updated to include dues_chumpion and FIXED dues handling)
app.post('/api/upload-excel', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    // Clear existing data (optional - comment out if you want to append)
    db.run('DELETE FROM team_seasons', (err) => {
      if (err) {
        console.error('Error clearing data:', err);
      }
    });

    // Insert new data with dues_chumpion support and FIXED dues handling
    const insertQuery = `
      INSERT INTO team_seasons (
        year, name_id, team_name, wins, losses, points_for, points_against,
        regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let insertedCount = 0;
    jsonData.forEach((row) => {
      // FIXED: Don't default dues to 250, use actual value from Excel
      const values = [
        row.year,
        row.name_id,
        row.team_name || '',
        row.wins,
        row.losses,
        row.points_for || 0,
        row.points_against || 0,
        row.regular_season_rank || null,
        row.playoff_finish || null,
        row.dues, // Use actual value from Excel, don't default to 250
        row.payout || 0,
        row.dues_chumpion || 0, // New column support
        row.high_game || null
      ];

      db.run(insertQuery, values, function(err) {
        if (err) {
          console.error('Error inserting row:', err, row);
        } else {
          insertedCount++;
        }
      });
    });

    // Clean up uploaded file
    require('fs').unlinkSync(req.file.path);

    res.json({ 
      message: 'Data imported successfully', 
      rowsProcessed: jsonData.length 
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to process Excel file: ' + error.message });
  }
});



scheduleBackgroundJobs({
  refreshRosRankings,
  syncCurrentSeasonFromSleeper,
  refreshCachedSummary,
  refreshCachedPreview
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    if (server && server.listening) {
      server.close(() => {
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});