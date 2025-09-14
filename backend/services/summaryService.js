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
        managerRecords.push(`${r.manager_name}: ${(r.winPct * 100).toFixed(1)}% win pct`);
      }
    }
  });
  if (managerRecords.length) {
    sections.push(`Managers and records: ${managerRecords.join('; ')}`);
  } else if (managers.size) {
    sections.push(`Managers: ${Array.from(managers).join(', ')}`);
  }

  // Medal counts
  if (Array.isArray(d.medalRankings)) {
    const medalLines = d.medalRankings.map(m => `${m.manager_name}: ${m.totalMedals}`);
    sections.push(`Medal counts: ${medalLines.join('; ')}`);
  }

  // Hall of Records data for historical context
  if (records.length) {
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
    raceMetrics.forEach(m => {
      const sorted = [...hallRecords].sort((a, b) => b[m.key] - a[m.key]);
      if (sorted.length >= 2) {
        const diff = sorted[0][m.key] - sorted[1][m.key];
        sections.push(
          `${m.label} race: ${sorted[0].name} ${sorted[0][m.key]} vs ${sorted[1].name} ${sorted[1][m.key]} (diff ${diff})`
        );
      }
    });
    sections.push(
      'Analyze the Hall of Records to spotlight leaders and any categories where rankings may change soon.'
    );
  }

  // Roster highlights
  const topScores = Array.isArray(d.topWeeklyScores) ? d.topWeeklyScores : [];
  const bottomScores = Array.isArray(d.bottomWeeklyScores) ? d.bottomWeeklyScores : [];
  const highlightLines = [];
  topScores.forEach(s => {
    highlightLines.push(`Top W${s.week} ${s.manager_name} ${s.points}pts`);
  });
  bottomScores.forEach(s => {
    highlightLines.push(`Low W${s.week} ${s.manager_name} ${s.points}pts`);
  });
  if (highlightLines.length) {
    sections.push(`Roster highlights: ${highlightLines.join('; ')}`);
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
        matchupLines.push(
          `${weekLabel}${m.home.manager_name}${homeRec} vs ${m.away.manager_name}${awayRec}`
        );
      } else {
        matchupLines.push(
          `${weekLabel}${m.home.manager_name} vs ${m.away.manager_name} (${m.home.points}-${m.away.points})`
        );
      }
    } else if (m.team1 && m.team2) {
      matchupLines.push(
        `${weekLabel}${m.team1.manager_name} vs ${m.team2.manager_name} (${m.team1.points}-${m.team2.points})`
      );
    }
  });
  if (matchupLines.length) {
    sections.push(`Head-to-head matchups: ${matchupLines.join('; ')}`);
  }

  const variants = {
    season:
      'Surface key insights about this season including championship results, standout performances, and notable matchups. Use Hall of Records data for historical perspective.',
    records:
      'Surface insights about historical records, medal leaders, long-term manager trends, and note categories where rankings are close.',
    preview:
      'Preview upcoming matchups and discuss potential outcomes and standings implications. Reference Hall of Records races that could shift.'
  };
  const intro =
    variants[d.type] ||
    'Surface insights about manager performance, medals, win/loss records, roster highlights, matchups, and Hall of Records trends. Highlight potential changes in all-time rankings.';

  return `${intro}\n\n${sections.join('\n')}\n\nFormat the response as concise bullet points.`;
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

