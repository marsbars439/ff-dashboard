/**
 * Fantasy Football Dashboard API Server
 * Refactored for modularity and maintainability
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./utils/logger');
const { validateEnv } = require('./utils/validateEnv');
const { initDatabase, databaseMiddleware } = require('./utils/database');
const { initializeDatabaseSchema } = require('./config/initDatabase');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Validate environment variables
validateEnv();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy configuration
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
  logger.info('Express trust proxy configuration enabled', { trustProxySetting });
} else {
  logger.warn('Express trust proxy configuration disabled; forwarded headers from proxies will be ignored');
}

// CORS Configuration
const normalizeOrigin = (origin) => {
  if (typeof origin !== 'string') {
    return '';
  }

  const trimmedOrigin = origin.trim();

  if (!trimmedOrigin) {
    return '';
  }

  try {
    const url = new URL(trimmedOrigin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
};

const isLoopbackOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  } catch {
    return false;
  }
};

const resolveAllowedCorsOrigins = () => {
  const envOrigins = process.env.ALLOWED_CORS_ORIGINS;

  if (!envOrigins) {
    return { origins: ['http://localhost:3000', 'http://127.0.0.1:3000'], inferred: true };
  }

  const origins = envOrigins
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  return { origins, inferred: false };
};

const { origins: resolvedCorsOrigins, inferred: corsOriginsWereInferred } = resolveAllowedCorsOrigins();
const hasNonLoopbackCorsOrigin = resolvedCorsOrigins.some((origin) => !isLoopbackOrigin(origin));
const allowedCorsOrigins = !corsOriginsWereInferred || hasNonLoopbackCorsOrigin ? resolvedCorsOrigins : [];
const normalizedAllowedCorsOrigins = new Set(allowedCorsOrigins.map(normalizeOrigin));

if (allowedCorsOrigins.length) {
  logger.info('CORS allowed origins configured', { origins: allowedCorsOrigins });
} else {
  logger.info('CORS allowed origins: reflecting request origin');
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedCorsOrigins.length === 0) {
      return callback(null, true);
    }

    const normalized = normalizeOrigin(origin);

    if (normalizedAllowedCorsOrigins.has(normalized)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('combined', { stream: logger.stream }));

// Initialize database
const db = initDatabase();
app.use(databaseMiddleware(db));

// Initialize database schema
initializeDatabaseSchema(db).catch((error) => {
  logger.error('Failed to initialize database schema', { error: error.message });
  process.exit(1);
});

// Promisify database for use in routes and background jobs
const { promisifyDb } = require('./utils/database');
const { runAsync, getAsync, allAsync } = promisifyDb(db);

// Import services
const { createRateLimiters } = require('./services/rateLimit');
const { createCloudflareAccessService } = require('./services/cloudflareAccess');
const { scheduleBackgroundJobs } = require('./services/backgroundJobs');
const sleeperService = require('./services/sleeperService');
const fantasyProsService = require('./services/fantasyProsService');

// Rate limiters
const { summarizeLimiter, cloudflareAccessLimiter } = createRateLimiters({
  summaryWindowMs: process.env.SUMMARY_RATE_LIMIT_WINDOW_MS,
  summaryMax: process.env.SUMMARY_RATE_LIMIT_MAX,
  cloudflareWindowMs: process.env.CF_MANAGER_AUTH_RATE_LIMIT_WINDOW_MS,
  cloudflareMax: process.env.CF_MANAGER_AUTH_RATE_LIMIT_MAX
});

// Cloudflare Access
const cloudflareAccessService = createCloudflareAccessService({
  teamDomain: process.env.CF_ACCESS_TEAM_DOMAIN,
  jwtAudience: process.env.CF_ACCESS_JWT_AUD,
  validateJwt: process.env.CF_ACCESS_VALIDATE_JWT,
  jwksCacheMs: process.env.CF_ACCESS_JWKS_CACHE_MS,
  jwksTimeoutMs: process.env.CF_ACCESS_JWKS_TIMEOUT_MS
});

// Import auth helpers
const {
  createAdminToken,
  createManagerToken,
  isAdminTokenValid,
  isManagerTokenValid,
  verifyManagerPasscodeHash
} = require('./middleware/auth');

// Mount routes
const authRouter = require('./routes/auth');
const rulesRouter = require('./routes/rules');
const sleeperRouter = require('./routes/sleeper');
const summariesRouter = require('./routes/summaries');
const managersRouter = require('./routes/managers');
const seasonsRouter = require('./routes/seasons');
const keepersRouter = require('./routes/keepers');

// Create auth and other routers that need dependencies
const { createAuthRouter } = authRouter;
const { createRulesRouter } = rulesRouter;
const { createSleeperRouter } = sleeperRouter;
const { createSummariesRouter } = summariesRouter;

const crypto = require('crypto');

app.use('/api/auth', createAuthRouter({
  adminPassword: process.env.ADMIN_PASSWORD,
  createAdminToken,
  isAdminTokenValid,
  getAdminTokenSession: (token) => ({ valid: isAdminTokenValid(token) }),
  createManagerToken,
  isManagerTokenValid,
  getManagerTokenSession: (managerId, token) => ({ valid: isManagerTokenValid(managerId, token) }),
  createPasscodeHash: (passcode) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(passcode, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  },
  verifyPasscodeHash: verifyManagerPasscodeHash,
  getAsync,
  runAsync,
  findManagerByEmail: async (email) => {
    return await getAsync('SELECT * FROM managers WHERE LOWER(email) = LOWER(?)', [email]);
  },
  cloudflareAccessLimiter,
  cloudflareAccessService
}));
app.use('/api/rules', createRulesRouter({
  getAsync,
  allAsync,
  runAsync,
  isAdminTokenValid
}));
app.use('/api/sleeper', createSleeperRouter({
  allAsync,
  sleeperService,
  syncSleeperSeason: async (params) => {
    return await sleeperService.syncSleeperSeason({ ...params, db });
  }
}));
const summaryService = require('./services/summaryService');
const weeklySummaryService = require('./services/weeklySummaryService');

app.use('/api/summaries', createSummariesRouter({
  summarizeLimiter,
  getAsync,
  runAsync,
  summaryService,
  generateWeeklySummary: async (params) => {
    return await weeklySummaryService.generateWeeklySummary({ ...params, db });
  },
  generateWeeklyPreview: async (params) => {
    return await weeklySummaryService.generateWeeklyPreview({ ...params, db });
  },
  refreshCachedSummary: async () => {
    const { summary } = await weeklySummaryService.generateWeeklySummary({ db });
    await runAsync('INSERT INTO summaries (summary) VALUES (?)', [summary]);
    return summary;
  },
  refreshCachedPreview: async () => {
    const { summary } = await weeklySummaryService.generateWeeklyPreview({ db });
    await runAsync('INSERT INTO previews (summary) VALUES (?)', [summary]);
    return summary;
  },
  extractSummaryLines: (text) => {
    return text.split('\n').filter(line => line.trim()).map(line => line.trim());
  }
}));

// New modular routes
app.use('/api/managers', managersRouter);
app.use('/api/team-seasons', seasonsRouter);
app.use('/api/keepers', keepersRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Background jobs
const refreshRosRankings = async () => {
  try {
    const { players = [], failed = [] } = await fantasyProsService.scrapeRosRankings();

    if (!players.length) {
      logger.warn('No ROS rankings retrieved', { failedCount: failed.length });
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
    logger.info('Updated ROS rankings', { playerCount: players.length });

    const lastUpdatedRow = await getAsync('SELECT MAX(updated_at) AS last_updated FROM ros_rankings');
    const lastUpdated = lastUpdatedRow?.last_updated || new Date().toISOString();

    if (failed.length) {
      logger.warn('Failed to fetch rankings for some positions', {
        failedPositions: failed,
        failedCount: failed.length
      });
    }

    return { updated: players.length, failed, lastUpdated };
  } catch (err) {
    const failureDetails = Array.isArray(err?.failed) ? err.failed : [];
    logger.error('Failed to refresh ROS rankings', {
      error: err.message,
      failureDetails: failureDetails.length > 0 ? failureDetails : undefined
    });
    err.failed = failureDetails;
    throw err;
  }
};

const syncCurrentSeasonFromSleeper = async () => {
  const seasonSettings = await getAsync(
    'SELECT year, league_id FROM league_settings WHERE year = (SELECT MAX(year) FROM league_settings)'
  );

  if (!seasonSettings || !seasonSettings.year) {
    logger.warn('Skipping scheduled Sleeper sync: no season configuration found');
    return null;
  }

  if (!seasonSettings.league_id) {
    logger.warn('Skipping scheduled Sleeper sync: missing league ID configuration', {
      year: seasonSettings.year
    });
    return null;
  }

  return sleeperService.syncSleeperSeason({
    year: seasonSettings.year,
    leagueId: seasonSettings.league_id,
    db,
    preserveManualFields: true
  });
};

scheduleBackgroundJobs({
  refreshRosRankings,
  syncCurrentSeasonFromSleeper,
  refreshCachedSummary: () => Promise.resolve(),
  refreshCachedPreview: () => Promise.resolve()
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, env: process.env.NODE_ENV || 'development' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      logger.error('Error closing database', { error: err.message });
    }
    logger.info('Database connection closed');
    if (server && server.listening) {
      server.close(() => {
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

module.exports = app;
