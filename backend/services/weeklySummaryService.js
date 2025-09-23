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
  let standingsMovement = [];
  let pointsForTopChanges = [];
  let lowestPointsForChange = null;
  let currentStandingsLeaders = [];
  let currentTopPointsFor = [];
  let currentLowestPointsFor = null;
  let hasPreviousStandingsComparison = false;

  const normalizePoints = value => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

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

      const computeStandingsThroughWeek = weekNumber => {
        if (!Number.isFinite(weekNumber)) {
          return null;
        }

        const relevantWeeks = weeks.filter(
          week => Number.isFinite(week.week) && week.week <= weekNumber
        );

        if (!relevantWeeks.length) {
          return null;
        }

        const teamStats = new Map();

        const getKey = team => {
          if (!team) {
            return null;
          }
          if (team.roster_id != null) {
            return `roster_${team.roster_id}`;
          }
          if (team.manager_name) {
            return `manager_${team.manager_name}`;
          }
          if (team.team_name) {
            return `team_${team.team_name}`;
          }
          return null;
        };

        const ensureEntry = team => {
          const key = getKey(team);
          if (!key) {
            return null;
          }

          if (!teamStats.has(key)) {
            teamStats.set(key, {
              key,
              roster_id: team.roster_id != null ? team.roster_id : null,
              manager_name:
                team.manager_name || team.team_name || `Team ${team.roster_id}`,
              team_name: team.team_name || '',
              wins: 0,
              losses: 0,
              ties: 0,
              points_for: 0,
              points_against: 0
            });
          }

          return teamStats.get(key);
        };

        relevantWeeks.forEach(week => {
          week.matchups.forEach(matchup => {
            const { home, away } = matchup || {};
            if (!home || !away) {
              return;
            }

            const homePoints = normalizePoints(home.points);
            const awayPoints = normalizePoints(away.points);

            const homeEntry = ensureEntry(home);
            const awayEntry = ensureEntry(away);

            if (!homeEntry || !awayEntry) {
              return;
            }

            homeEntry.points_for += homePoints;
            homeEntry.points_against += awayPoints;
            awayEntry.points_for += awayPoints;
            awayEntry.points_against += homePoints;

            if (homePoints > awayPoints) {
              homeEntry.wins += 1;
              awayEntry.losses += 1;
            } else if (awayPoints > homePoints) {
              awayEntry.wins += 1;
              homeEntry.losses += 1;
            } else {
              homeEntry.ties += 1;
              awayEntry.ties += 1;
            }
          });
        });

        const roundedEntries = Array.from(teamStats.values()).map(entry => ({
          ...entry,
          points_for: Number(entry.points_for.toFixed(1)),
          points_against: Number(entry.points_against.toFixed(1))
        }));

        const pfRanking = roundedEntries
          .map(entry => ({ ...entry }))
          .sort((a, b) => (b.points_for || 0) - (a.points_for || 0))
          .map((entry, idx) => ({ ...entry, pfRank: idx + 1 }));

        const pfRankMap = new Map(
          pfRanking.map(entry => [entry.key, entry.pfRank])
        );

        const standings = roundedEntries
          .map(entry => ({
            ...entry,
            pfRank: pfRankMap.get(entry.key) || null
          }))
          .sort((a, b) => {
            const winDiff = (b.wins || 0) - (a.wins || 0);
            if (winDiff !== 0) {
              return winDiff;
            }
            const lossDiff = (a.losses || 0) - (b.losses || 0);
            if (lossDiff !== 0) {
              return lossDiff;
            }
            const pfDiff = (b.points_for || 0) - (a.points_for || 0);
            if (pfDiff !== 0) {
              return pfDiff;
            }
            return (a.points_against || 0) - (b.points_against || 0);
          })
          .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

        const teamIndex = new Map(
          standings.map(entry => [entry.key, entry])
        );

        return {
          standings,
          pfRanking,
          teamIndex
        };
      };

      const previousWeekNumber = lastWeek.week > 1 ? lastWeek.week - 1 : null;
      const currentStandingsData = computeStandingsThroughWeek(lastWeek.week);
      const previousStandingsData = previousWeekNumber
        ? computeStandingsThroughWeek(previousWeekNumber)
        : null;

      if (currentStandingsData) {
        currentStandingsLeaders = currentStandingsData.standings.slice(0, 3);
        currentTopPointsFor = currentStandingsData.pfRanking.slice(0, 3);
        currentLowestPointsFor =
          currentStandingsData.pfRanking[currentStandingsData.pfRanking.length - 1] ||
          null;
      }

      if (currentStandingsData && previousStandingsData) {
        hasPreviousStandingsComparison = true;

        const prevRankMap = new Map(
          previousStandingsData.standings.map(team => [team.key, team])
        );

        standingsMovement = currentStandingsData.standings
          .filter(team => {
            const prev = prevRankMap.get(team.key);
            return prev && prev.rank !== team.rank;
          })
          .map(team => {
            const prev = prevRankMap.get(team.key);
            const formatRecord = entry => {
              const wins = entry.wins != null ? entry.wins : 0;
              const losses = entry.losses != null ? entry.losses : 0;
              const ties = entry.ties != null ? entry.ties : 0;
              return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
            };

            return {
              manager_name: team.manager_name,
              team_name: team.team_name,
              previous_rank: prev.rank,
              current_rank: team.rank,
              record: formatRecord(team),
              points_for: team.points_for
            };
          });

        const prevTop = previousStandingsData.pfRanking.slice(0, 3);
        const currentTop = currentStandingsData.pfRanking.slice(0, 3);

        const prevTopMap = new Map(prevTop.map(entry => [entry.key, entry]));
        const currentTopMap = new Map(
          currentTop.map(entry => [entry.key, entry])
        );

        pointsForTopChanges = currentTop
          .filter(entry => {
            const prev = prevTopMap.get(entry.key);
            return !prev || prev.pfRank !== entry.pfRank;
          })
          .map(entry => {
            const prevEntry = previousStandingsData.teamIndex.get(entry.key);
            return {
              manager_name: entry.manager_name,
              team_name: entry.team_name,
              previous_rank: prevEntry ? prevEntry.pfRank : null,
              current_rank: entry.pfRank,
              previous_points_for: prevEntry ? prevEntry.points_for : null,
              current_points_for: entry.points_for
            };
          });

        prevTop.forEach(entry => {
          if (!currentTopMap.has(entry.key)) {
            const currentEntry = currentStandingsData.teamIndex.get(entry.key);
            pointsForTopChanges.push({
              manager_name: entry.manager_name,
              team_name: entry.team_name,
              previous_rank: entry.pfRank,
              current_rank: currentEntry ? currentEntry.pfRank : null,
              previous_points_for: entry.points_for,
              current_points_for: currentEntry ? currentEntry.points_for : null
            });
          }
        });

        const prevLowest =
          previousStandingsData.pfRanking[
            previousStandingsData.pfRanking.length - 1
          ] || null;
        const currentLowest = currentStandingsData.pfRanking[
          currentStandingsData.pfRanking.length - 1
        ] || null;

        if (prevLowest && currentLowest && prevLowest.key !== currentLowest.key) {
          lowestPointsForChange = {
            previous: {
              manager_name: prevLowest.manager_name,
              team_name: prevLowest.team_name,
              points_for: prevLowest.points_for
            },
            current: {
              manager_name: currentLowest.manager_name,
              team_name: currentLowest.team_name,
              points_for: currentLowest.points_for
            }
          };
        }
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
    standingsMovement,
    pointsForTopChanges,
    lowestPointsForChange,
    currentStandingsLeaders,
    currentTopPointsFor,
    currentLowestPointsFor,
    hasPreviousStandingsComparison,
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

  const toNumber = value => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

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
        const homePf = homeTeam ? toNumber(homeTeam.points_for) : null;
        const awayPf = awayTeam ? toNumber(awayTeam.points_for) : null;
        const homeWins = homeTeam ? toNumber(homeTeam.wins) : null;
        const awayWins = awayTeam ? toNumber(awayTeam.wins) : null;
        const pfDiff =
          homePf != null && awayPf != null
            ? Number((homePf - awayPf).toFixed(1))
            : null;
        const favorite =
          homePf != null && awayPf != null
            ? homePf > awayPf
              ? m.home.manager_name
              : awayPf > homePf
              ? m.away.manager_name
              : null
            : null;
        const winGap =
          homeWins != null && awayWins != null
            ? Math.abs(homeWins - awayWins)
            : null;

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
          },
          favorite,
          pf_diff: pfDiff,
          win_gap: winGap
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
