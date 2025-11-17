const test = require('node:test');
const assert = require('node:assert');
const { createRateLimiters } = require('../rateLimit');

test('creates rate limiters with custom configuration', () => {
  const { summarizeLimiter, cloudflareAccessLimiter } = createRateLimiters({
    summaryWindowMs: 5000,
    summaryMax: 3,
    cloudflareWindowMs: 10000,
    cloudflareMax: 2
  });

  assert.strictEqual(summarizeLimiter.options.windowMs, 5000);
  assert.strictEqual(summarizeLimiter.options.max, 3);
  assert.strictEqual(cloudflareAccessLimiter.options.windowMs, 10000);
  assert.strictEqual(cloudflareAccessLimiter.options.max, 2);
  assert.strictEqual(cloudflareAccessLimiter.options.standardHeaders, true);
});
