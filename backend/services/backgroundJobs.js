let cron;
try {
  // eslint-disable-next-line global-require
  cron = require('node-cron');
} catch (error) {
  cron = null;
}

function scheduleBackgroundJobs({
  refreshRosRankings,
  syncCurrentSeasonFromSleeper,
  refreshCachedSummary,
  refreshCachedPreview,
  scheduler,
  timezone = 'America/New_York',
  logger = console,
  runInitialRosRefresh = true
} = {}) {
  const resolvedScheduler = scheduler || cron;

  if (!resolvedScheduler || typeof resolvedScheduler.schedule !== 'function') {
    throw new Error('A scheduler with a schedule() function is required');
  }

  const jobs = [];

  const safeInvoke = async (fn, errorMessage) => {
    if (typeof fn !== 'function') {
      return;
    }

    try {
      await fn();
    } catch (err) {
      logger.error?.(`${errorMessage}:`, err.message);
    }
  };

  if (typeof refreshRosRankings === 'function') {
    if (runInitialRosRefresh) {
      safeInvoke(refreshRosRankings, 'Initial ROS rankings refresh failed');
    }

    const rosJob = resolvedScheduler.schedule(
      '0 3 * * *',
      () => safeInvoke(refreshRosRankings, 'Scheduled ROS rankings refresh failed'),
      { timezone }
    );
    jobs.push(rosJob);
  }

  if (typeof syncCurrentSeasonFromSleeper === 'function') {
    const sleeperJob = resolvedScheduler.schedule(
      '55 3 * * 2',
      () => safeInvoke(syncCurrentSeasonFromSleeper, 'Scheduled Sleeper sync failed'),
      { timezone }
    );
    jobs.push(sleeperJob);
  }

  if (typeof refreshCachedSummary === 'function' || typeof refreshCachedPreview === 'function') {
    const weeklyJob = resolvedScheduler.schedule(
      '0 4 * * 2',
      () => {
        safeInvoke(refreshCachedSummary, 'Failed to refresh weekly summary');
        safeInvoke(refreshCachedPreview, 'Failed to refresh weekly preview');
      },
      { timezone }
    );
    jobs.push(weeklyJob);
  }

  return { jobs };
}

module.exports = {
  scheduleBackgroundJobs
};
