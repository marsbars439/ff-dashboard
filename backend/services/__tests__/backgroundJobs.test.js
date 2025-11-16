const test = require('node:test');
const assert = require('node:assert');
const { scheduleBackgroundJobs } = require('../backgroundJobs');

test('schedules recurring jobs and triggers initial refresh', async () => {
  const scheduled = [];
  const scheduler = {
    schedule(expression, task) {
      scheduled.push({ expression, task });
      return { expression };
    }
  };

  let rosRefreshCount = 0;
  let sleeperSyncCount = 0;
  let summaryRefreshCount = 0;
  let previewRefreshCount = 0;

  const logger = { error: () => {} };

  scheduleBackgroundJobs({
    refreshRosRankings: async () => {
      rosRefreshCount += 1;
    },
    syncCurrentSeasonFromSleeper: async () => {
      sleeperSyncCount += 1;
    },
    refreshCachedSummary: async () => {
      summaryRefreshCount += 1;
    },
    refreshCachedPreview: async () => {
      previewRefreshCount += 1;
    },
    scheduler,
    logger
  });

  // Allow the initial invocation to run
  await new Promise(setImmediate);
  assert.strictEqual(rosRefreshCount, 1);
  assert.deepStrictEqual(
    scheduled.map(job => job.expression),
    ['0 3 * * *', '55 3 * * 2', '0 4 * * 2']
  );

  await scheduled[1].task();
  assert.strictEqual(sleeperSyncCount, 1);

  await scheduled[2].task();
  assert.strictEqual(summaryRefreshCount, 1);
  assert.strictEqual(previewRefreshCount, 1);
});
