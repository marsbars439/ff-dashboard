const axios = require('axios');

class ESPNService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
      timeout: 10000
    });
    this.cache = new Map();
    this.cacheTtl = 2 * 60 * 1000; // 2 minutes
  }

  /**
   * Fetch current week's scoreboard
   * @returns {Promise<Object>} Scoreboard data with games
   */
  async getScoreboard() {
    const cacheKey = 'scoreboard';
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && now - cached.timestamp < this.cacheTtl) {
      return cached.data;
    }

    try {
      const response = await this.client.get('/scoreboard');
      const data = response.data;

      this.cache.set(cacheKey, { data, timestamp: now });
      return data;
    } catch (error) {
      console.error('❌ Error fetching ESPN scoreboard:', error.message);
      return null;
    }
  }

  /**
   * Get games for a specific week and season
   * @param {number} season - Season year
   * @param {number} week - Week number
   * @param {string} seasonType - 'regular' or 'postseason'
   * @returns {Promise<Object>} Scoreboard data
   */
  async getWeekGames(season, week, seasonType = 'regular') {
    const typeCode = seasonType === 'postseason' ? 3 : 2;
    const cacheKey = `week-${season}-${seasonType}-${week}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && now - cached.timestamp < this.cacheTtl) {
      return cached.data;
    }

    try {
      const response = await this.client.get('/scoreboard', {
        params: {
          seasontype: typeCode,
          week
        }
      });
      const data = response.data;

      this.cache.set(cacheKey, { data, timestamp: now });
      return data;
    } catch (error) {
      console.error(`❌ Error fetching ESPN week ${week} games:`, error.message);
      return null;
    }
  }

  /**
   * Get detailed game summary including player stats
   * @param {string} gameId - ESPN game ID
   * @returns {Promise<Object>} Game summary with player stats
   */
  async getGameSummary(gameId) {
    const cacheKey = `summary-${gameId}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && now - cached.timestamp < this.cacheTtl) {
      return cached.data;
    }

    try {
      const response = await this.client.get('/summary', {
        params: { event: gameId }
      });
      const data = response.data;

      this.cache.set(cacheKey, { data, timestamp: now });
      return data;
    } catch (error) {
      console.error(`❌ Error fetching ESPN game summary ${gameId}:`, error.message);
      return null;
    }
  }

  /**
   * Parse ESPN game data into a normalized format
   * @param {Object} scoreboard - ESPN scoreboard response
   * @returns {Map<string, Object>} Map of team abbreviation to game info
   */
  parseGames(scoreboard) {
    const gamesByTeam = new Map();

    if (!scoreboard || !scoreboard.events) {
      return gamesByTeam;
    }

    for (const event of scoreboard.events) {
      try {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const status = competition.status;
        const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        const gameInfo = {
          gameId: event.id,
          date: event.date, // ISO 8601 timestamp
          status: status?.type?.name, // 'STATUS_SCHEDULED', 'STATUS_IN_PROGRESS', 'STATUS_FINAL'
          statusDetail: status?.type?.detail,
          period: status?.period || null,
          clock: status?.displayClock || null,
          homeTeam: homeTeam.team?.abbreviation,
          awayTeam: awayTeam.team?.abbreviation,
          homeScore: parseInt(homeTeam.score) || 0,
          awayScore: parseInt(awayTeam.score) || 0,
          venue: competition.venue?.fullName || null
        };

        // Add game info for both teams
        if (gameInfo.homeTeam) {
          gamesByTeam.set(gameInfo.homeTeam, {
            ...gameInfo,
            opponent: gameInfo.awayTeam,
            isHome: true
          });
        }

        if (gameInfo.awayTeam) {
          gamesByTeam.set(gameInfo.awayTeam, {
            ...gameInfo,
            opponent: gameInfo.homeTeam,
            isHome: false
          });
        }
      } catch (error) {
        console.error('Error parsing ESPN game:', error.message);
        continue;
      }
    }

    return gamesByTeam;
  }

  /**
   * Extract player stats from ESPN box score
   * @param {Object} boxscore - ESPN box score data
   * @returns {Object} Object with playerStatsById (Map) and playerStatsByName (Map)
   */
  parsePlayerStats(boxscore) {
    const playerStatsById = new Map();
    const playerStatsByName = new Map();

    if (!boxscore || !boxscore.players) {
      return { playerStatsById, playerStatsByName };
    }

    for (const teamStats of boxscore.players) {
      if (!teamStats.statistics) continue;

      for (const statCategory of teamStats.statistics) {
        const categoryName = statCategory.name; // 'passing', 'rushing', 'receiving'
        const labels = statCategory.labels || [];
        const keys = statCategory.keys || [];

        if (!statCategory.athletes) continue;

        for (const athleteEntry of statCategory.athletes) {
          const athlete = athleteEntry.athlete;
          const stats = athleteEntry.stats || [];

          if (!athlete || !athlete.id) continue;

          const espnId = parseInt(athlete.id);
          const playerName = athlete.displayName || athlete.fullName;
          const normalizedName = playerName ? playerName.toLowerCase().replace(/[^a-z]/g, '') : null;

          if (!playerStatsById.has(espnId)) {
            const playerData = {
              espnId,
              name: playerName,
              position: athlete.position?.abbreviation || null,
              jersey: athlete.jersey || null,
              headshot: athlete.headshot?.href || null,
              stats: {}
            };
            playerStatsById.set(espnId, playerData);

            // Also index by normalized name for fallback matching
            if (normalizedName) {
              playerStatsByName.set(normalizedName, playerData);
            }
          }

          const playerData = playerStatsById.get(espnId);

          // Build stats object for this category
          const categoryStats = {};
          stats.forEach((value, index) => {
            if (keys[index] && value !== undefined) {
              categoryStats[keys[index]] = value;
            }
          });

          playerData.stats[categoryName] = categoryStats;

          // Build stat components (we'll combine them later)
          if (categoryName === 'passing' && stats.length > 0) {
            playerData.passing = {
              comp: stats[0] || '0/0',
              yds: parseInt(stats[1]) || 0,
              td: parseInt(stats[3]) || 0,
              int: parseInt(stats[4]) || 0
            };
          } else if (categoryName === 'rushing' && stats.length > 0) {
            playerData.rushing = {
              car: parseInt(stats[0]) || 0,
              yds: parseInt(stats[1]) || 0,
              td: parseInt(stats[3]) || 0
            };
          } else if (categoryName === 'receiving' && stats.length > 0) {
            playerData.receiving = {
              rec: parseInt(stats[0]) || 0,
              yds: parseInt(stats[1]) || 0,
              td: parseInt(stats[3]) || 0
            };
          } else if (categoryName === 'fumbles' && stats.length > 0) {
            playerData.fumbles = {
              fum: parseInt(stats[0]) || 0,
              lost: parseInt(stats[1]) || 0
            };
          } else if (categoryName === 'kicking' && stats.length > 0) {
            playerData.kicking = {
              fgm: stats[0] || '0/0',
              xpm: stats[3] || '0/0',
              pts: parseInt(stats[4]) || 0
            };
          } else if (categoryName === 'defensive' && stats.length > 0) {
            playerData.defensive = {
              tackles: parseInt(stats[0]) || 0,
              sacks: parseFloat(stats[2]) || 0
            };
          }
        }
      }
    }

    // Build comprehensive stat lines for each player
    for (const playerData of playerStatsById.values()) {
      playerData.statLine = this.buildComprehensiveStatLine(playerData);
    }

    return { playerStatsById, playerStatsByName };
  }

  /**
   * Build a comprehensive single-line stat summary
   * @param {Object} playerData - Player data with stats
   * @returns {string} Comprehensive stat line
   */
  buildComprehensiveStatLine(playerData) {
    const parts = [];
    const { passing, rushing, receiving, fumbles, kicking, defensive } = playerData;

    // Passing stats
    if (passing && (passing.yds > 0 || passing.td > 0 || passing.int > 0)) {
      let passStr = `${passing.comp}, ${passing.yds} PASS YDS`;
      if (passing.td > 0) passStr += `, ${passing.td} PASS TD`;
      if (passing.int > 0) passStr += `, ${passing.int} INT`;
      parts.push(passStr);
    }

    // Rushing stats
    if (rushing && (rushing.yds > 0 || rushing.td > 0)) {
      let rushStr = `${rushing.car} CAR, ${rushing.yds} RUSH YDS`;
      if (rushing.td > 0) rushStr += `, ${rushing.td} RUSH TD`;
      parts.push(rushStr);
    }

    // Receiving stats
    if (receiving && (receiving.yds > 0 || receiving.td > 0)) {
      let recStr = `${receiving.rec} REC, ${receiving.yds} REC YDS`;
      if (receiving.td > 0) recStr += `, ${receiving.td} REC TD`;
      parts.push(recStr);
    }

    // Fumbles (always show if lost fumbles exist)
    if (fumbles && fumbles.lost > 0) {
      parts.push(`${fumbles.lost} FL`);
    }

    // Kicking stats
    if (kicking && kicking.pts > 0) {
      parts.push(`${kicking.fgm} FG, ${kicking.xpm} XP (${kicking.pts} PTS)`);
    }

    // Defensive stats
    if (defensive && (defensive.tackles > 0 || defensive.sacks > 0)) {
      let defStr = `${defensive.tackles} TOT`;
      if (defensive.sacks > 0) defStr += `, ${defensive.sacks} SACKS`;
      parts.push(defStr);
    }

    return parts.join(' • ') || null;
  }
}

module.exports = new ESPNService();
