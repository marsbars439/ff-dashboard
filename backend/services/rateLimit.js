let rateLimit;
try {
  // eslint-disable-next-line global-require
  rateLimit = require('express-rate-limit');
} catch (error) {
  rateLimit = (options = {}) => {
    const handler = (req, res, next) => {
      if (typeof next === 'function') {
        next();
      }
    };
    handler.options = options;
    return handler;
  };
}

const parsePositiveInt = (value, fallback) => {
  const numeric = parseInt(value, 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

function createRateLimiters({
  summaryWindowMs,
  summaryMax,
  cloudflareWindowMs,
  cloudflareMax
} = {}) {
  const summarizeLimiter = rateLimit({
    windowMs: parsePositiveInt(summaryWindowMs, 60 * 1000),
    max: parsePositiveInt(summaryMax, 20),
    message: 'Too many requests, please try again later.'
  });

  const cloudflareAccessLimiter = rateLimit({
    windowMs: parsePositiveInt(cloudflareWindowMs, 60 * 1000),
    max: parsePositiveInt(cloudflareMax, 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many authentication attempts, please try again later.'
  });

  return { summarizeLimiter, cloudflareAccessLimiter };
}

module.exports = {
  createRateLimiters
};
