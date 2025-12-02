/**
 * Application Constants
 * Centralized configuration values to avoid magic numbers
 */

// Authentication
const AUTH = {
  ADMIN_TOKEN_TTL_MS: 15 * 60 * 1000, // 15 minutes
  MANAGER_TOKEN_TTL_MS: 12 * 60 * 60 * 1000, // 12 hours
  SALT_ROUNDS: 10
};

// Rate Limiting
const RATE_LIMIT = {
  SUMMARY_WINDOW_MS: 60 * 1000, // 1 minute
  SUMMARY_MAX: 20, // 20 requests per window
  CLOUDFLARE_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  CLOUDFLARE_MAX: 10 // 10 requests per window
};

// Cache TTL (Time To Live)
const CACHE_TTL = {
  PLAYERS_MS: 24 * 60 * 60 * 1000, // 24 hours
  SCHEDULE_MS: 24 * 60 * 60 * 1000, // 24 hours
  STATS_MS: 10 * 60 * 1000, // 10 minutes
  NFL_STATE_MS: 5 * 60 * 1000 // 5 minutes
};

// Sleeper API
const SLEEPER = {
  BASE_URL: 'https://api.sleeper.app/v1',
  GAME_COMPLETION_BUFFER_MS: 4.5 * 60 * 60 * 1000, // 4.5 hours
  REQUEST_TIMEOUT_MS: 10000 // 10 seconds
};

// ESPN API
const ESPN = {
  BASE_URL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  REQUEST_TIMEOUT_MS: 10000 // 10 seconds
};

// Fantasy Football Settings
const FANTASY = {
  PLAYOFF_THRESHOLD: 6, // Top 6 make playoffs
  REGULAR_SEASON_WEEKS: 14, // Standard regular season length
  TOTAL_WEEKS: 18, // Including playoffs
  MIN_YEAR: 2016, // First season of the league
  DEFAULT_POLLING_INTERVAL_MS: 30000 // 30 seconds for live updates
};

// Database
const DATABASE = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000
};

// File Upload
const UPLOAD = {
  MAX_FILE_SIZE_MB: 10,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_MIME_TYPES: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
};

// HTTP Status Codes (for clarity)
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
};

// Logging Levels
const LOG_LEVEL = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  DEBUG: 'debug'
};

module.exports = {
  AUTH,
  RATE_LIMIT,
  CACHE_TTL,
  SLEEPER,
  ESPN,
  FANTASY,
  DATABASE,
  UPLOAD,
  HTTP_STATUS,
  LOG_LEVEL
};
