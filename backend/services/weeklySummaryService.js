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
  let closestMatchups = [];
  let biggestBlowouts = [];
  let highestScoringMatchups = [];
  let standoutPlayers = [];
  let strugglingPlayers = [];

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

      const normalizePoints = value => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const matchupDetails = lastWeek.matchups
        .map(m => {
          if (!m || !m.home || !m.away) {
            return null;
          }

          const homePoints = normalizePoints(m.home.points);
          const awayPoints = normalizePoints(m.away.points);
          const margin = Math.abs(homePoints - awayPoints);

          return {
            week: lastWeek.week,
            home: {
              manager_name: m.home.manager_name,
              points: homePoints
            },
            away: {
              manager_name: m.away.manager_name,
              points: awayPoints
            },
            margin,
            totalPoints: homePoints + awayPoints,
            winner:
              homePoints >= awayPoints
                ? m.home.manager_name
                : m.away.manager_name,
            loser:
              homePoints >= awayPoints
                ? m.away.manager_name
                : m.home.manager_name
          };
        })
        .filter(Boolean);

      if (matchupDetails.length) {
        const byTightest = [...matchupDetails].sort(
          (a, b) => a.margin - b.margin
        );
        closestMatchups = byTightest.slice(0, Math.min(3, byTightest.length));

        const byMargin = [...matchupDetails].sort(
          (a, b) => b.margin - a.margin
        );
        biggestBlowouts = byMargin.slice(0, Math.min(3, byMargin.length));

        const byTotalPoints = [...matchupDetails].sort(
          (a, b) => b.totalPoints - a.totalPoints
        );
        highestScoringMatchups = byTotalPoints.slice(
          0,
          Math.min(3, byTotalPoints.length)
        );
      }

      try {
        const lineupData = await sleeperService.getWeeklyMatchupsWithLineups(
          leagueRow.league_id,
          lastWeek.week,
          managers,
          year
        );

        const allStarters = [];
        (lineupData?.matchups || []).forEach(matchup => {
          ['home', 'away'].forEach(side => {
            const team = matchup?.[side];
            if (!team || !Array.isArray(team.starters)) {
              return;
            }

            team.starters.forEach(player => {
              if (!player) {
                return;
              }

              const numericPoints =
                typeof player.points === 'number'
                  ? player.points
                  : Number(player.points);

              if (!Number.isFinite(numericPoints)) {
                return;
              }

              allStarters.push({
                manager_name: team.manager_name || team.team_name || '',
                team_name: team.team_name || '',
                player_name: player.name || '',
                position: player.position || '',
                points: numericPoints,
                opponent: player.opponent || null,
                nfl_team: player.team || null
              });
            });
          });
        });

        if (allStarters.length) {
          const descByPoints = [...allStarters].sort(
            (a, b) => b.points - a.points
          );
          standoutPlayers = descByPoints
            .slice(0, Math.min(8, descByPoints.length))
            .map(player => ({
              ...player,
              points: Number(player.points.toFixed(1))
            }));

          const ascByPoints = [...allStarters].sort(
            (a, b) => a.points - b.points
          );
          strugglingPlayers = ascByPoints
            .slice(0, Math.min(8, ascByPoints.length))
            .map(player => ({
              ...player,
              points: Number(player.points.toFixed(1))
            }));
        }
      } catch (err) {
        console.error(
          'Failed to enrich weekly summary with lineup data:',
          err.message
        );
      }
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
    closestMatchups,
    biggestBlowouts,
    highestScoringMatchups,
    standoutPlayers,
    strugglingPlayers,
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
            record: homeTeam ? `${homeTeam.wins}-${homeTeam.losses}` : '',
            wins: homeTeam ? homeTeam.wins : null,
            losses: homeTeam ? homeTeam.losses : null,
            points_for: homeTeam ? homeTeam.points_for : null,
            points_against: homeTeam ? homeTeam.points_against : null,
            rank: homeTeam ? homeTeam.regular_season_rank : null
          },
          away: {
            manager_name: m.away.manager_name,
            record: awayTeam ? `${awayTeam.wins}-${awayTeam.losses}` : '',
            wins: awayTeam ? awayTeam.wins : null,
            losses: awayTeam ? awayTeam.losses : null,
            points_for: awayTeam ? awayTeam.points_for : null,
            points_against: awayTeam ? awayTeam.points_against : null,
            rank: awayTeam ? awayTeam.regular_season_rank : null
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
