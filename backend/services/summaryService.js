const OpenAI = require('openai');

// Initialize OpenAI client using API key from environment variables
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Build a text prompt highlighting key fantasy football insights.
 * @param {object} data
 * @returns {string}
 */
function buildSummaryPrompt(data) {
  // Normalize to object
  const d = typeof data === 'object' && data !== null ? data : {};
  const sections = [];
  const title = typeof d.title === 'string' ? d.title : '';
  const isReview = d.type === 'season';
  const isPreview = d.type === 'preview';
  const hasComparison = Boolean(d.hasPreviousStandingsComparison);

  const toNumber = value => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatNumber = (value, digits = 1) => {
    const num = toNumber(value);
    if (num === null) {
      return null;
    }
    const rounded = Number(num.toFixed(digits));
    return Number.isFinite(rounded) ? rounded.toString() : num.toFixed(digits);
  };

  const formatRecordString = entry => {
    if (!entry) {
      return '';
    }

    const wins = toNumber(entry.wins);
    const losses = toNumber(entry.losses);
    const ties = toNumber(entry.ties);

    if (wins === null || losses === null) {
      return '';
    }

    if (ties && ties > 0) {
      return `${wins}-${losses}-${ties}`;
    }

    return `${wins}-${losses}`;
  };

  const describeMatchup = (
    matchup,
    { emphasiseMargin = false, emphasiseTotal = false } = {}
  ) => {
    if (!matchup || !matchup.home || !matchup.away) {
      return null;
    }

    const weekLabel = matchup.week ? `W${matchup.week} ` : '';
    const homeName = matchup.home.manager_name || matchup.home.team_name || 'Home';
    const awayName = matchup.away.manager_name || matchup.away.team_name || 'Away';
    const homePtsNum = toNumber(matchup.home.points);
    const awayPtsNum = toNumber(matchup.away.points);
    if (homePtsNum === null || awayPtsNum === null) {
      return null;
    }

    const homePoints = formatNumber(homePtsNum, 1);
    const awayPoints = formatNumber(awayPtsNum, 1);
    let detail = `${weekLabel}${homeName} ${homePoints} - ${awayPoints} ${awayName}`;

    if (emphasiseMargin) {
      const marginValue =
        matchup.margin != null
          ? matchup.margin
          : Math.abs(homePtsNum - awayPtsNum);
      const margin = formatNumber(marginValue, 1);
      if (margin !== null) {
        detail += ` (margin ${margin})`;
      }
    }

    if (emphasiseTotal) {
      const totalValue =
        matchup.totalPoints != null
          ? matchup.totalPoints
          : homePtsNum + awayPtsNum;
      const total = formatNumber(totalValue, 1);
      if (total !== null) {
        detail += `, ${total} total`;
      }
    }

    return detail;
  };

  if (typeof d.currentWeek === 'number') {
    sections.push(`Current week: ${d.currentWeek}`);
  }

  // Managers and win/loss records
  const managerRecords = [];
  const managers = new Set();
  const teams = Array.isArray(d.teams) ? d.teams : [];
  teams.forEach(t => {
    if (t.manager_name) {
      managers.add(t.manager_name);
      if (t.wins != null && t.losses != null) {
        managerRecords.push(`${t.manager_name}: ${t.wins}-${t.losses}`);
      }
    }
  });

  const records = [
    ...(Array.isArray(d.activeRecords) ? d.activeRecords : []),
    ...(Array.isArray(d.inactiveRecords) ? d.inactiveRecords : [])
  ];
  records.forEach(r => {
    if (r.manager_name) {
      managers.add(r.manager_name);
      if (r.wins != null && r.losses != null) {
        managerRecords.push(`${r.manager_name}: ${r.wins}-${r.losses}`);
      } else if (r.winPct != null) {
        const percent = formatNumber(r.winPct * 100, 1);
        if (percent !== null) {
          managerRecords.push(`${r.manager_name}: ${percent}% win pct`);
        }
      }
    }
  });
  if (!isReview) {
    if (managerRecords.length) {
      sections.push(`Managers and records: ${managerRecords.join('; ')}`);
    } else if (managers.size) {
      sections.push(`Managers: ${Array.from(managers).join(', ')}`);
    }
  }

  const rankedTeams = teams
    .map(team => ({
      ...team,
      wins: toNumber(team.wins),
      losses: toNumber(team.losses),
      points_for: toNumber(team.points_for),
      points_against: toNumber(team.points_against)
    }))
    .filter(team => team.manager_name);

  if (!isReview && rankedTeams.length) {
    const standings = [...rankedTeams].sort((a, b) => {
      if (a.wins == null && b.wins == null) {
        return 0;
      }
      if (a.wins == null) {
        return 1;
      }
      if (b.wins == null) {
        return -1;
      }
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      const bPoints = b.points_for != null ? b.points_for : 0;
      const aPoints = a.points_for != null ? a.points_for : 0;
      return bPoints - aPoints;
    });

    const standingsLines = standings
      .slice(0, Math.min(8, standings.length))
      .map((team, idx) => {
        const rankLabel =
          team.regular_season_rank != null
            ? `#${team.regular_season_rank}`
            : `#${idx + 1}`;
        const record =
          team.wins != null && team.losses != null
            ? `${team.wins}-${team.losses}`
            : '';
        const pf = formatNumber(team.points_for, 1);
        const pa = formatNumber(team.points_against, 1);
        const parts = [
          `${rankLabel} ${team.manager_name || team.team_name}`
        ];
        if (record) {
          parts.push(record);
        }
        if (pf) {
          parts.push(`${pf} PF`);
        }
        if (pa) {
          parts.push(`${pa} PA`);
        }
        return parts.join(' ');
      });

    if (standingsLines.length) {
      sections.push(`Standings snapshot: ${standingsLines.join('; ')}`);
    }

    const bubbleTeams = standings.slice(3, Math.min(7, standings.length));
    if (bubbleTeams.length >= 2) {
      const bubbleLines = bubbleTeams.map(team => {
        const record =
          team.wins != null && team.losses != null
            ? `${team.wins}-${team.losses}`
            : '';
        const pf = formatNumber(team.points_for, 1);
        const parts = [team.manager_name];
        if (record) {
          parts.push(record);
        }
        if (pf) {
          parts.push(`${pf} PF`);
        }
        return parts.join(' ');
      });

      const highWins = bubbleTeams[0].wins;
      const lowWins = bubbleTeams[bubbleTeams.length - 1].wins;
      const winSpread =
        highWins != null && lowWins != null
          ? formatNumber(highWins - lowWins, 0)
          : null;
      const spreadText = winSpread ? ` (win spread ${winSpread})` : '';
      sections.push(`Playoff bubble: ${bubbleLines.join('; ')}${spreadText}`);
    }

    const pointsLeaders = standings
      .filter(team => team.points_for != null)
      .sort((a, b) => b.points_for - a.points_for)
      .slice(0, Math.min(5, standings.length))
      .map(team => {
        const pf = formatNumber(team.points_for, 1);
        if (pf === null) {
          return null;
        }
        const record =
          team.wins != null && team.losses != null
            ? `${team.wins}-${team.losses}`
            : '';
        return `${team.manager_name}: ${pf} PF${record ? ` (${record})` : ''}`;
      })
      .filter(Boolean);
    if (pointsLeaders.length) {
      sections.push(`Points leaders: ${pointsLeaders.join('; ')}`);
    }
  }

  // Medal counts
  if (Array.isArray(d.medalRankings)) {
    const medalLines = d.medalRankings.map(
      m => `${m.manager_name}: ${m.totalMedals}`
    );
    sections.push(`Medal counts: ${medalLines.join('; ')}`);
  }

  // Hall of Records data for historical context
  if (!isReview && records.length) {
    const hallRecords = records.map(r => ({
      name: r.manager_name || r.name,
      totalWins: r.totalWins,
      totalLosses: r.totalLosses,
      totalPointsFor: r.totalPointsFor,
      totalPointsAgainst: r.totalPointsAgainst,
      championships: r.championships,
      secondPlace: r.secondPlace,
      thirdPlace: r.thirdPlace,
      chumpionships: r.chumpionships,
      totalMedals: r.totalMedals,
      seasons: r.seasons,
      playoffAppearances: r.playoffAppearances,
      winPct: r.winPct,
      pointsPerGame: r.pointsPerGame,
      netEarnings: r.netEarnings
    }));
    sections.push(`Hall of Records: ${JSON.stringify(hallRecords)}`);

    // Highlight close races that could change rankings
    const raceMetrics = [
      { key: 'totalPointsFor', label: 'franchise points scored' },
      { key: 'totalWins', label: 'franchise wins' },
      { key: 'totalMedals', label: 'total medals' }
    ];
    raceMetrics.forEach(metric => {
      const sorted = [...hallRecords].sort(
        (a, b) => (b[metric.key] || 0) - (a[metric.key] || 0)
      );
      if (sorted.length >= 2) {
        const diff = (sorted[0][metric.key] || 0) - (sorted[1][metric.key] || 0);
        const leaderValue =
          formatNumber(sorted[0][metric.key], 0) || sorted[0][metric.key];
        const runnerValue =
          formatNumber(sorted[1][metric.key], 0) || sorted[1][metric.key];
        const diffDisplay = formatNumber(diff, 0) || diff;
        sections.push(
          `${metric.label} race: ${sorted[0].name} ${leaderValue} vs ${sorted[1].name} ${runnerValue} (diff ${diffDisplay})`
        );
      }
    });
    sections.push(
      'Analyze the Hall of Records to spotlight leaders and any categories where rankings may change soon.'
    );
  }

  // Roster highlights
  const topScores = Array.isArray(d.topWeeklyScores) ? d.topWeeklyScores : [];
  const bottomScores = Array.isArray(d.bottomWeeklyScores)
    ? d.bottomWeeklyScores
    : [];
  const highlightLines = [];
  topScores.forEach(s => {
    const points = formatNumber(s.points, 1);
    if (points !== null) {
      highlightLines.push(`Top W${s.week} ${s.manager_name} ${points} pts`);
    }
  });
  bottomScores.forEach(s => {
    const points = formatNumber(s.points, 1);
    if (points !== null) {
      highlightLines.push(`Low W${s.week} ${s.manager_name} ${points} pts`);
    }
  });
  if (!isReview && highlightLines.length) {
    sections.push(`Roster highlights: ${highlightLines.join('; ')}`);
  }

  const standoutPlayers = Array.isArray(d.standoutPlayers)
    ? d.standoutPlayers
    : [];
  const standoutLines = standoutPlayers
    .slice(0, isReview ? 3 : 6)
    .map(player => {
      const points = formatNumber(player.points, 1);
      if (points === null) {
        return null;
      }
      const teamTag = player.nfl_team ? ` ${player.nfl_team}` : '';
      const opponentTag = player.opponent ? ` vs ${player.opponent}` : '';
      return `${player.player_name} (${player.position}, ${player.manager_name}${teamTag}) ${points} pts${opponentTag}`;
    })
    .filter(Boolean);
  if (standoutLines.length) {
    sections.push(`Star performers: ${standoutLines.join('; ')}`);
  }

  const strugglingPlayers = Array.isArray(d.strugglingPlayers)
    ? d.strugglingPlayers
    : [];
  const strugglingLines = strugglingPlayers
    .slice(0, isReview ? 3 : 6)
    .map(player => {
      const points = formatNumber(player.points, 1);
      if (points === null) {
        return null;
      }
      return `${player.player_name} (${player.position}, ${player.manager_name}) ${points} pts`;
    })
    .filter(Boolean);
  if (strugglingLines.length) {
    sections.push(`Underperformers: ${strugglingLines.join('; ')}`);
  }

  if (isReview) {
    const movementEntries = Array.isArray(d.standingsMovement)
      ? d.standingsMovement
      : [];
    if (movementEntries.length) {
      const moveLines = movementEntries.map(entry => {
        const direction =
          entry.current_rank != null && entry.previous_rank != null
            ? entry.current_rank < entry.previous_rank
              ? 'up'
              : 'down'
            : 'moved';
        const record = entry.record ? ` (${entry.record})` : '';
        const pf = formatNumber(entry.points_for, 1);
        const pfText = pf ? `, ${pf} PF` : '';
        const previous = entry.previous_rank != null
          ? `was #${entry.previous_rank}`
          : 'previous rank unknown';
        return `${entry.manager_name} ${direction} to #${entry.current_rank}${record}${pfText} (${previous})`;
      });
      sections.push(`Standings movement: ${moveLines.join('; ')}`);
    } else if (hasComparison) {
      sections.push('Standings movement: none this week.');
    }

    const leaderEntries = Array.isArray(d.currentStandingsLeaders)
      ? d.currentStandingsLeaders
      : [];
    if (leaderEntries.length) {
      const leaderLines = leaderEntries.map((entry, idx) => {
        const rankLabel = entry.rank != null ? `#${entry.rank}` : `#${idx + 1}`;
        const record = formatRecordString(entry);
        const pf = formatNumber(entry.points_for, 1);
        const recordText = record ? ` ${record}` : '';
        const pfText = pf ? ` (${pf} PF)` : '';
        return `${rankLabel} ${entry.manager_name}${recordText}${pfText}`;
      });
      sections.push(`Standings leaders now: ${leaderLines.join('; ')}`);
    }

    const topPfEntries = Array.isArray(d.pointsForTopChanges)
      ? d.pointsForTopChanges
      : [];
    if (topPfEntries.length) {
      const pfLines = topPfEntries.map(entry => {
        const currentRankLabel =
          entry.current_rank != null
            ? `now #${entry.current_rank}`
            : 'dropped out of top 3';
        const previousRankLabel =
          entry.previous_rank != null
            ? `was #${entry.previous_rank}`
            : 'previously outside top 3';
        const currentPf = formatNumber(
          entry.current_points_for != null
            ? entry.current_points_for
            : entry.points_for,
          1
        );
        const previousPf = formatNumber(entry.previous_points_for, 1);
        const pfTextParts = [];
        if (currentPf) {
          pfTextParts.push(`${currentPf} PF`);
        }
        if (previousPf && previousPf !== currentPf) {
          pfTextParts.push(`prev ${previousPf} PF`);
        }
        const pfText = pfTextParts.length ? ` (${pfTextParts.join(', ')})` : '';
        return `${entry.manager_name} ${currentRankLabel}, ${previousRankLabel}${pfText}`;
      });
      sections.push(`Top PF shifts: ${pfLines.join('; ')}`);
    } else if (hasComparison) {
      sections.push('Top PF shifts: none.');
    }

    const currentTopPf = Array.isArray(d.currentTopPointsFor)
      ? d.currentTopPointsFor
      : [];
    if (currentTopPf.length) {
      const currentPfLines = currentTopPf.map((entry, idx) => {
        const rankLabel = entry.pfRank != null ? `#${entry.pfRank}` : `#${idx + 1}`;
        const record = formatRecordString(entry);
        const pf = formatNumber(entry.points_for, 1);
        const recordText = record ? ` ${record}` : '';
        const pfText = pf ? ` (${pf} PF)` : '';
        return `${rankLabel} ${entry.manager_name}${recordText}${pfText}`;
      });
      sections.push(`Current top PF board: ${currentPfLines.join('; ')}`);
    }

    const lowestChange = d.lowestPointsForChange || null;
    const currentLowest = d.currentLowestPointsFor || null;
    if (
      lowestChange &&
      lowestChange.current &&
      lowestChange.previous &&
      lowestChange.current.manager_name &&
      lowestChange.previous.manager_name
    ) {
      const newPfValue = formatNumber(lowestChange.current.points_for, 1);
      const prevPfValue = formatNumber(lowestChange.previous.points_for, 1);
      const newPf = newPfValue || '—';
      const prevPf = prevPfValue || '—';
      const lowestSwapLine =
        `Lowest PF swap: ${lowestChange.current.manager_name} now last at ${newPf} PF, ` +
        `replacing ${lowestChange.previous.manager_name} (${prevPf} PF).`;
      sections.push(lowestSwapLine);
    } else if (currentLowest && currentLowest.manager_name) {
      const lowestPfValue = formatNumber(currentLowest.points_for, 1);
      const lowestPf = lowestPfValue || '—';
      sections.push(
        `Lowest PF holder: ${currentLowest.manager_name} steady at ${lowestPf} PF.`
      );
    } else if (hasComparison) {
      sections.push('Lowest PF holder: unchanged.');
    }
  }

  const closestMatchups = Array.isArray(d.closestMatchups)
    ? d.closestMatchups
    : [];
  const closeLines = closestMatchups
    .slice(0, 3)
    .map(matchup => describeMatchup(matchup, { emphasiseMargin: true }))
    .filter(Boolean);
  if (!isReview && closeLines.length) {
    sections.push(`Nail-biters: ${closeLines.join('; ')}`);
  }

  const blowoutMatchups = Array.isArray(d.biggestBlowouts)
    ? d.biggestBlowouts
    : [];
  const blowoutLines = blowoutMatchups
    .slice(0, 3)
    .map(matchup => describeMatchup(matchup, { emphasiseMargin: true }))
    .filter(Boolean);
  if (!isReview && blowoutLines.length) {
    sections.push(`Statement wins: ${blowoutLines.join('; ')}`);
  }

  const highScoringMatchups = Array.isArray(d.highestScoringMatchups)
    ? d.highestScoringMatchups
    : [];
  const highScoreLines = highScoringMatchups
    .slice(0, 3)
    .map(matchup => describeMatchup(matchup, { emphasiseTotal: true }))
    .filter(Boolean);
  if (!isReview && highScoreLines.length) {
    sections.push(`Scoreboard bonanzas: ${highScoreLines.join('; ')}`);
  }

  // Head-to-head matchups
  const matchups = Array.isArray(d.matchups)
    ? d.matchups
    : Array.isArray(d.playoffMatchups)
    ? d.playoffMatchups
    : [];
  const matchupLines = [];
  matchups.forEach(m => {
    const weekLabel = m.week ? `W${m.week} ` : '';
    if (m.home && m.away) {
      if (d.type === 'preview') {
        const homeRec = m.home.record ? ` (${m.home.record})` : '';
        const awayRec = m.away.record ? ` (${m.away.record})` : '';
        const homeRank =
          m.home.rank != null ? `#${m.home.rank} ` : '';
        const awayRank =
          m.away.rank != null ? `#${m.away.rank} ` : '';
        const homePf = formatNumber(m.home.points_for, 1);
        const awayPf = formatNumber(m.away.points_for, 1);
        const pfSnippet =
          homePf || awayPf
            ? ` [PF ${homePf || '—'} vs ${awayPf || '—'}]`
            : '';
        matchupLines.push(
          `${weekLabel}${homeRank}${m.home.manager_name}${homeRec} vs ${awayRank}${m.away.manager_name}${awayRec}${pfSnippet}`
        );
      } else {
        matchupLines.push(
          describeMatchup({
            week: m.week,
            home: m.home,
            away: m.away
          })
        );
      }
    } else if (m.team1 && m.team2) {
      matchupLines.push(
        describeMatchup({
          week: m.week,
          home: m.team1,
          away: m.team2
        })
      );
    }
  });
  const filteredMatchupLines = matchupLines.filter(Boolean);
  if (!isReview && filteredMatchupLines.length) {
    sections.push(`Head-to-head matchups: ${filteredMatchupLines.join('; ')}`);
  }

  if (isPreview) {
    const potentialShakeups = matchups
      .map(m => {
        if (!m || !m.home || !m.away) {
          return null;
        }

        const homeRank = toNumber(m.home.rank);
        const awayRank = toNumber(m.away.rank);
        const homeWins = toNumber(m.home.wins);
        const awayWins = toNumber(m.away.wins);
        const homeLosses = toNumber(m.home.losses);
        const awayLosses = toNumber(m.away.losses);
        const storedWinGap = toNumber(m.win_gap);
        const winGap = storedWinGap !== null
          ? storedWinGap
          : homeWins !== null && awayWins !== null
          ? Math.abs(homeWins - awayWins)
          : null;
        const nearTop =
          (homeRank !== null && homeRank <= 4) ||
          (awayRank !== null && awayRank <= 4);
        const bubbleBattle =
          homeRank !== null && awayRank !== null &&
          homeRank <= 6 &&
          awayRank <= 6;
        const qualifies =
          (winGap !== null && winGap <= 1) ||
          (nearTop && winGap !== null && winGap <= 2) ||
          (winGap === null && (nearTop || bubbleBattle));

        if (!qualifies) {
          return null;
        }

        const homePf = toNumber(m.home.points_for);
        const awayPf = toNumber(m.away.points_for);
        const storedPfDiff = toNumber(m.pf_diff);
        const pfDiff = storedPfDiff !== null
          ? storedPfDiff
          : homePf !== null && awayPf !== null
          ? Number((homePf - awayPf).toFixed(1))
          : null;
        const favorite =
          typeof m.favorite === 'string' && m.favorite
            ? m.favorite
            : pfDiff !== null && pfDiff !== 0
            ? pfDiff > 0
              ? m.home.manager_name
              : m.away.manager_name
            : null;

        const homeLabelParts = [];
        if (homeRank !== null) {
          homeLabelParts.push(`#${homeRank}`);
        }
        homeLabelParts.push(m.home.manager_name);
        if (homeWins !== null && homeLosses !== null) {
          homeLabelParts.push(`(${homeWins}-${homeLosses})`);
        }
        const homeLabel = homeLabelParts.join(' ');

        const awayLabelParts = [];
        if (awayRank !== null) {
          awayLabelParts.push(`#${awayRank}`);
        }
        awayLabelParts.push(m.away.manager_name);
        if (awayWins !== null && awayLosses !== null) {
          awayLabelParts.push(`(${awayWins}-${awayLosses})`);
        }
        const awayLabel = awayLabelParts.join(' ');

        const detailParts = [];
        if (winGap !== null) {
          detailParts.push(`win gap ${formatNumber(winGap, 0)}`);
        }
        if (pfDiff !== null && pfDiff !== 0) {
          const edgeFor = pfDiff > 0 ? m.home.manager_name : m.away.manager_name;
          detailParts.push(
            `PF edge ${formatNumber(Math.abs(pfDiff), 1)} for ${edgeFor}`
          );
        }
        if (favorite) {
          detailParts.push(`favorite ${favorite}`);
        }
        if (nearTop) {
          detailParts.push('top-tier stakes');
        } else if (bubbleBattle) {
          detailParts.push('playoff bubble duel');
        }

        const detailText = detailParts.length
          ? ` (${detailParts.join('; ')})`
          : '';

        return `${homeLabel} vs ${awayLabel}${detailText}`;
      })
      .filter(Boolean);

    if (potentialShakeups.length) {
      sections.push(`Potential shake-ups: ${potentialShakeups.join('; ')}`);
    }
  }

  if (isPreview) {
    const winGapLines = matchups
      .map(m => {
        if (!m.home || !m.away) {
          return null;
        }
        const homeWins = toNumber(m.home.wins);
        const awayWins = toNumber(m.away.wins);
        if (homeWins === null || awayWins === null) {
          return null;
        }
        const gap = formatNumber(Math.abs(homeWins - awayWins), 0);
        return `${m.home.manager_name} vs ${m.away.manager_name}: win gap ${gap}`;
      })
      .filter(Boolean);
    if (winGapLines.length) {
      sections.push(`Win-gap context: ${winGapLines.join('; ')}`);
    }
  }

  const variants = {
    season:
      'Write a concise standings-focused recap for the completed week. Spotlight shifts in overall rank and movements within the points-for leaderboard, and plainly note when nothing changed.',
    records:
      'Deliver a history-focused report that quantifies record chases, medal leaders, and long-term manager trends. Use specific totals and gaps to show what milestones are within reach.',
    preview:
      'Write a concise preview of the upcoming slate that highlights matchups most likely to shake up the standings and who holds the statistical edge.'
  };
  const intro =
    variants[d.type] ||
    'Deliver an energetic fantasy football update that quantifies manager performance, matchup drama, and record-book stakes.';

  const titleBlock = title ? `${title}\n\n` : '';
  const body = sections.join('\n');

  const guidance = [];

  if (isReview) {
    guidance.push(
      'Focus solely on standings movement, shifts among the top three points-for totals, and any change at the bottom of the points-for table. If nothing changed in a required category, say so explicitly.'
    );
  } else if (isPreview) {
    guidance.push(
      'Focus on potential standings shake-ups from the upcoming matchups, explaining who has the edge and what a win would do to the table.'
    );
    guidance.push('Close with a forward-looking note about the most pivotal swing to watch.');
  } else {
    guidance.push(
      'Deliver the requested fantasy football insights with clear numerical evidence.'
    );
  }

  guidance.push(
    'Weave in exact numbers—scores, records, points-for totals, margins, or projections—to support every storyline.'
  );
  guidance.push(
    'You may mention massive individual player over- or under-performances when they materially impact those narratives.'
  );
  guidance.push('Write the response as two or three short paragraphs, not a list.');
  guidance.push('Do not use numbered lists.');

  const guidanceText = guidance.map(line => `- ${line}`).join('\n');

  return `${titleBlock}${intro}\n\n${body}\n\n${guidanceText}`;
}

/**
 * Generate a short summary for provided data using an LLM.
 * @param {any} data - Data to summarize. Can be string or object.
 * @returns {Promise<string>} Summary text
 */
async function generateSummary(data) {
  try {
    const prompt = buildSummaryPrompt(data && data.data ? data.data : data);
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }]
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating summary:', error.message);
    throw new Error('Failed to generate summary');
  }
}

module.exports = { generateSummary, buildSummaryPrompt };

