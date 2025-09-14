const summaryService = require('./summaryService');
const sleeperService = require('./sleeperService');

const getAsync = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const allAsync = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

async function buildSeasonSummaryData(db) {
  const { year } = await getAsync(db, 'SELECT MAX(year) as year FROM team_seasons');
  if (!year) {
    throw new Error('No seasons found');
  }

  const champion = await getAsync(
    db,
    `SELECT ts.*, m.full_name as manager_name
     FROM team_seasons ts
     LEFT JOIN managers m ON ts.name_id = m.name_id
     WHERE ts.year = ? AND ts.playoff_finish = 1`,
    [year]
  );

  const runnerUp = await getAsync(
    db,
    `SELECT ts.*, m.full_name as manager_name
     FROM team_seasons ts
     LEFT JOIN managers m ON ts.name_id = m.name_id
     WHERE ts.year = ? AND ts.playoff_finish = 2`,
    [year]
  );

  const thirdPlace = await getAsync(
    db,
    `SELECT ts.*, m.full_name as manager_name
     FROM team_seasons ts
     LEFT JOIN managers m ON ts.name_id = m.name_id
     WHERE ts.year = ? AND ts.playoff_finish = 3`,
    [year]
  );

  const teams = await allAsync(
    db,
    `SELECT ts.*, m.full_name as manager_name
     FROM team_seasons ts
     LEFT JOIN managers m ON ts.name_id = m.name_id
     WHERE ts.year = ?
     ORDER BY ts.regular_season_rank ASC`,
    [year]
  );

  const leagueRow = await getAsync(db, 'SELECT league_id FROM league_settings WHERE year = ?', [year]);
  const managers = await allAsync(
    db,
    `SELECT m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
     FROM managers m
     LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?`,
    [year]
  );

  let matchups = [];
  let topWeeklyScores = [];
  let bottomWeeklyScores = [];
  let currentWeek = null;
  let title = null;

  if (leagueRow && leagueRow.league_id) {
    const weeks = await sleeperService.getSeasonMatchups(
      leagueRow.league_id,
      managers
    );
    currentWeek = await sleeperService.getCurrentNFLWeek();

    const completedWeek = currentWeek != null ? currentWeek - 1 : null;
    const lastWeek = completedWeek != null
      ? weeks.find(w => w.week === completedWeek)
      : weeks[weeks.length - 1];

    if (lastWeek) {
      matchups = lastWeek.matchups.map(m => ({ ...m, week: lastWeek.week }));

      const scores = lastWeek.matchups
        .flatMap(m => [
          { manager_name: m.home.manager_name, points: m.home.points, week: lastWeek.week },
          { manager_name: m.away.manager_name, points: m.away.points, week: lastWeek.week }
        ])
        .filter(s => s.points > 0);

      topWeeklyScores = [...scores]
        .sort((a, b) => b.points - a.points)
        .slice(0, 5);
      bottomWeeklyScores = [...scores]
        .sort((a, b) => a.points - b.points)
        .slice(0, 5);
      title = `Week ${lastWeek.week} In Review`;
      currentWeek = lastWeek.week;
    }
  }

  return {
    type: 'season',
    year,
    champion,
    runnerUp,
    thirdPlace,
    teams,
    topWeeklyScores,
    bottomWeeklyScores,
    matchups,
    currentWeek,
    title
  };
}

async function generateWeeklySummary(db) {
  const data = await buildSeasonSummaryData(db);
  const summary = await summaryService.generateSummary(data);
  return { summary, data };
}

async function buildPreviewData(db) {
  const { year } = await getAsync(db, 'SELECT MAX(year) as year FROM team_seasons');
  if (!year) {
    throw new Error('No seasons found');
  }

  const teams = await allAsync(
    db,
    `SELECT ts.*, m.full_name as manager_name
     FROM team_seasons ts
     LEFT JOIN managers m ON ts.name_id = m.name_id
     WHERE ts.year = ?`,
    [year]
  );

  const leagueRow = await getAsync(db, 'SELECT league_id FROM league_settings WHERE year = ?', [year]);
  const managers = await allAsync(
    db,
    `SELECT m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
     FROM managers m
     LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?`,
    [year]
  );

  let matchups = [];
  let nextWeek = null;
  let title = null;

  if (leagueRow && leagueRow.league_id) {
    const weeks = await sleeperService.getSeasonMatchups(
      leagueRow.league_id,
      managers
    );
    const currentWeek = await sleeperService.getCurrentNFLWeek();
    nextWeek = currentWeek != null ? currentWeek + 1 : null;
    const nextWeekData = weeks.find(w => w.week === nextWeek);
    if (nextWeekData) {
      matchups = nextWeekData.matchups.map(m => {
        const homeTeam = teams.find(t => t.manager_name === m.home.manager_name);
        const awayTeam = teams.find(t => t.manager_name === m.away.manager_name);
        return {
          week: nextWeek,
          home: {
            manager_name: m.home.manager_name,
            record: homeTeam ? `${homeTeam.wins}-${homeTeam.losses}` : ''
          },
          away: {
            manager_name: m.away.manager_name,
            record: awayTeam ? `${awayTeam.wins}-${awayTeam.losses}` : ''
          }
        };
      });
      title = `Week ${nextWeek} Preview`;
    }
  }

  return { type: 'preview', year, teams, matchups, currentWeek: nextWeek, title };
}

async function generateWeeklyPreview(db) {
  const data = await buildPreviewData(db);
  const summary = await summaryService.generateSummary(data);
  return { summary, data };
}

module.exports = { buildSeasonSummaryData, generateWeeklySummary, buildPreviewData, generateWeeklyPreview };
