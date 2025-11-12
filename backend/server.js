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
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
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

// Rate limiter for summary endpoint
const summaryRateLimitWindowMs =
  parseInt(process.env.SUMMARY_RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000;
const summaryRateLimitMax =
  parseInt(process.env.SUMMARY_RATE_LIMIT_MAX, 10) || 20;

const summarizeLimiter = rateLimit({
  windowMs: summaryRateLimitWindowMs,
  max: summaryRateLimitMax,
  message: 'Too many requests, please try again later.'
});

const cloudflareAuthRateLimitWindowMs =
  parseInt(process.env.CF_MANAGER_AUTH_RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000;
const cloudflareAuthRateLimitMax =
  parseInt(process.env.CF_MANAGER_AUTH_RATE_LIMIT_MAX, 10) || 10;

const cloudflareAccessLimiter = rateLimit({
  windowMs: cloudflareAuthRateLimitWindowMs,
  max: cloudflareAuthRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again later.'
});

const rawCloudflareTeamDomain = (process.env.CF_ACCESS_TEAM_DOMAIN || '').trim();
const normalizedCloudflareTeamDomain = rawCloudflareTeamDomain
  .replace(/^https?:\/\//i, '')
  .replace(/\/$/, '');
const cloudflareIssuer = normalizedCloudflareTeamDomain
  ? `https://${normalizedCloudflareTeamDomain}`
  : '';
const cloudflareJwksUri = cloudflareIssuer
  ? `${cloudflareIssuer}/cdn-cgi/access/certs`
  : '';

const cloudflareJwtAudience = (process.env.CF_ACCESS_JWT_AUD || '').trim();
const cloudflareJwtValidationFlag = (process.env.CF_ACCESS_VALIDATE_JWT || '').trim().toLowerCase();
const shouldValidateCloudflareJwt = ['1', 'true', 'yes', 'required'].includes(cloudflareJwtValidationFlag);
const cloudflareJwksCacheMs =
  parseInt(process.env.CF_ACCESS_JWKS_CACHE_MS, 10) || 60 * 60 * 1000;

const cloudflareJwksRequestTimeoutMs =
  parseInt(process.env.CF_ACCESS_JWKS_TIMEOUT_MS, 10) || 5000;

const cloudflareJwksCache = {
  keys: null,
  expiresAt: 0
};

const decodeBase64Url = (input) => {
  if (typeof input !== 'string') {
    return Buffer.alloc(0);
  }

  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + '='.repeat(padding), 'base64');
};

const fetchCloudflareJwks = async () => {
  if (!cloudflareJwksUri) {
    throw new Error('Cloudflare Access JWKS URI is not configured');
  }

  if (cloudflareJwksCache.keys && cloudflareJwksCache.expiresAt > Date.now()) {
    return cloudflareJwksCache.keys;
  }

  const response = await axios.get(cloudflareJwksUri, {
    timeout: cloudflareJwksRequestTimeoutMs
  });

  const keys = Array.isArray(response?.data?.keys) ? response.data.keys : [];

  if (!keys.length) {
    throw new Error('No signing keys returned from Cloudflare Access');
  }

  cloudflareJwksCache.keys = keys;
  cloudflareJwksCache.expiresAt = Date.now() + cloudflareJwksCacheMs;

  return keys;
};

const verifyCloudflareJwtAssertion = async (token) => {
  if (!shouldValidateCloudflareJwt) {
    return null;
  }

  if (!token || typeof token !== 'string') {
    throw new Error('Missing CF-Access-Jwt-Assertion header');
  }

  if (!cloudflareJwtAudience || !cloudflareIssuer) {
    throw new Error('Cloudflare Access JWT validation requires CF_ACCESS_JWT_AUD and CF_ACCESS_TEAM_DOMAIN');
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('Malformed Cloudflare Access token');
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;

  let header;
  let payload;
  try {
    header = JSON.parse(decodeBase64Url(headerSegment).toString('utf8'));
  } catch (error) {
    throw new Error('Invalid Cloudflare Access token header');
  }

  if (!header || header.alg !== 'RS256') {
    throw new Error('Unsupported Cloudflare Access token algorithm');
  }

  try {
    payload = JSON.parse(decodeBase64Url(payloadSegment).toString('utf8'));
  } catch (error) {
    throw new Error('Invalid Cloudflare Access token payload');
  }

  let keys = await fetchCloudflareJwks();
  let signingKeyJwk = keys.find((key) => key.kid === header.kid);

  if (!signingKeyJwk) {
    cloudflareJwksCache.keys = null;
    cloudflareJwksCache.expiresAt = 0;
    keys = await fetchCloudflareJwks();
    signingKeyJwk = keys.find((key) => key.kid === header.kid);
  }

  if (!signingKeyJwk) {
    throw new Error('Unable to locate signing key for Cloudflare Access token');
  }

  let publicKey;
  try {
    publicKey = crypto.createPublicKey({
      key: {
        kty: signingKeyJwk.kty,
        n: signingKeyJwk.n,
        e: signingKeyJwk.e
      },
      format: 'jwk'
    });
  } catch (error) {
    throw new Error(`Unable to construct Cloudflare Access public key: ${error.message}`);
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerSegment}.${payloadSegment}`);
  verifier.end();

  const signature = decodeBase64Url(signatureSegment);
  const isValidSignature = verifier.verify(publicKey, signature);

  if (!isValidSignature) {
    throw new Error('Invalid Cloudflare Access token signature');
  }

  const audience = payload?.aud;
  const audienceMatches = Array.isArray(audience)
    ? audience.includes(cloudflareJwtAudience)
    : audience === cloudflareJwtAudience;

  if (!audienceMatches) {
    throw new Error('Cloudflare Access token audience mismatch');
  }

  if (payload?.iss !== cloudflareIssuer) {
    throw new Error('Cloudflare Access token issuer mismatch');
  }

  const currentEpochSeconds = Math.floor(Date.now() / 1000);

  if (typeof payload?.exp === 'number' && currentEpochSeconds >= payload.exp) {
    throw new Error('Cloudflare Access token expired');
  }

  if (typeof payload?.nbf === 'number' && currentEpochSeconds < payload.nbf) {
    throw new Error('Cloudflare Access token not yet valid');
  }

  return payload;
};

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
app.use('/api/manager-auth/cloudflare', cloudflareAccessLimiter);

// Database connection
const dbPath = path.join(__dirname, 'data', 'fantasy_football.db');
const db = new sqlite3.Database(dbPath);

// Ensure keepers table exists
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

const getRuleChangeVotingLockRow = async (seasonYear) =>
  getAsync('SELECT season_year, locked, locked_at, updated_at FROM rule_change_voting_locks WHERE season_year = ?', [
    seasonYear
  ]);

const isRuleChangeVotingLocked = async (seasonYear) => {
  if (!Number.isInteger(seasonYear)) {
    return false;
  }

  const row = await getRuleChangeVotingLockRow(seasonYear);
  return row ? row.locked === 1 : false;
};

const setRuleChangeVotingLock = async (seasonYear, locked) => {
  const numericYear = parseInt(seasonYear, 10);
  if (Number.isNaN(numericYear)) {
    throw new Error('A valid season year is required to update the voting lock.');
  }

  const normalizedLocked = locked ? 1 : 0;

  await runAsync(
    `INSERT INTO rule_change_voting_locks (season_year, locked, locked_at, updated_at)
     VALUES (?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)
     ON CONFLICT(season_year) DO UPDATE SET
       locked = excluded.locked,
       locked_at = CASE WHEN excluded.locked = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
       updated_at = CURRENT_TIMESTAMP`,
    [numericYear, normalizedLocked, normalizedLocked]
  );

  return getRuleChangeVotingLockRow(numericYear);
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

const sanitizeRuleChangeOptions = (rawOptions) => {
  if (Array.isArray(rawOptions)) {
    return Array.from(
      new Set(
        rawOptions
          .map(option => (typeof option === 'string' ? option.trim() : ''))
          .filter(option => option.length > 0)
      )
    );
  }

  if (typeof rawOptions === 'string') {
    return sanitizeRuleChangeOptions(rawOptions.split('\n'));
  }

  return [];
};

const parseRuleChangeOptions = (options) => {
  if (!options) {
    return [];
  }

  if (Array.isArray(options)) {
    return sanitizeRuleChangeOptions(options);
  }

  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) {
        return sanitizeRuleChangeOptions(parsed);
      }
    } catch (error) {
      console.warn('Unable to parse rule change options JSON, falling back to newline parsing.');
    }

    return sanitizeRuleChangeOptions(options.split('\n'));
  }

  return [];
};

const mapManagersToSummaries = (rows = []) =>
  rows.map(row => ({
    id: row.name_id,
    name:
      typeof row.full_name === 'string' && row.full_name.trim()
        ? row.full_name.trim()
        : row.name_id
  }));

const buildProposalVoteDetails = (rows = []) => {
  return rows.reduce((acc, row) => {
    if (!acc[row.proposal_id]) {
      acc[row.proposal_id] = { optionMap: {}, voterIds: new Set() };
    }

    const detail = acc[row.proposal_id];
    if (!detail.optionMap[row.option]) {
      detail.optionMap[row.option] = [];
    }

    const normalizedName =
      typeof row.full_name === 'string' && row.full_name.trim()
        ? row.full_name.trim()
        : row.voter_id;

    detail.optionMap[row.option].push({
      id: row.voter_id,
      name: normalizedName
    });
    detail.voterIds.add(row.voter_id);
    return acc;
  }, {});
};

const formatRuleChangeProposal = (
  row,
  voteDetailIndex = {},
  userVoteIndex = {},
  activeManagers = []
) => {
  const options = parseRuleChangeOptions(row.options);
  const proposalDetails = voteDetailIndex[row.id] || { optionMap: {}, voterIds: new Set() };
  const voterIds = proposalDetails.voterIds instanceof Set ? proposalDetails.voterIds : new Set();
  const optionMap = proposalDetails.optionMap || {};

  const nonVoters = activeManagers
    .filter(manager => !voterIds.has(manager.id))
    .map(manager => ({ id: manager.id, name: manager.name }));

  return {
    id: row.id,
    seasonYear: row.season_year,
    title: row.title,
    description: row.description || '',
    options: options.map(optionValue => ({
      value: optionValue,
      votes: Array.isArray(optionMap[optionValue]) ? optionMap[optionValue].length : 0,
      voters: Array.isArray(optionMap[optionValue])
        ? optionMap[optionValue]
            .slice()
            .sort((a, b) =>
              (a.name || a.id || '').localeCompare(b.name || b.id || '', undefined, {
                sensitivity: 'base'
              })
            )
        : []
    })),
    userVote: userVoteIndex[row.id] || null,
    nonVoters,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const getRuleChangeProposalsForYear = async (seasonYear, managerId = null) => {
  const proposals = await allAsync(
    'SELECT * FROM rule_change_proposals WHERE season_year = ? ORDER BY created_at DESC',
    [seasonYear]
  );

  if (!proposals.length) {
    return [];
  }

  const proposalIds = proposals.map(proposal => proposal.id);
  const placeholders = proposalIds.map(() => '?').join(',');

  const voteRows = await allAsync(
    `SELECT v.proposal_id, v.option, v.voter_id, m.full_name
     FROM rule_change_votes v
     LEFT JOIN managers m ON v.voter_id = m.name_id
     WHERE v.proposal_id IN (${placeholders})`,
    proposalIds
  );

  const activeManagerRows = await allAsync(
    'SELECT name_id, full_name FROM managers WHERE active = 1 ORDER BY full_name'
  );

  const voteDetailIndex = buildProposalVoteDetails(voteRows);
  const userVoteIndex = voteRows.reduce((acc, row) => {
    if (row.voter_id === managerId) {
      acc[row.proposal_id] = row.option;
    }
    return acc;
  }, {});

  const activeManagers = mapManagersToSummaries(activeManagerRows);

  return proposals.map(proposal =>
    formatRuleChangeProposal(proposal, voteDetailIndex, userVoteIndex, activeManagers)
  );
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

    if (failed.length) {
      console.warn(`Failed to fetch rankings for: ${failed.join(', ')}`);
    }

    return { updated: players.length, failed };
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

    const existingData = await allAsync('SELECT * FROM team_seasons WHERE year = ?', [year]);
    const existingMap = {};
    existingData.forEach(row => {
      existingMap[row.name_id] = row;
    });

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const teamData of sleeperResult.data) {
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
      'UPDATE league_settings SET sync_status = ?, last_sync = CURRENT_TIMESTAMP WHERE year = ?',
      ['completed', year]
    );

    return {
      message: 'Sync completed',
      year,
      league_id: leagueId,
      summary: {
        total_teams: sleeperResult.data.length,
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

// Routes

app.post('/api/admin-auth', (req, res) => {
  if (!ADMIN_PASSWORD) {
    console.warn('Admin password is not configured.');
    return res.status(500).json({ success: false, error: 'Admin password is not configured.' });
  }

  const { password, token } = req.body || {};
  const normalizedPassword = typeof password === 'string' ? password : '';
  const normalizedToken = typeof token === 'string' ? token.trim() : '';

  if (normalizedToken) {
    if (!isAdminTokenValid(normalizedToken)) {
      return res.status(401).json({ success: false, error: 'Invalid or expired admin token' });
    }

    const session = activeAdminTokens.get(normalizedToken);
    return res.json({
      success: true,
      token: normalizedToken,
      expiresAt: session ? new Date(session.expiresAt).toISOString() : null
    });
  }

  if (!normalizedPassword) {
    return res.status(400).json({ success: false, error: 'Password is required' });
  }

  if (normalizedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
  }

  const { token: adminToken, expiresAt } = createAdminToken();

  res.json({
    success: true,
    token: adminToken,
    expiresAt: new Date(expiresAt).toISOString()
  });
});

app.get('/api/manager-auth/cloudflare', async (req, res) => {
  const emailHeader = req.headers['cf-access-authenticated-user-email'];
  const jwtAssertionHeader = req.headers['cf-access-jwt-assertion'];
  const requestedEmail = typeof emailHeader === 'string' ? emailHeader.trim() : '';
  const normalizedEmail = requestedEmail.toLowerCase();

  if (!normalizedEmail) {
    console.warn('Cloudflare Access authentication attempt missing email header');
    return res.status(400).json({ error: 'Missing Cloudflare Access email header' });
  }

  try {
    if (shouldValidateCloudflareJwt) {
      if (!jwtAssertionHeader || typeof jwtAssertionHeader !== 'string') {
        console.warn(
          `Cloudflare Access authentication missing JWT assertion for email ${requestedEmail || normalizedEmail}`
        );
        return res.status(401).json({ error: 'Invalid Cloudflare Access token' });
      }

      try {
        await verifyCloudflareJwtAssertion(jwtAssertionHeader);
      } catch (jwtError) {
        console.warn(
          `Cloudflare Access JWT validation failed for email ${requestedEmail || normalizedEmail}: ${jwtError.message}`
        );
        return res.status(401).json({ error: 'Invalid Cloudflare Access token' });
      }
    }

    const managerRow = await getAsync(
      'SELECT name_id, full_name FROM managers WHERE LOWER(email) = LOWER(?)',
      [requestedEmail || normalizedEmail]
    );

    if (!managerRow) {
      console.warn(
        `Cloudflare Access authentication failed - no manager mapped for email ${requestedEmail || normalizedEmail}`
      );
      return res.status(404).json({ error: 'Manager not found for provided email' });
    }

    const { token, expiresAt } = createManagerToken(managerRow.name_id);

    res.json({
      managerId: managerRow.name_id,
      managerName: managerRow.full_name,
      token,
      expiresAt: new Date(expiresAt).toISOString()
    });
  } catch (error) {
    console.error('Error during Cloudflare Access authentication:', error);
    res.status(500).json({ error: 'Failed to authenticate manager via Cloudflare Access' });
  }
});

app.post('/api/manager-auth/login', async (req, res) => {
  const { managerId, passcode } = req.body || {};
  const normalizedManagerId = typeof managerId === 'string' ? managerId.trim() : '';
  const normalizedPasscode = typeof passcode === 'string' ? passcode : '';

  if (!normalizedManagerId || !normalizedPasscode) {
    return res.status(400).json({ error: 'Manager ID and passcode are required' });
  }

  try {
    const managerRow = await getAsync('SELECT name_id, full_name FROM managers WHERE name_id = ?', [normalizedManagerId]);

    if (!managerRow) {
      return res.status(401).json({ error: 'Invalid manager credentials' });
    }

    const credentialRow = await getAsync(
      'SELECT passcode_hash FROM manager_credentials WHERE manager_id = ?',
      [normalizedManagerId]
    );

    if (!credentialRow || !credentialRow.passcode_hash) {
      return res.status(401).json({ error: 'Manager credentials not configured' });
    }

    const passcodeIsValid = verifyPasscodeHash(normalizedPasscode, credentialRow.passcode_hash);

    if (!passcodeIsValid) {
      return res.status(401).json({ error: 'Invalid manager credentials' });
    }

    const { token, expiresAt } = createManagerToken(managerRow.name_id);

    res.json({
      managerId: managerRow.name_id,
      managerName: managerRow.full_name,
      token,
      expiresAt: new Date(expiresAt).toISOString()
    });
  } catch (error) {
    console.error('Error authenticating manager:', error);
    res.status(500).json({ error: 'Failed to authenticate manager' });
  }
});

app.post('/api/manager-auth/passcode', async (req, res) => {
  const { managerId, passcode } = req.body || {};
  const normalizedManagerId = typeof managerId === 'string' ? managerId.trim() : '';
  const normalizedPasscode = typeof passcode === 'string' ? passcode : '';

  if (!normalizedManagerId || !normalizedPasscode) {
    return res.status(400).json({ error: 'Manager ID and passcode are required' });
  }

  try {
    const managerRow = await getAsync('SELECT name_id, full_name FROM managers WHERE name_id = ?', [normalizedManagerId]);

    if (!managerRow) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    const passcodeHash = createPasscodeHash(normalizedPasscode);
    await runAsync(
      `INSERT INTO manager_credentials (manager_id, passcode_hash, created_at, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(manager_id) DO UPDATE SET
         passcode_hash = excluded.passcode_hash,
         updated_at = CURRENT_TIMESTAMP`,
      [managerRow.name_id, passcodeHash]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to set manager passcode:', error);
    res.status(500).json({ error: 'Failed to set manager passcode' });
  }
});

app.post('/api/manager-auth/validate', async (req, res) => {
  const { managerId, token } = req.body || {};
  const normalizedManagerId = typeof managerId === 'string' ? managerId.trim() : '';
  const normalizedToken = typeof token === 'string' ? token.trim() : '';

  if (!normalizedManagerId || !normalizedToken) {
    return res.status(400).json({ error: 'Manager ID and token are required' });
  }

  try {
    const managerRow = await getAsync('SELECT name_id, full_name FROM managers WHERE name_id = ?', [normalizedManagerId]);

    if (!managerRow) {
      return res.status(401).json({ error: 'Invalid manager identifier' });
    }

    if (!isManagerTokenValid(managerRow.name_id, normalizedToken)) {
      return res.status(401).json({ error: 'Invalid or expired manager token' });
    }

    const session = activeManagerTokens.get(normalizedToken);

    res.json({
      managerId: managerRow.name_id,
      managerName: managerRow.full_name,
      expiresAt: session ? new Date(session.expiresAt).toISOString() : null
    });
  } catch (error) {
    console.error('Error validating manager token:', error);
    res.status(500).json({ error: 'Failed to validate manager token' });
  }
});

// Get all managers
app.get('/api/managers', (req, res) => {
  const query = 'SELECT * FROM managers ORDER BY full_name';
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ managers: rows });
  });
});

// Get ROS rankings
app.get('/api/ros-rankings', async (req, res) => {
  try {
    const rows = await allAsync(
      'SELECT player_name, team, position, proj_pts, sos_season, sos_playoffs FROM ros_rankings ORDER BY player_name'
    );
    res.json({ rankings: rows });
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
app.get('/api/keepers/:year', (req, res) => {
  const year = parseInt(req.params.year);
  db.all(
    'SELECT roster_id, player_id, player_name, previous_cost, years_kept, trade_from_roster_id, trade_amount, trade_note FROM keepers WHERE year = ?',
    [year],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ keepers: rows });
    }
  );
});

// Save keeper selections for a roster in a given season
app.post('/api/keepers/:year/:rosterId', async (req, res) => {
  const year = parseInt(req.params.year);
  const rosterId = parseInt(req.params.rosterId);
  const players = Array.isArray(req.body.players) ? req.body.players : [];

  try {
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
  const query = 'SELECT * FROM league_settings ORDER BY year DESC';
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
    INSERT INTO league_settings (year, league_id, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(year) 
    DO UPDATE SET 
      league_id = excluded.league_id,
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

// Test Sleeper API connection
app.get('/api/sleeper/test', async (req, res) => {
  const result = await sleeperService.testConnection();
  if (result.success) {
    res.json({ 
      message: 'Sleeper API connection successful',
      nfl_state: result.data 
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Sync data from Sleeper for a specific year
app.post('/api/sleeper/sync/:year', async (req, res) => {
  const year = parseInt(req.params.year);
  const { league_id, preserve_manual_fields = true } = req.body;

  if (!league_id) {
    return res.status(400).json({ error: 'League ID is required' });
  }

  try {
    const result = await syncSleeperSeason({
      year,
      leagueId: league_id,
      preserveManualFields: preserve_manual_fields
    });

    res.json(result);
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      error: error.message,
      year,
      league_id
    });
  }
});

// Get sync status for all years
app.get('/api/sleeper/sync-status', async (req, res) => {
  const query = `
    SELECT 
      ls.year,
      ls.league_id,
      ls.last_sync,
      ls.sync_status,
      COUNT(ts.id) as team_count
    FROM league_settings ls
    LEFT JOIN team_seasons ts ON ls.year = ts.year
    GROUP BY ls.year
    ORDER BY ls.year DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ status: rows });
  });
});

// Preview what data would be synced (dry run)
app.post('/api/sleeper/preview/:year', async (req, res) => {
  const year = parseInt(req.params.year);
  const { league_id } = req.body;

  if (!league_id) {
    return res.status(400).json({ error: 'League ID is required' });
  }

  try {
    // Get all managers for username mapping
    const managers = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM managers', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get seasonal Sleeper ID mappings
    const seasonalIds = await new Promise((resolve, reject) => {
      db.all('SELECT name_id, sleeper_user_id FROM manager_sleeper_ids WHERE season = ?', [year], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Fetch data from Sleeper
    const sleeperResult = await sleeperService.fetchLeagueData(league_id, year, managers, seasonalIds);

    if (!sleeperResult.success) {
      throw new Error(sleeperResult.error);
    }

    // Get existing data for comparison
    const existingData = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM team_seasons WHERE year = ?', [year], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Create comparison data
    const preview = sleeperResult.data.map(team => {
      const existing = existingData.find(e => e.name_id === team.name_id);
      return {
        ...team,
        status: !team.name_id ? 'unmatched' : (existing ? 'update' : 'new'),
        existing_data: existing ? {
          wins: existing.wins,
          losses: existing.losses,
          points_for: existing.points_for,
          dues: existing.dues,
          payout: existing.payout,
          dues_chumpion: existing.dues_chumpion
        } : null
      };
    });

    res.json({
      year,
      league_id,
      preview,
      summary: {
        total_teams: preview.length,
        matched: preview.filter(t => t.name_id).length,
        unmatched: preview.filter(t => !t.name_id).length,
        to_update: preview.filter(t => t.status === 'update').length,
        to_create: preview.filter(t => t.status === 'new').length
      }
    });

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ 
      error: error.message,
      year,
      league_id 
    });
  }
});

// Add a new manager
app.post('/api/managers', (req, res) => {
  const { name_id, full_name, sleeper_username, sleeper_user_id, email, active } = req.body;
  
  if (!name_id || !full_name) {
    return res.status(400).json({ error: 'name_id and full_name are required' });
  }

  const query = `
    INSERT INTO managers (name_id, full_name, sleeper_username, sleeper_user_id, email, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [name_id, full_name, sleeper_username || '', sleeper_user_id || '', email || '', active || 1],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.get('SELECT * FROM managers WHERE id = ?', [this.lastID], (selectErr, row) => {
        if (selectErr) {
          res.status(500).json({ error: selectErr.message });
          return;
        }

        res.json({
          message: 'Manager added successfully',
          manager: row
        });
      });
    }
  );
});

// Update a manager
app.put('/api/managers/:id', (req, res) => {
  const id = req.params.id;
  const { name_id, full_name, sleeper_username, sleeper_user_id, email, active } = req.body;

  if (!name_id || !full_name) {
    return res.status(400).json({ error: 'name_id and full_name are required' });
  }

  const query = `
    UPDATE managers SET
      name_id = ?, full_name = ?, sleeper_username = ?, sleeper_user_id = ?, email = ?, active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  const values = [
    name_id,
    full_name,
    sleeper_username || '',
    sleeper_user_id || '',
    email || '',
    active !== undefined ? active : 1,
    id
  ];

  db.run(query, values, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Manager not found' });
      return;
    }

    db.get('SELECT * FROM managers WHERE id = ?', [id], (selectErr, row) => {
      if (selectErr) {
        res.status(500).json({ error: selectErr.message });
        return;
      }

      res.json({ message: 'Manager updated successfully', manager: row });
    });
  });
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

app.get('/api/rule-changes', async (req, res) => {
  const seasonYear = parseInt(req.query.season_year, 10);

  if (Number.isNaN(seasonYear)) {
    return res.status(400).json({ error: 'season_year is required' });
  }

  const adminTokenHeader = req.headers['x-admin-token'];
  const adminToken = typeof adminTokenHeader === 'string' ? adminTokenHeader.trim() : '';
  const adminAuthorized = adminToken ? isAdminTokenValid(adminToken) : false;

  if (adminToken && !adminAuthorized) {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }

  try {
    let managerId = null;

    if (!adminAuthorized) {
      const manager = await requireManagerAuth(req, res);
      if (!manager) {
        return;
      }
      managerId = manager.name_id;
    }

    const [proposals, votingLockedRow] = await Promise.all([
      getRuleChangeProposalsForYear(seasonYear, managerId),
      getRuleChangeVotingLockRow(seasonYear)
    ]);

    res.json({
      proposals,
      votingLocked: votingLockedRow ? votingLockedRow.locked === 1 : false
    });
  } catch (error) {
    console.error('Error fetching rule change proposals:', error);
    res.status(500).json({ error: 'Failed to fetch rule change proposals' });
  }
});

app.post('/api/rule-changes', async (req, res) => {
  const { seasonYear, title, description = '', options } = req.body || {};
  const numericYear = parseInt(seasonYear, 10);

  if (Number.isNaN(numericYear)) {
    return res.status(400).json({ error: 'A valid seasonYear is required' });
  }

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const normalizedOptions = sanitizeRuleChangeOptions(options);

  if (normalizedOptions.length < 2) {
    return res.status(400).json({ error: 'At least two options are required' });
  }

  try {
    const result = await runAsync(
      `INSERT INTO rule_change_proposals (season_year, title, description, options, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        numericYear,
        title.trim(),
        typeof description === 'string' ? description.trim() : '',
        JSON.stringify(normalizedOptions)
      ]
    );

    const newRow = await getAsync('SELECT * FROM rule_change_proposals WHERE id = ?', [result.lastID]);
    const formatted = formatRuleChangeProposal(newRow, {}, {});
    res.status(201).json({ proposal: formatted });
  } catch (error) {
    console.error('Error creating rule change proposal:', error);
    res.status(500).json({ error: 'Failed to create rule change proposal' });
  }
});

app.put('/api/rule-changes/voting-lock', async (req, res) => {
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
    const updatedRow = await setRuleChangeVotingLock(numericYear, desiredLocked);
    res.json({
      seasonYear: updatedRow?.season_year ?? numericYear,
      locked: updatedRow ? updatedRow.locked === 1 : desiredLocked,
      lockedAt: updatedRow?.locked_at || null,
      updatedAt: updatedRow?.updated_at || null
    });
  } catch (error) {
    console.error('Error updating rule change voting lock:', error);
    res.status(500).json({ error: 'Failed to update voting lock' });
  }
});

app.put('/api/rule-changes/:id', async (req, res) => {
  const proposalId = parseInt(req.params.id, 10);

  if (Number.isNaN(proposalId)) {
    return res.status(400).json({ error: 'Invalid proposal id' });
  }

  const { seasonYear, title, description = '', options } = req.body || {};
  const numericYear = parseInt(seasonYear, 10);

  if (Number.isNaN(numericYear)) {
    return res.status(400).json({ error: 'A valid seasonYear is required' });
  }

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const normalizedOptions = sanitizeRuleChangeOptions(options);

  if (normalizedOptions.length < 2) {
    return res.status(400).json({ error: 'At least two options are required' });
  }

  try {
    const updateResult = await runAsync(
      `UPDATE rule_change_proposals
       SET season_year = ?, title = ?, description = ?, options = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        numericYear,
        title.trim(),
        typeof description === 'string' ? description.trim() : '',
        JSON.stringify(normalizedOptions),
        proposalId
      ]
    );

    if (!updateResult.changes) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (normalizedOptions.length) {
      const optionPlaceholders = normalizedOptions.map(() => '?').join(',');
      await runAsync(
        `DELETE FROM rule_change_votes WHERE proposal_id = ? AND option NOT IN (${optionPlaceholders})`,
        [proposalId, ...normalizedOptions]
      );
    } else {
      await runAsync('DELETE FROM rule_change_votes WHERE proposal_id = ?', [proposalId]);
    }

    const updatedRow = await getAsync('SELECT * FROM rule_change_proposals WHERE id = ?', [proposalId]);
    const voteRows = await allAsync(
      `SELECT v.proposal_id, v.option, v.voter_id, m.full_name
       FROM rule_change_votes v
       LEFT JOIN managers m ON v.voter_id = m.name_id
       WHERE v.proposal_id = ?`,
      [proposalId]
    );
    const activeManagerRows = await allAsync(
      'SELECT name_id, full_name FROM managers WHERE active = 1 ORDER BY full_name'
    );
    const voteDetailIndex = buildProposalVoteDetails(voteRows);
    const formatted = formatRuleChangeProposal(
      updatedRow,
      voteDetailIndex,
      {},
      mapManagersToSummaries(activeManagerRows)
    );
    res.json({ proposal: formatted });
  } catch (error) {
    console.error('Error updating rule change proposal:', error);
    res.status(500).json({ error: 'Failed to update rule change proposal' });
  }
});

app.delete('/api/rule-changes/:id', async (req, res) => {
  const proposalId = parseInt(req.params.id, 10);

  if (Number.isNaN(proposalId)) {
    return res.status(400).json({ error: 'Invalid proposal id' });
  }

  try {
    const deleteResult = await runAsync('DELETE FROM rule_change_proposals WHERE id = ?', [proposalId]);

    if (!deleteResult.changes) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    await runAsync('DELETE FROM rule_change_votes WHERE proposal_id = ?', [proposalId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting rule change proposal:', error);
    res.status(500).json({ error: 'Failed to delete rule change proposal' });
  }
});

app.post('/api/rule-changes/:id/vote', async (req, res) => {
  const proposalId = parseInt(req.params.id, 10);

  if (Number.isNaN(proposalId)) {
    return res.status(400).json({ error: 'Invalid proposal id' });
  }

  const { option } = req.body || {};

  const adminTokenHeader = req.headers['x-admin-token'];
  const adminToken = typeof adminTokenHeader === 'string' ? adminTokenHeader.trim() : '';
  const adminAuthorized = adminToken ? isAdminTokenValid(adminToken) : false;

  if (adminToken && !adminAuthorized) {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }

  const normalizedOption = typeof option === 'string' ? option.trim() : '';
  if (!normalizedOption) {
    return res.status(400).json({ error: 'A valid option is required' });
  }

  try {
    let actingManager = null;

    if (adminAuthorized) {
      const candidateManagerIds = [
        req.body?.managerId,
        req.body?.manager_id,
        req.body?.voterId,
        req.body?.voter_id
      ];

      const normalizedManagerId = candidateManagerIds
        .map(value => (typeof value === 'string' ? value.trim() : ''))
        .find(value => value.length > 0);

      if (!normalizedManagerId) {
        return res
          .status(400)
          .json({ error: 'managerId is required when casting a vote as an admin' });
      }

      const managerRow = await getAsync('SELECT name_id, full_name FROM managers WHERE name_id = ?', [
        normalizedManagerId
      ]);

      if (!managerRow) {
        return res.status(404).json({ error: 'Manager not found' });
      }

      actingManager = managerRow;
    } else {
      const manager = await requireManagerAuth(req, res);
      if (!manager) {
        return;
      }

      actingManager = manager;
    }

    const proposalRow = await getAsync('SELECT * FROM rule_change_proposals WHERE id = ?', [proposalId]);

    if (!proposalRow) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (!adminAuthorized) {
      const votingLocked = await isRuleChangeVotingLocked(proposalRow.season_year);
      if (votingLocked) {
        return res.status(403).json({ error: 'Voting has been locked for this season' });
      }
    }

    const availableOptions = parseRuleChangeOptions(proposalRow.options);
    if (!availableOptions.includes(normalizedOption)) {
      return res.status(400).json({ error: 'Invalid option selected' });
    }

    await runAsync(
      `INSERT INTO rule_change_votes (proposal_id, voter_id, option, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(proposal_id, voter_id) DO UPDATE SET option = excluded.option, updated_at = CURRENT_TIMESTAMP`,
      [proposalId, actingManager.name_id, normalizedOption]
    );

    const voteRows = await allAsync(
      `SELECT v.proposal_id, v.option, v.voter_id, m.full_name
       FROM rule_change_votes v
       LEFT JOIN managers m ON v.voter_id = m.name_id
       WHERE v.proposal_id = ?`,
      [proposalId]
    );
    const activeManagerRows = await allAsync(
      'SELECT name_id, full_name FROM managers WHERE active = 1 ORDER BY full_name'
    );
    const voteDetailIndex = buildProposalVoteDetails(voteRows);
    const formatted = formatRuleChangeProposal(
      proposalRow,
      voteDetailIndex,
      adminAuthorized ? {} : { [proposalId]: normalizedOption },
      mapManagersToSummaries(activeManagerRows)
    );

    res.json({ proposal: formatted });
  } catch (error) {
    console.error('Error recording rule change vote:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

app.delete('/api/rule-changes/:id/vote', async (req, res) => {
  const proposalId = parseInt(req.params.id, 10);

  if (Number.isNaN(proposalId)) {
    return res.status(400).json({ error: 'Invalid proposal id' });
  }

  try {
    const adminTokenHeader = req.headers['x-admin-token'];
    const adminToken = typeof adminTokenHeader === 'string' ? adminTokenHeader.trim() : '';
    const adminAuthorized = adminToken ? isAdminTokenValid(adminToken) : false;

    if (adminToken && !adminAuthorized) {
      return res.status(401).json({ error: 'Invalid or expired admin token' });
    }

    let voterId = '';

    if (adminAuthorized) {
      const candidateManagerIds = [
        req.body?.managerId,
        req.body?.manager_id,
        req.body?.voterId,
        req.body?.voter_id,
        req.query?.managerId,
        req.query?.manager_id,
        req.query?.voterId,
        req.query?.voter_id
      ];

      const normalizedManagerId = candidateManagerIds
        .map(value => (typeof value === 'string' ? value.trim() : ''))
        .find(value => value.length > 0);

      if (!normalizedManagerId) {
        return res
          .status(400)
          .json({ error: 'managerId is required when removing a vote as an admin' });
      }

      const managerRow = await getAsync('SELECT name_id, full_name FROM managers WHERE name_id = ?', [
        normalizedManagerId
      ]);

      if (!managerRow) {
        return res.status(404).json({ error: 'Manager not found' });
      }

      voterId = managerRow.name_id;
    } else {
      const manager = await requireManagerAuth(req, res);
      if (!manager) {
        return;
      }

      voterId = manager.name_id;
    }

    const proposalRow = await getAsync('SELECT * FROM rule_change_proposals WHERE id = ?', [proposalId]);

    if (!proposalRow) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (!adminAuthorized) {
      const votingLocked = await isRuleChangeVotingLocked(proposalRow.season_year);
      if (votingLocked) {
        return res.status(403).json({ error: 'Voting has been locked for this season' });
      }
    }

    await runAsync('DELETE FROM rule_change_votes WHERE proposal_id = ? AND voter_id = ?', [
      proposalId,
      voterId
    ]);

    const voteRows = await allAsync(
      `SELECT v.proposal_id, v.option, v.voter_id, m.full_name
       FROM rule_change_votes v
       LEFT JOIN managers m ON v.voter_id = m.name_id
       WHERE v.proposal_id = ?`,
      [proposalId]
    );
    const activeManagerRows = await allAsync(
      'SELECT name_id, full_name FROM managers WHERE active = 1 ORDER BY full_name'
    );
    const voteDetailIndex = buildProposalVoteDetails(voteRows);
    const formatted = formatRuleChangeProposal(
      proposalRow,
      voteDetailIndex,
      {},
      mapManagersToSummaries(activeManagerRows)
    );

    res.json({ proposal: formatted });
  } catch (error) {
    console.error('Error removing rule change vote:', error);
    res.status(500).json({ error: 'Failed to remove vote' });
  }
});

// Get rules - FIXED to read from database instead of hardcoded
app.get('/api/rules', (req, res) => {
  console.log('📖 Fetching rules from database...');

  const query = 'SELECT rules_content FROM league_rules WHERE active = 1 ORDER BY created_at DESC LIMIT 1';
  
  db.get(query, [], (err, row) => {
    if (err) {
      console.error('❌ Error fetching rules from database:', err.message);
      res.status(500).json({ error: 'Failed to fetch rules' });
      return;
    }
    
    if (row && row.rules_content) {
      console.log('✅ Rules loaded from database successfully');
      res.json({ rules: row.rules_content });
    } else {
      console.log('ℹ️  No rules found in database, returning empty string');
      res.json({ rules: '' });
    }
  });
});

// Update rules - FIXED to actually save to database
app.put('/api/rules', (req, res) => {
  const { rules } = req.body;
  
  console.log('📝 Updating rules in database...');
  
  if (!rules) {
    return res.status(400).json({ error: 'Rules content is required' });
  }

  // First, deactivate all existing rules
  db.run('UPDATE league_rules SET active = 0 WHERE active = 1', (err) => {
    if (err) {
      console.error('❌ Error deactivating old rules:', err.message);
      res.status(500).json({ error: 'Failed to update rules' });
      return;
    }
    
    console.log('✅ Deactivated previous rules');
    
    // Insert new rules as active
    const insertQuery = `
      INSERT INTO league_rules (rules_content, version, active, created_at, updated_at) 
      VALUES (?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    
    db.run(insertQuery, [rules], function(err) {
      if (err) {
        console.error('❌ Error inserting new rules:', err.message);
        res.status(500).json({ error: 'Failed to save rules' });
        return;
      }
      
      console.log('✅ Rules updated successfully in database (ID:', this.lastID, ')');
      res.json({ message: 'Rules updated successfully' });
    });
  });
});

// Get statistics/aggregated data
app.get('/api/stats', (req, res) => {
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
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.get(queries.totalSeasons, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }),
    new Promise((resolve, reject) => {
      db.get(queries.totalManagers, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    })
  ]).then(([championships, totalSeasons, totalManagers]) => {
    res.json({
      championships,
      totalSeasons: totalSeasons.count,
      totalManagers: totalManagers.count
    });
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

// Generate summary using LLM
app.post('/api/summarize', summarizeLimiter, async (req, res) => {
  try {
    const summary = await summaryService.generateSummary(req.body);
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cached weekly summary
app.get('/api/summary', async (req, res) => {
  try {
    const row = await getAsync('SELECT summary, created_at FROM summaries ORDER BY created_at DESC LIMIT 1');
    res.json({ summary: row ? row.summary : '', updated: row ? row.created_at : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save a manually edited summary
app.put('/api/summary', async (req, res) => {
  try {
    const { summary } = req.body || {};
    if (typeof summary !== 'string') {
      return res.status(400).json({ error: 'Summary text is required.' });
    }

    const trimmed = summary.trim();
    await runAsync('INSERT INTO summaries (summary) VALUES (?)', [trimmed]);
    res.json({ summary: trimmed, lines: extractSummaryLines(trimmed) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh summary manually
app.post('/api/summary/refresh', async (req, res) => {
  try {
    const summary = await refreshCachedSummary();
    res.json({ summary, lines: extractSummaryLines(summary) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate a single summary line while keeping existing lines intact client-side
app.post('/api/summary/generate-line', async (req, res) => {
  try {
    const index = Number.isInteger(req.body?.index)
      ? req.body.index
      : parseInt(req.body?.index, 10);
    const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;

    const { summary } = await weeklySummaryService.generateWeeklySummary(db);
    const lines = extractSummaryLines(summary);
    const line = lines[normalizedIndex] || '';

    res.json({ line, lines, index: normalizedIndex, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get cached upcoming week preview
app.get('/api/preview', async (req, res) => {
  try {
    const row = await getAsync('SELECT summary, created_at FROM previews ORDER BY created_at DESC LIMIT 1');
    res.json({ summary: row ? row.summary : '', updated: row ? row.created_at : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save a manually edited preview
app.put('/api/preview', async (req, res) => {
  try {
    const { summary } = req.body || {};
    if (typeof summary !== 'string') {
      return res.status(400).json({ error: 'Preview text is required.' });
    }

    const trimmed = summary.trim();
    await runAsync('INSERT INTO previews (summary) VALUES (?)', [trimmed]);
    res.json({ summary: trimmed, lines: extractSummaryLines(trimmed) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh upcoming week preview
app.post('/api/preview/refresh', async (req, res) => {
  try {
    const summary = await refreshCachedPreview();
    res.json({ summary, lines: extractSummaryLines(summary) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate a single preview line while keeping existing lines intact client-side
app.post('/api/preview/generate-line', async (req, res) => {
  try {
    const index = Number.isInteger(req.body?.index)
      ? req.body.index
      : parseInt(req.body?.index, 10);
    const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;

    const { summary } = await weeklySummaryService.generateWeeklyPreview(db);
    const lines = extractSummaryLines(summary);
    const line = lines[normalizedIndex] || '';

    res.json({ line, lines, index: normalizedIndex, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`The League Dashboard API running on port ${PORT}`);
});

// Initial fetch of ROS rankings
refreshRosRankings().catch(err =>
  console.error('Initial ROS rankings refresh failed:', err.message)
);

// Schedule ROS rankings refresh daily at 3AM ET
cron.schedule('0 3 * * *', () => {
  refreshRosRankings().catch(err =>
    console.error('Scheduled ROS rankings refresh failed:', err.message)
  );
}, { timezone: 'America/New_York' });

// Schedule current season Sleeper sync every Tuesday at 3:55AM ET
cron.schedule('55 3 * * 2', async () => {
  try {
    const result = await syncCurrentSeasonFromSleeper();
    if (result) {
      console.log(
        `Completed scheduled Sleeper sync for ${result.year}: ${result.summary.successful_updates}/${result.summary.total_teams} teams updated.`
      );
    }
  } catch (err) {
    console.error('Scheduled Sleeper sync failed:', err.message);
  }
}, { timezone: 'America/New_York' });

// Schedule weekly summary and preview generation every Tuesday at 4AM ET
cron.schedule('0 4 * * 2', () => {
  refreshCachedSummary().catch(err =>
    console.error('Failed to refresh weekly summary:', err.message)
  );
  refreshCachedPreview().catch(err =>
    console.error('Failed to refresh weekly preview:', err.message)
  );
}, { timezone: 'America/New_York' });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});