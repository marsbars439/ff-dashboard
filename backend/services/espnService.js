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
   * @returns {Map<number, Object>} Map of ESPN player ID to stats
   */
  parsePlayerStats(boxscore) {
    const playerStatsMap = new Map();

    if (!boxscore || !boxscore.players) {
      return playerStatsMap;
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

          if (!playerStatsMap.has(espnId)) {
            playerStatsMap.set(espnId, {
              espnId,
              name: athlete.displayName || athlete.fullName,
              position: athlete.position?.abbreviation || null,
              jersey: athlete.jersey || null,
              headshot: athlete.headshot?.href || null,
              stats: {}
            });
          }

          const playerData = playerStatsMap.get(espnId);

          // Build stats object for this category
          const categoryStats = {};
          stats.forEach((value, index) => {
            if (keys[index] && value !== undefined) {
              categoryStats[keys[index]] = value;
            }
          });

          playerData.stats[categoryName] = categoryStats;

          // Build a human-readable stat line
          if (categoryName === 'passing' && stats.length > 0) {
            playerData.passingLine = stats[0]; // e.g., "25/34, 281 YDS, 1 TD"
          } else if (categoryName === 'rushing' && stats.length > 0) {
            playerData.rushingLine = `${stats[0]} CAR, ${stats[1]} YDS${stats[3] ? ', ' + stats[3] + ' TD' : ''}`;
          } else if (categoryName === 'receiving' && stats.length > 0) {
            playerData.receivingLine = `${stats[0]} REC, ${stats[1]} YDS${stats[3] ? ', ' + stats[3] + ' TD' : ''}`;
          } else if (categoryName === 'kicking' && stats.length > 0) {
            // FG, PCT, LONG, XP, PTS format
            playerData.kickingLine = `${stats[0]} FG, ${stats[3]} XP, ${stats[4]} PTS`;
          } else if (categoryName === 'defensive' && stats.length > 0) {
            // TOT, SOLO, SACKS, TFL, PD, QB HTS, TD format
            playerData.defensiveLine = `${stats[0]} TOT, ${stats[2]} SACKS`;
          }
        }
      }
    }

    return playerStatsMap;
  }
}

module.exports = new ESPNService();
