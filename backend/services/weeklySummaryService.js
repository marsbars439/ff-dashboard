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

  if (leagueRow && leagueRow.league_id) {
    const weeks = await sleeperService.getSeasonMatchups(leagueRow.league_id, managers);
    matchups = weeks.flatMap(week =>
      week.matchups.map(m => ({ ...m, week: week.week }))
    );
    currentWeek = weeks.length > 0 ? Math.max(...weeks.map(w => w.week)) : null;

    const scores = weeks.flatMap(week =>
      week.matchups.flatMap(m => [
        { manager_name: m.home.manager_name, points: m.home.points, week: week.week },
        { manager_name: m.away.manager_name, points: m.away.points, week: week.week }
      ])
    ).filter(s => s.points > 0);
    topWeeklyScores = [...scores].sort((a,b) => b.points - a.points).slice(0,5);
    bottomWeeklyScores = [...scores].sort((a,b) => a.points - b.points).slice(0,5);
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
    currentWeek
  };
}

async function generateWeeklySummary(db) {
  const data = await buildSeasonSummaryData(db);
  const summary = await summaryService.generateSummary(data);
  return { summary, data };
}

module.exports = { buildSeasonSummaryData, generateWeeklySummary };
