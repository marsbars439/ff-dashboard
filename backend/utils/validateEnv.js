/**
 * Environment Variable Validation
 * Validates required environment variables on application startup
 */

const logger = require('./logger');

/**
 * Required environment variables
 */
const REQUIRED_ENV_VARS = [
  'PORT',
  'ADMIN_PASSWORD'
];

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  TRUST_PROXY: 'false',
  EXPRESS_TRUST_PROXY: 'false'
};

/**
 * Environment variables that should be URLs
 */
const URL_ENV_VARS = [
  'ALLOWED_CORS_ORIGINS' // Can be comma-separated URLs
];

/**
 * Environment variables that should be numeric
 */
const NUMERIC_ENV_VARS = [
  'PORT',
  'SUMMARY_RATE_LIMIT_WINDOW_MS',
  'SUMMARY_RATE_LIMIT_MAX',
  'CF_MANAGER_AUTH_RATE_LIMIT_WINDOW_MS',
  'CF_MANAGER_AUTH_RATE_LIMIT_MAX',
  'CF_ACCESS_JWKS_CACHE_MS',
  'CF_ACCESS_JWKS_TIMEOUT_MS'
];

/**
 * Validate a single environment variable
 */
function validateEnvVar(name, value, validations = {}) {
  const errors = [];

  // Check if required
  if (validations.required && !value) {
    errors.push(`${name} is required but not set`);
    return errors;
  }

  // Skip further validation if optional and not set
  if (!value) {
    return errors;
  }

  // Validate numeric
  if (validations.numeric) {
    const num = Number(value);
    if (isNaN(num)) {
      errors.push(`${name} must be a valid number, got: ${value}`);
    } else if (validations.min !== undefined && num < validations.min) {
      errors.push(`${name} must be >= ${validations.min}, got: ${num}`);
    } else if (validations.max !== undefined && num > validations.max) {
      errors.push(`${name} must be <= ${validations.max}, got: ${num}`);
    }
  }

  // Validate URL
  if (validations.url) {
    try {
      new URL(value);
    } catch (e) {
      errors.push(`${name} must be a valid URL, got: ${value}`);
    }
  }

  // Validate enum
  if (validations.enum && !validations.enum.includes(value)) {
    errors.push(`${name} must be one of [${validations.enum.join(', ')}], got: ${value}`);
  }

  // Validate pattern
  if (validations.pattern && !validations.pattern.test(value)) {
    errors.push(`${name} does not match required pattern`);
  }

  return errors;
}

/**
 * Validate all environment variables
 */
function validateEnv() {
  const errors = [];
  const warnings = [];

  // Validate required variables
  REQUIRED_ENV_VARS.forEach(varName => {
    const value = process.env[varName];
    const varErrors = validateEnvVar(varName, value, { required: true });
    errors.push(...varErrors);
  });

  // Validate numeric variables
  NUMERIC_ENV_VARS.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      const varErrors = validateEnvVar(varName, value, {
        numeric: true,
        min: varName === 'PORT' ? 1 : 0
      });
      errors.push(...varErrors);
    }
  });

  // Validate NODE_ENV
  if (process.env.NODE_ENV) {
    const varErrors = validateEnvVar('NODE_ENV', process.env.NODE_ENV, {
      enum: ['development', 'production', 'test']
    });
    errors.push(...varErrors);
  }

  // Validate LOG_LEVEL
  if (process.env.LOG_LEVEL) {
    const varErrors = validateEnvVar('LOG_LEVEL', process.env.LOG_LEVEL, {
      enum: ['error', 'warn', 'info', 'http', 'debug']
    });
    errors.push(...varErrors);
  }

  // Check for recommended but not required vars
  const recommendedVars = [
    'OPENAI_API_KEY',
    'CF_ACCESS_TEAM_DOMAIN',
    'CF_ACCESS_JWT_AUD'
  ];

  recommendedVars.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(`${varName} is not set (some features may not work)`);
    }
  });

  // Set defaults for optional variables
  Object.entries(OPTIONAL_ENV_VARS).forEach(([name, defaultValue]) => {
    if (!process.env[name]) {
      process.env[name] = defaultValue;
      logger.info(`Using default value for ${name}`, { default: defaultValue });
    }
  });

  // Report errors
  if (errors.length > 0) {
    logger.error('Environment validation failed', { errors });
    console.error('\n❌ Environment Validation Errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('\nPlease fix the above errors and restart the application.\n');
    process.exit(1);
  }

  // Report warnings
  if (warnings.length > 0) {
    logger.warn('Environment validation warnings', { warnings });
    console.warn('\n⚠️  Environment Validation Warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
    console.warn('');
  }

  // Success
  logger.info('Environment validation passed', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT
  });

  return true;
}

module.exports = {
  validateEnv,
  validateEnvVar
};
