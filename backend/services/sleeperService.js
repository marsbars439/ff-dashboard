const axios = require('axios');
const logger = require('../utils/logger');
const gameStatusService = require('./gameStatusService');
const espnService = require('./espnService');

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
const GAME_COMPLETION_BUFFER_MS = 4.5 * 60 * 60 * 1000;

const parseSleeperPoints = value => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

class SleeperService {
  constructor() {
    this.client = axios.create({
      baseURL: SLEEPER_BASE_URL,
      timeout: 10000,
    });
    this.playersCache = {
      data: null,
      timestamp: 0
    };
    this.playersCacheTtl = 1000 * 60 * 60; // 1 hour cache
    this.scheduleCache = new Map();
    this.statsCache = new Map();
    this.gameMetaCacheTtl = 1000 * 60 * 2; // 2 minute cache for live game metadata
    this.nflStateCache = {
      data: null,
      timestamp: 0
    };
    this.nflStateCacheTtl = 1000 * 60 * 5; // 5 minute cache for NFL state
  }

  normalizeTimestamp(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return null;
      }
      return value < 1e12 ? value * 1000 : value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) {
        return numeric < 1e12 ? numeric * 1000 : numeric;
      }

      const parsed = Date.parse(trimmed);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  normalizeGameStatus(status) {
    if (status === null || status === undefined) {
      return null;
    }

    const normalized = status.toString().toLowerCase();

    if (normalized.includes('bye')) {
      return 'bye';
    }

    if (
      normalized.includes('final') ||
      normalized.includes('post') ||
      normalized.includes('complete') ||
      normalized.includes('finished') ||
      normalized === 'closed'
    ) {
      return 'final';
    }

    if (
      normalized.includes('progress') ||
      normalized.includes('inprogress') ||
      normalized.includes('live') ||
      normalized.includes('playing')
    ) {
      return 'in_progress';
    }

    if (
      normalized.includes('pre') ||
      normalized.includes('sched') ||
      normalized.includes('upcoming') ||
      normalized.includes('not_started')
    ) {
      return 'pre';
    }

    return normalized;
  }

  async getPlayersMap(forceRefresh = false) {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.playersCache.data &&
      now - this.playersCache.timestamp < this.playersCacheTtl
    ) {
      return this.playersCache.data;
    }

    try {
      const players = await this.client.get('/players/nfl').then(res => res.data);
      this.playersCache = {
        data: players,
        timestamp: now
      };
      return players;
    } catch (error) {
      logger.error('Error fetching Sleeper players', { error: error.message });
      throw error;
    }
  }

  async getWeeklyPlayerStats(season, week, seasonType = 'regular') {
    const normalizedSeason = Number.parseInt(season, 10);
    const normalizedWeek = Number.parseInt(week, 10);

    if (!Number.isFinite(normalizedSeason) || !Number.isFinite(normalizedWeek)) {
      return {};
    }

    const cacheKey = `${normalizedSeason}-${seasonType}-${normalizedWeek}`;
    const now = Date.now();
    const cached = this.statsCache.get(cacheKey);
    if (cached && now - cached.timestamp < this.gameMetaCacheTtl) {
      return cached.data;
    }

    try {
      const response = await this.client.get(
        `/stats/nfl/${seasonType}/${normalizedSeason}/${normalizedWeek}`
      );
      const payload = response.data;

      let entries = [];
      if (Array.isArray(payload)) {
        entries = payload;
      } else if (payload && typeof payload === 'object') {
        entries = Object.values(payload);
      }

      const statsMap = {};
      entries.forEach(entry => {
        if (!entry) {
          return;
        }

        const playerId = entry.player_id || entry.playerId;
        if (!playerId) {
          return;
        }

        statsMap[playerId] = entry;
      });

      this.statsCache.set(cacheKey, { data: statsMap, timestamp: now });
      return statsMap;
    } catch (error) {
      console.error(
        `❌ Error fetching weekly player stats (${seasonType} ${normalizedSeason} wk${normalizedWeek}):`,
        error.message
      );
      this.statsCache.set(cacheKey, { data: {}, timestamp: now });
      return {};
    }
  }

  async getWeeklySchedule(season, week, seasonType = 'regular') {
    const normalizedSeason = Number.parseInt(season, 10);
    const normalizedWeek = Number.parseInt(week, 10);

    if (!Number.isFinite(normalizedSeason) || !Number.isFinite(normalizedWeek)) {
      return {};
    }

    const cacheKey = `${normalizedSeason}-${seasonType}-${normalizedWeek}`;
    const now = Date.now();
    const cached = this.scheduleCache.get(cacheKey);
    if (cached && now - cached.timestamp < this.gameMetaCacheTtl) {
      return cached.data;
    }

    const toTeamKey = teamCode => {
      if (teamCode === null || teamCode === undefined || teamCode === '') {
        return null;
      }
      return teamCode.toString().toUpperCase();
    };

    try {
      const response = await this.client.get(
        `/schedule/nfl/${seasonType}/${normalizedSeason}`
      );
      const payload = response.data;

      const games = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : [];

      const scheduleByTeam = {};
      games
        .filter(game => Number.parseInt(game.week, 10) === normalizedWeek)
        .forEach(game => {
          const homeTeam =
            toTeamKey(game.home_team) ||
            toTeamKey(game.home) ||
            toTeamKey(game.team_home) ||
            toTeamKey(game.team1);
          const awayTeam =
            toTeamKey(game.away_team) ||
            toTeamKey(game.away) ||
            toTeamKey(game.team_away) ||
            toTeamKey(game.team2);

          const startTime = this.normalizeTimestamp(
            game.start_time ??
              game.start_time_ms ??
              game.start_time_epoch ??
              game.start_time_iso ??
              game.start ??
              game.kickoff
          );

          const rawStatus = game.game_status || game.status || game.state || null;
          const normalizedStatus = this.normalizeGameStatus(rawStatus);
          const completed = game.completed === true || normalizedStatus === 'final';

          const baseMeta = {
            start_time: startTime,
            status: completed ? 'final' : normalizedStatus,
            raw_status: rawStatus || null,
            game_id: game.game_id || null,
            season: game.season || normalizedSeason,
            week: game.week || normalizedWeek
          };

          if (homeTeam) {
            scheduleByTeam[homeTeam] = {
              ...baseMeta,
              opponent: awayTeam || null,
              home_away: 'home'
            };
          }

          if (awayTeam) {
            scheduleByTeam[awayTeam] = {
              ...baseMeta,
              opponent: homeTeam || null,
              home_away: 'away'
            };
          }
        });

      this.scheduleCache.set(cacheKey, { data: scheduleByTeam, timestamp: now });
      return scheduleByTeam;
    } catch (error) {
      console.error(
        `❌ Error fetching weekly schedule (${seasonType} ${normalizedSeason} wk${normalizedWeek}):`,
        error.message
      );
      this.scheduleCache.set(cacheKey, { data: {}, timestamp: now });
      return {};
    }
  }

  /**
   * Fetch and process all data for a specific league/year
   * @param {string} leagueId - Sleeper league ID
   * @param {number} year - Year for this league
   * @param {Array} managers - Array of manager records from database
   * @param {Array} seasonalIds - Array of {name_id, sleeper_user_id} for the season
   * @returns {Object} Processed data ready for database insertion
   */
  async fetchLeagueData(leagueId, year, managers, seasonalIds = []) {
    try {
      console.log(`📊 Fetching data for league ${leagueId} (Year: ${year})`);

      // Step 1: Get league info (for settings and team names)
      const leagueInfo = await this.getLeagueInfo(leagueId);
      
      // Step 2: Get all rosters (wins, losses, points)
      const rosters = await this.getRosters(leagueId);
      
      // Step 3: Get users in league (to map roster_id to username)
      const users = await this.getUsers(leagueId);
      
      // Step 4: Get playoff bracket results
      const playoffResults = await this.getPlayoffResults(leagueId);
      
      // Step 5: Calculate high games for each team
      const highGames = await this.calculateHighGames(leagueId, leagueInfo.settings);
      
      // Step 6: Process and combine all data
      const processedData = this.processLeagueData(
        year,
        leagueInfo,
        rosters,
        users,
        managers,
        playoffResults,
        highGames,
        seasonalIds
      );

      const leagueStatus = leagueInfo?.status || null;

      return {
        success: true,
        data: processedData,
        leagueStatus,
        summary: {
          year,
          teamsFound: processedData.length,
          unmatchedUsers: processedData.filter(t => !t.name_id).length
        }
      };

    } catch (error) {
      console.error('❌ Error fetching league data:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get league information
   */
  async getLeagueInfo(leagueId) {
    const response = await this.client.get(`/league/${leagueId}`);
    return response.data;
  }

  /**
   * Get all rosters for a league
   */
  async getRosters(leagueId) {
    const response = await this.client.get(`/league/${leagueId}/rosters`);
    return response.data;
  }

  /**
   * Get all users in a league
   */
  async getUsers(leagueId) {
    const response = await this.client.get(`/league/${leagueId}/users`);
    return response.data;
  }

  /**
   * Get playoff bracket results
   */
  async getPlayoffResults(leagueId) {
    try {
      const response = await this.client.get(`/league/${leagueId}/winners_bracket`);
      return this.parsePlayoffBracket(response.data);
    } catch (error) {
      console.warn('⚠️ Could not fetch playoff results:', error.message);
      return {};
    }
  }

  /**
   * Parse playoff bracket to determine final standings
   * Returns an object mapping roster_id to final playoff finish (1-6)
   */
  parsePlayoffBracket(bracket) {
    const results = {};

    if (!bracket || !Array.isArray(bracket)) {
      return results;
    }

    // Find championship game (highest round)
    const championshipRound = Math.max(...bracket.map(game => game.r));
    const championshipGame = bracket.find(game =>
      game.r === championshipRound && game.t1 && game.t2
    );

    if (championshipGame) {
      // Champion is the winner
      const championId = championshipGame.w;
      const runnerUpId = championshipGame.w === championshipGame.t1
        ? championshipGame.t2
        : championshipGame.t1;

      results[championId] = 1;  // 1st place
      results[runnerUpId] = 2;  // 2nd place

      // Find 3rd place game if it exists. Sleeper's bracket format
      // doesn't guarantee the third place matchup's `p` value will be
      // exactly one greater than the championship's `p`. Instead,
      // search for any other game in the final round that isn't the
      // championship game.
      const thirdPlaceGame = bracket.find(game =>
        game.r === championshipRound &&
        game.p !== championshipGame.p &&
        game.t1 && game.t2
      );

      if (thirdPlaceGame && thirdPlaceGame.w) {
        results[thirdPlaceGame.w] = 3;  // 3rd place
        const fourthPlace = thirdPlaceGame.w === thirdPlaceGame.t1
          ? thirdPlaceGame.t2
          : thirdPlaceGame.t1;
        if (fourthPlace) {
          results[fourthPlace] = 4;  // 4th place
        }
      }

    }

    return results;
  }

  /**
   * Calculate highest scoring week for each team
   */
    async calculateHighGames(leagueId, settings) {
      const highGames = {};
      const regularSeasonWeeks = settings.playoff_week_start - 1;

    console.log(`📈 Calculating high games for ${regularSeasonWeeks} regular season weeks...`);

    try {
      // Fetch all regular season matchups
      const allMatchups = await Promise.all(
        Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1)
          .map(week => this.client.get(`/league/${leagueId}/matchups/${week}`)
            .then(res => res.data)
            .catch(() => [])
          )
      );

      // Process each week's matchups
      allMatchups.forEach((weekMatchups) => {
        if (!weekMatchups || !Array.isArray(weekMatchups)) return;

        weekMatchups.forEach(matchup => {
          const rosterId = matchup.roster_id;
          const weekPoints = matchup.points || 0;

          if (!highGames[rosterId] || weekPoints > highGames[rosterId]) {
            highGames[rosterId] = weekPoints;
          }
        });
      });

      return highGames;
    } catch (error) {
      console.warn('⚠️ Could not calculate high games:', error.message);
      return {};
      }
    }

    /**
     * Fetch all regular season matchups with team names and scores
     */
  async getSeasonMatchups(leagueId, managers = []) {
      try {
        // Get league info to determine number of regular season weeks
        const leagueInfo = await this.getLeagueInfo(leagueId);
        const rosters = await this.getRosters(leagueId);
        const users = await this.getUsers(leagueId);

        const regularSeasonWeeks = leagueInfo.settings.playoff_week_start - 1;

        // Map sleeper user_id to manager full name
        const userIdToName = {};
        managers.forEach(m => {
          if (m.sleeper_user_id) {
            userIdToName[m.sleeper_user_id] = m.full_name;
          }
        });

        // Map roster_id to team and manager names for easy lookup
        const rosterIdToTeam = {};
        const rosterIdToManager = {};
        rosters.forEach(r => {
          const user = users.find(u => u.user_id === r.owner_id) || {};
          const teamName = r.metadata?.team_name || user.metadata?.team_name || user.display_name || `Team ${r.roster_id}`;
          rosterIdToTeam[r.roster_id] = teamName;
          rosterIdToManager[r.roster_id] = userIdToName[r.owner_id] || teamName;
        });

        // Fetch matchups week by week
        const weeks = await Promise.all(
          Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1).map(async week => {
            const weekMatchups = await this.client.get(`/league/${leagueId}/matchups/${week}`).then(res => res.data);

            const matchupsMap = {};
            weekMatchups.forEach(m => {
              if (!matchupsMap[m.matchup_id]) {
                matchupsMap[m.matchup_id] = { home: null, away: null };
              }

              const team = {
                roster_id: m.roster_id,
                team_name: rosterIdToTeam[m.roster_id] || '',
                manager_name:
                  rosterIdToManager[m.roster_id] || rosterIdToTeam[m.roster_id] || '',
                points: parseSleeperPoints(m.points)
              };

              if (!matchupsMap[m.matchup_id].home) {
                matchupsMap[m.matchup_id].home = team;
              } else {
                matchupsMap[m.matchup_id].away = team;
              }
            });

            return { week, matchups: Object.values(matchupsMap) };
          })
        );

        return weeks;
      } catch (error) {
        console.error('❌ Error fetching season matchups:', error.message);
        throw error;
      }
    }

  async getWeeklyMatchupsWithLineups(leagueId, week, managers = [], seasonYear = null) {
      try {
        const parsedWeek = Number.parseInt(week, 10);
        const weekNumber = Number.isFinite(parsedWeek) ? parsedWeek : week;
        const parsedSeason = Number.parseInt(seasonYear, 10);

        // Use current NFL season from Sleeper API instead of calendar year
        let season;
        if (Number.isFinite(parsedSeason)) {
          season = parsedSeason;
        } else {
          const currentSeason = await this.getCurrentNFLSeason();
          season = currentSeason || new Date().getFullYear();
        }

        const [rosters, users, weekMatchups] = await Promise.all([
          this.getRosters(leagueId),
          this.getUsers(leagueId),
          this.client
            .get(`/league/${leagueId}/matchups/${week}`)
            .then(res => res.data)
            .catch(() => [])
        ]);

        if (!Array.isArray(weekMatchups) || weekMatchups.length === 0) {
          return { week: weekNumber, matchups: [] };
        }

        const playersMap = await this.getPlayersMap();
        const statsByPlayer = await this.getWeeklyPlayerStats(season, week);

        // Fetch ESPN game data for NFL schedule, kickoff times, and status
        const espnScoreboard = await espnService.getWeekGames(season, week);
        const espnGamesByTeam = espnService.parseGames(espnScoreboard);

        // Build ESPN ID to Sleeper ID mapping
        const espnIdToSleeperId = new Map();
        const sleeperPlayersByName = new Map(); // Fallback: match by name

        Object.entries(playersMap).forEach(([sleeperId, player]) => {
          if (player.espn_id) {
            espnIdToSleeperId.set(parseInt(player.espn_id), sleeperId);
          }

          // Build name-based lookup as fallback (normalize names)
          if (player.full_name) {
            const normalizedName = player.full_name.toLowerCase().replace(/[^a-z]/g, '');
            sleeperPlayersByName.set(normalizedName, sleeperId);
          }
        });

        // Fetch ESPN player stats for all games this week
        const espnPlayerStatsByGame = new Map();
        const uniqueGameIds = new Set(
          Array.from(espnGamesByTeam.values()).map(game => game.gameId)
        );

        console.log(`📊 Fetching ESPN stats for ${uniqueGameIds.size} games`);

        for (const gameId of uniqueGameIds) {
          try {
            const summary = await espnService.getGameSummary(gameId);
            if (summary && summary.boxscore) {
              const { playerStatsById, playerStatsByName } = espnService.parsePlayerStats(summary.boxscore);
              espnPlayerStatsByGame.set(gameId, { playerStatsById, playerStatsByName });
              console.log(`✅ Fetched stats for game ${gameId}: ${playerStatsById.size} players`);
            } else {
              console.log(`⚠️  No boxscore data for game ${gameId}`);
            }
          } catch (error) {
            console.warn(`❌ Failed to fetch ESPN stats for game ${gameId}:`, error.message);
          }
        }

        const scoreboardByTeam = await gameStatusService.getWeekGameStatuses(
          season,
          Number.isFinite(parsedWeek) ? parsedWeek : null
        );

        const userIdToName = {};
        managers.forEach(m => {
          if (m.sleeper_user_id) {
            userIdToName[m.sleeper_user_id] = m.full_name;
          }
        });

        const rosterIdToTeam = {};
        const rosterIdToManager = {};
        rosters.forEach(r => {
          const user = users.find(u => u.user_id === r.owner_id) || {};
          const teamName = r.metadata?.team_name ||
            user.metadata?.team_name ||
            user.display_name ||
            `Team ${r.roster_id}`;
          rosterIdToTeam[r.roster_id] = teamName;
          rosterIdToManager[r.roster_id] = userIdToName[r.owner_id] || teamName;
        });

        const matchupsMap = {};
        const now = Date.now();
        const weekForComparison = Number.isFinite(parsedWeek) ? parsedWeek : null;

        const deriveOpponentFromGameId = (gameId, team) => {
          if (!gameId || !team) {
            return null;
          }

          const parts = gameId.toString().split('-').map(part => part.toUpperCase());
          const normalizedTeam = team.toUpperCase();

          if (parts.length < 2) {
            return null;
          }

          if (parts[0] === normalizedTeam) {
            return parts[1];
          }

          if (parts[1] === normalizedTeam) {
            return parts[0];
          }

          return null;
        };

        weekMatchups.forEach(m => {
          const matchupKey = m.matchup_id != null ? m.matchup_id : m.roster_id;
          if (!matchupsMap[matchupKey]) {
            matchupsMap[matchupKey] = {
              matchup_id: m.matchup_id,
              home: null,
              away: null
            };
          }

          const formatStarters = (starters = [], starterPoints = []) =>
            starters
              .map((playerId, idx) => {
                if (!playerId || playerId === '0') {
                  return null;
                }

                const player = playersMap[playerId] || {};
                const name = player.full_name ||
                  [player.first_name, player.last_name]
                    .filter(Boolean)
                    .join(' ') ||
                  playerId;
                const position = Array.isArray(player.fantasy_positions) && player.fantasy_positions.length > 0
                  ? player.fantasy_positions[0]
                  : player.position || '';
                const rawTeam = player.team ||
                  player.player_team ||
                  player.metadata?.team_abbr ||
                  '';
                const team = typeof rawTeam === 'string' ? rawTeam.toUpperCase() : '';
                const scoreboardEntry = team ? scoreboardByTeam[team] || null : null;
                const espnGame = team ? espnGamesByTeam.get(team) || null : null;

                const rawPoints = starterPoints[idx];
                const parsedPoints =
                  typeof rawPoints === 'number'
                    ? rawPoints
                    : rawPoints != null && rawPoints !== ''
                    ? Number(rawPoints)
                    : null;
                const pointsValue = Number.isFinite(parsedPoints) ? parsedPoints : null;

                const statsEntry = statsByPlayer[playerId] || null;

                const rawStatusPieces = [];
                if (statsEntry && (statsEntry.status || statsEntry.game_status)) {
                  rawStatusPieces.push(statsEntry.status || statsEntry.game_status);
                }
                if (scoreboardEntry?.rawStatusText) {
                  rawStatusPieces.push(scoreboardEntry.rawStatusText);
                } else if (scoreboardEntry?.status) {
                  rawStatusPieces.push(scoreboardEntry.status);
                }

                const rawStatus = rawStatusPieces.length ? rawStatusPieces[0] : null;

                const normalizedStatsStatus = statsEntry?.status
                  ? this.normalizeGameStatus(statsEntry.status)
                  : null;
                const normalizedScoreboardStatus = scoreboardEntry?.status
                  ? this.normalizeGameStatus(scoreboardEntry.status)
                  : null;

                let normalizedStatus = this.normalizeGameStatus(rawStatus);
                if (normalizedScoreboardStatus) {
                  normalizedStatus = normalizedScoreboardStatus;
                }

                const pickFirstTimestamp = (...values) => {
                  for (const candidate of values) {
                    const normalized = this.normalizeTimestamp(candidate);
                    if (Number.isFinite(normalized)) {
                      return normalized;
                    }
                  }
                  return null;
                };

                // Prioritize ESPN data for kickoff time (most reliable)
                const parsedStart = pickFirstTimestamp(
                  espnGame?.date,
                  scoreboardEntry?.startTime,
                  statsEntry?.game_start,
                  statsEntry?.game_start_time,
                  statsEntry?.game_start_ms
                );

                const scoreboardOpponent =
                  scoreboardEntry && team
                    ? scoreboardEntry.homeTeam === team
                      ? scoreboardEntry.awayTeam
                      : scoreboardEntry.awayTeam === team
                      ? scoreboardEntry.homeTeam
                      : null
                    : null;

                const opponent =
                  (scoreboardOpponent && scoreboardOpponent) ||
                  (statsEntry &&
                    typeof statsEntry.opponent === 'string' &&
                    statsEntry.opponent
                      ? statsEntry.opponent.toUpperCase()
                      : null) ||
                  deriveOpponentFromGameId(statsEntry?.game_id, team);

                const scoreboardHomeAway =
                  scoreboardEntry && team
                    ? scoreboardEntry.homeTeam === team
                      ? 'home'
                      : scoreboardEntry.awayTeam === team
                      ? 'away'
                      : null
                    : null;

                const homeAway =
                  scoreboardHomeAway ||
                  (opponent && team ? (opponent === team ? 'home' : 'away') : null);

                const byeWeek =
                  player.bye_week ??
                  player.bye_week_num ??
                  player.metadata?.bye_week ??
                  player.metadata?.bye_week_num ??
                  null;
                const normalizedByeWeek =
                  byeWeek != null ? Number.parseInt(byeWeek, 10) : null;

                // ESPN game status signals (most reliable)
                const espnIsFinished = espnGame?.status === 'STATUS_FINAL';
                const espnIsLive = espnGame?.status === 'STATUS_IN_PROGRESS';
                const espnIsScheduled = espnGame?.status === 'STATUS_SCHEDULED';

                // Additional check: game might be finished but ESPN hasn't updated status yet
                // Look for "Final" in the status detail or clock showing 0:00 in OT
                const espnStatusDetail = (espnGame?.statusDetail || '').toLowerCase();
                const espnClock = (espnGame?.clock || '').toLowerCase();
                const espnPeriod = espnGame?.period || 0;
                const espnLooksFinished =
                  espnStatusDetail.includes('final') ||
                  (espnClock === '0:00' && espnPeriod > 4) || // OT ended
                  (espnClock === 'final');

                const scoreboardActivityKey = scoreboardEntry?.activityKey || null;
                const scoreboardHasFinishedSignal =
                  espnIsFinished ||
                  espnLooksFinished ||
                  scoreboardEntry?.isFinal ||
                  scoreboardActivityKey === 'finished' ||
                  normalizedScoreboardStatus === 'final';
                const scoreboardHasLiveSignal =
                  espnIsLive ||
                  scoreboardEntry?.isInProgress ||
                  scoreboardActivityKey === 'live' ||
                  normalizedScoreboardStatus === 'in_progress';
                const scoreboardHasUpcomingSignal =
                  espnIsScheduled ||
                  scoreboardEntry?.isPre ||
                  scoreboardActivityKey === 'upcoming' ||
                  normalizedScoreboardStatus === 'pre';
                const scoreboardIsDelayed =
                  scoreboardEntry?.isDelayed ||
                  normalizedScoreboardStatus === 'postponed' ||
                  normalizedScoreboardStatus === 'delayed' ||
                  normalizedScoreboardStatus === 'canceled';

                const isByeWeek =
                  normalizedStatus === 'bye' ||
                  normalizedStatsStatus === 'bye' ||
                  normalizedScheduleStatus === 'bye' ||
                  normalizedScoreboardStatus === 'bye' ||
                  (normalizedByeWeek != null &&
                    weekForComparison != null &&
                    normalizedByeWeek === weekForComparison);

                if (isByeWeek) {
                  normalizedStatus = 'bye';
                }

                const injuryStatus =
                  player.injury_status ||
                  player.injury_status_2 ||
                  player.metadata?.injury_status ||
                  null;
                const practiceStatus =
                  player.practice_participation ||
                  player.practice_status ||
                  player.metadata?.practice_participation ||
                  null;

                const determineActivityKey = () => {
                  if (isByeWeek) {
                    return 'inactive';
                  }

                  const statusCandidates = [
                    normalizedStatus,
                    normalizedStatsStatus,
                    normalizedScheduleStatus,
                    normalizedScoreboardStatus
                  ].filter(Boolean);

                  const hasFinalStatus = statusCandidates.includes('final');
                  const hasLiveStatus = statusCandidates.includes('in_progress');
                  const hasPreStatus = statusCandidates.includes('pre');

                  const rawStatusTextCombined = [
                    rawStatus,
                    scoreboardEntry?.rawStatusText,
                    scoreboardEntry?.detail
                  ]
                    .filter(Boolean)
                    .map(value => value.toString().toLowerCase())
                    .join(' ');
                  const hasFinishedDetail =
                    rawStatusTextCombined.includes('final') ||
                    rawStatusTextCombined.includes('post') ||
                    rawStatusTextCombined.includes('complete') ||
                    rawStatusTextCombined.includes('finished') ||
                    rawStatusTextCombined.includes('closed');
                  const liveDetailRegex = /\b(q[1-4]|1st|2nd|3rd|4th|ot)\b/;
                  const hasLiveDetail =
                    liveDetailRegex.test(rawStatusTextCombined) ||
                    rawStatusTextCombined.includes('half') ||
                    rawStatusTextCombined.includes('quarter');

                  const hasKickoff = Number.isFinite(parsedStart);
                  const kickoffHasPassed = hasKickoff && parsedStart <= now;
                  const kickoffLikelyFinished =
                    hasKickoff && now - parsedStart >= GAME_COMPLETION_BUFFER_MS;

                  const statsAvailable = !!statsEntry;
                  const hasPoints = pointsValue !== null;
                  const hasNonZeroPoints = hasPoints && pointsValue !== 0;

                  const hasGameFinishedSignal = Boolean(
                    scoreboardHasFinishedSignal ||
                      hasFinalStatus ||
                      hasFinishedDetail ||
                      (kickoffLikelyFinished && (statsAvailable || hasPoints))
                  );

                  if (hasGameFinishedSignal) {
                    return 'finished';
                  }

                  const hasGameStartedSignal = Boolean(
                    scoreboardHasLiveSignal ||
                      hasGameFinishedSignal ||
                      hasLiveStatus ||
                      hasLiveDetail ||
                      statsAvailable ||
                      kickoffHasPassed ||
                      hasNonZeroPoints
                  );

                  if (hasGameStartedSignal) {
                    return 'live';
                  }

                  const hasGameUpcomingSignal = Boolean(
                    scoreboardHasUpcomingSignal ||
                      hasPreStatus ||
                      (!hasGameStartedSignal && hasKickoff && parsedStart > now) ||
                      (scoreboardIsDelayed && !hasGameFinishedSignal)
                  );

                  if (hasGameUpcomingSignal) {
                    return 'upcoming';
                  }

                  if (scoreboardActivityKey === 'inactive') {
                    return 'inactive';
                  }

                  if (!team && !statsEntry) {
                    return 'inactive';
                  }

                  return 'upcoming';
                };

                const rawGameStatusForDisplay =
                  scoreboardEntry?.detail ||
                  scoreboardEntry?.rawStatusText ||
                  (typeof rawStatus === 'string' ? rawStatus : null);

                let activityKey = determineActivityKey();

                // Post-process: Handle edge cases where status should be 'finished'
                const hasKickoff = Number.isFinite(parsedStart);
                const kickoffLikelyFinished = hasKickoff && now - parsedStart >= GAME_COMPLETION_BUFFER_MS;

                if (activityKey === 'live') {
                  const liveDetailRegex = /\b(q[1-4]|1st|2nd|3rd|4th|ot)\b/;
                  const rawStatusTextCombined = [
                    rawStatus,
                    scoreboardEntry?.rawStatusText,
                    scoreboardEntry?.detail
                  ]
                    .filter(Boolean)
                    .map(value => value.toString().toLowerCase())
                    .join(' ');
                  const hasLiveDetail =
                    liveDetailRegex.test(rawStatusTextCombined) ||
                    rawStatusTextCombined.includes('half') ||
                    rawStatusTextCombined.includes('quarter');
                  const hasAnyLiveIndicators =
                    hasLiveDetail ||
                    scoreboardHasLiveSignal ||
                    scoreboardActivityKey === 'live';

                  if (!hasAnyLiveIndicators) {
                    if (kickoffLikelyFinished) {
                      activityKey = 'finished';
                    } else if (!hasKickoff && pointsValue !== null) {
                      activityKey = 'finished';
                    } else if (hasKickoff && parsedStart <= now && !scoreboardHasUpcomingSignal) {
                      const timeSinceKickoff = now - parsedStart;
                      const minGameDuration = 3 * 60 * 60 * 1000; // 3 hours
                      if (timeSinceKickoff >= minGameDuration) {
                        activityKey = 'finished';
                      }
                    }
                  }
                }

                // Don't try to guess finished status for players with 0 points and no kickoff data
                // Without reliable kickoff/status information from Sleeper, this is too error-prone
                // Better to show "Not Started" for an upcoming game than "Finished" for a game that hasn't happened

                // Get ESPN player stats if available
                const gameId = espnGame?.gameId || null;
                const espnId = player?.espn_id ? parseInt(player.espn_id) : null;
                let espnPlayerStats = null;

                if (gameId && espnPlayerStatsByGame.has(gameId)) {
                  const { playerStatsById, playerStatsByName } = espnPlayerStatsByGame.get(gameId);

                  // Try matching by ESPN ID first
                  if (espnId) {
                    espnPlayerStats = playerStatsById.get(espnId) || null;
                  }

                  // Fallback: Try fuzzy name matching with position verification
                  if (!espnPlayerStats && name) {
                    // Helper to normalize names (remove suffixes, special chars)
                    const normalizeForMatching = (str) => {
                      return str
                        .toLowerCase()
                        .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '') // Remove suffixes
                        .replace(/[^a-z]/g, '') // Remove non-alpha
                        .trim();
                    };

                    const sleeperNormalized = normalizeForMatching(name);

                    // Try exact normalized match first
                    let candidate = playerStatsByName.get(sleeperNormalized);

                    // If no exact match, try fuzzy matching with all players in the game
                    if (!candidate) {
                      let bestMatch = null;
                      let bestScore = 0;

                      for (const espnPlayer of playerStatsById.values()) {
                        const espnNormalized = normalizeForMatching(espnPlayer.name || '');

                        // Calculate similarity score
                        let score = 0;

                        // Check if normalized names match
                        if (sleeperNormalized === espnNormalized) {
                          score = 100;
                        } else if (sleeperNormalized.includes(espnNormalized) || espnNormalized.includes(sleeperNormalized)) {
                          // Partial match (handles nicknames like "AJ" vs "A.J.")
                          score = 80;
                        } else {
                          // Calculate Levenshtein-like similarity
                          const maxLen = Math.max(sleeperNormalized.length, espnNormalized.length);
                          const minLen = Math.min(sleeperNormalized.length, espnNormalized.length);
                          if (maxLen > 0 && minLen / maxLen > 0.7) {
                            // Names are similar length
                            let matches = 0;
                            for (let i = 0; i < minLen; i++) {
                              if (sleeperNormalized[i] === espnNormalized[i]) {
                                matches++;
                              }
                            }
                            score = (matches / maxLen) * 70;
                          }
                        }

                        // Position bonus (if positions match, add confidence)
                        if (score > 50 && position && espnPlayer.position) {
                          if (position.toUpperCase() === espnPlayer.position.toUpperCase()) {
                            score += 20;
                          }
                        }

                        if (score > bestScore && score >= 70) {
                          bestScore = score;
                          bestMatch = espnPlayer;
                        }
                      }

                      if (bestMatch) {
                        candidate = bestMatch;
                        console.log(`✅ Fuzzy matched ${name} to ${bestMatch.name} (score: ${bestScore.toFixed(0)}, pos: ${position}/${bestMatch.position})`);
                      }
                    } else {
                      console.log(`✅ Exact name match: ${name} → ${candidate.name}`);
                    }

                    espnPlayerStats = candidate;
                  }

                  if (!espnPlayerStats && name) {
                    // Only log if it's not a team defense (those don't have individual stats in box scores)
                    if (position !== 'DEF') {
                      console.log(`⚠️  No ESPN stats found for ${name} (Pos: ${position}, Game: ${gameId})`);
                    }
                  }
                }

                return {
                  slot: idx,
                  player_id: playerId,
                  name,
                  position,
                  team,
                  points: pointsValue,
                  opponent: opponent || null,
                  home_away: homeAway || null,
                  game_status: normalizedStatus,
                  raw_game_status: rawGameStatusForDisplay || null,
                  game_start: parsedStart,
                  bye_week: normalizedByeWeek,
                  is_bye: isByeWeek,
                  injury_status: injuryStatus,
                  practice_status: practiceStatus,
                  game_id:
                    statsEntry?.game_id ||
                    scoreboardEntry?.gameId ||
                    null,
                  activity_key: activityKey,
                  stats_available: !!statsEntry,
                  stats: statsEntry || null,
                  scoreboard_status: scoreboardEntry?.status || null,
                  scoreboard_activity_key: scoreboardActivityKey || null,
                  scoreboard_detail:
                    espnGame?.statusDetail ||
                    scoreboardEntry?.detail ||
                    (scoreboardHasFinishedSignal ? 'FINAL' : null),
                  scoreboard_start: espnGame?.date || scoreboardEntry?.startTime || null,
                  scoreboard_last_updated: scoreboardEntry?.lastUpdated || null,
                  scoreboard_home_team: scoreboardEntry?.homeTeam || null,
                  scoreboard_home_score:
                    scoreboardEntry && scoreboardEntry.homeScore != null
                      ? scoreboardEntry.homeScore
                      : null,
                  scoreboard_away_team: scoreboardEntry?.awayTeam || null,
                  scoreboard_away_score:
                    scoreboardEntry && scoreboardEntry.awayScore != null
                      ? scoreboardEntry.awayScore
                      : null,
                  scoreboard_quarter: scoreboardEntry?.quarter || null,
                  scoreboard_clock: scoreboardEntry?.clock || null,
                  // ESPN traditional stats
                  espn_stats: espnPlayerStats ? {
                    stat_line: espnPlayerStats.statLine || null,
                    passing: espnPlayerStats.passing || null,
                    rushing: espnPlayerStats.rushing || null,
                    receiving: espnPlayerStats.receiving || null,
                    fumbles: espnPlayerStats.fumbles || null,
                    kicking: espnPlayerStats.kicking || null,
                    defensive: espnPlayerStats.defensive || null,
                    detailed_stats: espnPlayerStats.stats || null
                  } : null
                };
              })
              .filter(Boolean);

          const starters = formatStarters(m.starters || [], m.starters_points || []);

          const numericPoints =
            typeof m.points === 'number' ? m.points : Number(m.points) || 0;

          const team = {
            roster_id: m.roster_id,
            team_name: rosterIdToTeam[m.roster_id] || '',
            manager_name: rosterIdToManager[m.roster_id] || rosterIdToTeam[m.roster_id] || '',
            points: Number.isFinite(numericPoints) ? numericPoints : 0,
            starters
          };

          if (!matchupsMap[matchupKey].home) {
            matchupsMap[matchupKey].home = team;
          } else {
            matchupsMap[matchupKey].away = team;
          }
        });

        const matchups = Object.values(matchupsMap).map(matchup => ({
          matchup_id: matchup.matchup_id != null ? matchup.matchup_id : null,
          home: matchup.home,
          away: matchup.away
        }));

        return {
          week: weekNumber,
          matchups
        };
      } catch (error) {
        console.error('❌ Error fetching weekly matchups with lineups:', error.message);
        throw error;
      }
    }

    /**
     * Fetch playoff matchups and scores for all rounds
     */
  async getPlayoffMatchups(leagueId, managers = []) {
      try {
        const leagueInfo = await this.getLeagueInfo(leagueId);
        const rosters = await this.getRosters(leagueId);
        const users = await this.getUsers(leagueId);

        const playoffStart = leagueInfo.settings.playoff_week_start;

        // Map Sleeper user_id to manager full name
        const userIdToName = {};
        managers.forEach(m => {
          if (m.sleeper_user_id) {
            userIdToName[m.sleeper_user_id] = m.full_name;
          }
        });

        // Map roster_id to team/manager names and calculate seeds
        const rosterIdToTeam = {};
        const rosterIdToManager = {};
        rosters.forEach(r => {
          const user = users.find(u => u.user_id === r.owner_id) || {};
          const teamName = r.metadata?.team_name || user.metadata?.team_name || user.display_name || `Team ${r.roster_id}`;
          rosterIdToTeam[r.roster_id] = teamName;
          rosterIdToManager[r.roster_id] = userIdToName[r.owner_id] || teamName;
        });

        // Calculate seeds based on regular season performance
        const sortedRosters = [...rosters].sort((a, b) => {
          if (b.settings.wins !== a.settings.wins) {
            return b.settings.wins - a.settings.wins;
          }
          const aPts = (a.settings.fpts || 0) + ((a.settings.fpts_decimal || 0) / 100);
          const bPts = (b.settings.fpts || 0) + ((b.settings.fpts_decimal || 0) / 100);
          return bPts - aPts;
        });
        const rosterIdToSeed = {};
        sortedRosters.forEach((r, idx) => {
          rosterIdToSeed[r.roster_id] = idx + 1;
        });

        // Determine number of playoff rounds from winners bracket
        let totalRounds = 3;
        const playoffTeamIds = new Set();
        try {
          const bracket = await this.client
            .get(`/league/${leagueId}/winners_bracket`)
            .then(res => res.data);

          const seededGames = Array.isArray(bracket)
            ? bracket.filter(g => g.t1 != null && g.t2 != null)
            : [];

          if (seededGames.length === 0) {
            return [];
          }

          seededGames.forEach(g => {
            if (g.t1 != null) playoffTeamIds.add(g.t1);
            if (g.t2 != null) playoffTeamIds.add(g.t2);
          });

          if (Array.isArray(bracket) && bracket.length > 0) {
            totalRounds = Math.max(...bracket.map(g => g.r || 0));
          }
        } catch (err) {
          // Ignore bracket fetch errors and default to 3 rounds
        }

        const rounds = await Promise.all(
          Array.from({ length: totalRounds }, (_, i) => playoffStart + i).map(async (week, idx) => {
            const weekMatchups = await this.client
              .get(`/league/${leagueId}/matchups/${week}`)
              .then(res => res.data)
              .catch(() => []);

            const matchupsMap = {};
            weekMatchups.forEach(m => {
              if (!playoffTeamIds.has(m.roster_id)) return;

              if (!matchupsMap[m.matchup_id]) {
                matchupsMap[m.matchup_id] = { home: null, away: null };
              }

              const team = {
                roster_id: m.roster_id,
                team_name: rosterIdToTeam[m.roster_id] || '',
                manager_name:
                  rosterIdToManager[m.roster_id] || rosterIdToTeam[m.roster_id] || '',
                points: parseSleeperPoints(m.points),
                seed: rosterIdToSeed[m.roster_id] || null
              };

              if (!matchupsMap[m.matchup_id].home) {
                matchupsMap[m.matchup_id].home = team;
              } else {
                matchupsMap[m.matchup_id].away = team;
              }
            });

            const matchups = Object.values(matchupsMap).filter(
              m =>
                m.home &&
                m.away &&
                m.home.roster_id != null &&
                m.away.roster_id != null &&
                m.home.seed <= 6 &&
                m.away.seed <= 6
            );

            return { round: idx + 1, matchups };
          })
        );
        if (rounds.length > 0) {
          const seed1 = sortedRosters[0];
          const seed2 = sortedRosters[1];
          const byeTeam = {
            roster_id: null,
            team_name: '',
            manager_name: 'BYE',
            points: 0,
            seed: null
          };

          const round1 = rounds[0] || { round: 1, matchups: [] };
          const match4v5 = round1.matchups.find(
            m =>
              [m.home.seed, m.away.seed].includes(4) &&
              [m.home.seed, m.away.seed].includes(5)
          );
          const match3v6 = round1.matchups.find(
            m =>
              [m.home.seed, m.away.seed].includes(3) &&
              [m.home.seed, m.away.seed].includes(6)
          );

          round1.matchups = [
            {
              home: {
                roster_id: seed1.roster_id,
                team_name: rosterIdToTeam[seed1.roster_id] || '',
                manager_name:
                  rosterIdToManager[seed1.roster_id] ||
                  rosterIdToTeam[seed1.roster_id] ||
                  '',
                points: 0,
                seed: 1
              },
              away: byeTeam
            },
            match4v5,
            match3v6,
            {
              home: {
                roster_id: seed2.roster_id,
                team_name: rosterIdToTeam[seed2.roster_id] || '',
                manager_name:
                  rosterIdToManager[seed2.roster_id] ||
                  rosterIdToTeam[seed2.roster_id] ||
                  '',
                points: 0,
                seed: 2
              },
              away: byeTeam
            }
          ].filter(Boolean);
          rounds[0] = round1;

          if (rounds[1] && rounds[2]) {
            const semifinalWinners = [];
            const semifinalLosers = [];
            rounds[1].matchups.forEach(m => {
              const homePoints = m.home.points || 0;
              const awayPoints = m.away.points || 0;
              if (homePoints > awayPoints) {
                semifinalWinners.push(m.home.roster_id);
                semifinalLosers.push(m.away.roster_id);
              } else if (awayPoints > homePoints) {
                semifinalWinners.push(m.away.roster_id);
                semifinalLosers.push(m.home.roster_id);
              }
            });

            const quarterfinalLosers = [];
            rounds[0].matchups.forEach(m => {
              if (!m.away || m.away.roster_id == null) return; // skip byes
              const homePoints = m.home.points || 0;
              const awayPoints = m.away.points || 0;
              if (homePoints > awayPoints) {
                quarterfinalLosers.push(m.away.roster_id);
              } else if (awayPoints > homePoints) {
                quarterfinalLosers.push(m.home.roster_id);
              }
            });

            // Remove fifth place game from semifinals round
            rounds[1].matchups = rounds[1].matchups.filter(m => {
              const home = m.home.roster_id;
              const away = m.away.roster_id;
              return !(
                quarterfinalLosers.includes(home) &&
                quarterfinalLosers.includes(away)
              );
            });

            // Only keep championship and third place games in final round
            rounds[2].matchups = rounds[2].matchups.filter(m => {
              const home = m.home.roster_id;
              const away = m.away.roster_id;
              const isChampionship =
                semifinalWinners.includes(home) &&
                semifinalWinners.includes(away);
              const isThirdPlace =
                semifinalLosers.includes(home) &&
                semifinalLosers.includes(away);
              return isChampionship || isThirdPlace;
            });
          }
        }

        return rounds.every(r => !r.matchups || r.matchups.length === 0)
          ? []
          : rounds;
      } catch (error) {
        console.error('❌ Error fetching playoff matchups:', error.message);
        throw error;
      }
    }

    /**
     * Fetch final rosters with player names for a league
     */
    async getFinalRosters(leagueId, managers = []) {
      try {
        const rosters = await this.getRosters(leagueId);
        const users = await this.getUsers(leagueId);
        const players = await this.client
          .get('/players/nfl')
          .then(res => res.data);

        // Fetch draft data to determine cost for drafted players
        let playerCosts = {};
        try {
          const drafts = await this.client
            .get(`/league/${leagueId}/drafts`)
            .then(res => res.data);
          if (Array.isArray(drafts) && drafts.length > 0) {
            const draftId = drafts[0].draft_id;
            const picks = await this.client
              .get(`/draft/${draftId}/picks`)
              .then(res => res.data);
            picks.forEach(pick => {
              if (pick.player_id) {
                const amount = pick.metadata?.amount;
                if (amount) {
                  playerCosts[pick.player_id] = amount;
                }
              }
            });
          }
        } catch (e) {
          console.warn('⚠️ Could not fetch draft data:', e.message);
        }

        const userIdToName = {};
        const userIdToManagerId = {};
        managers.forEach(m => {
          if (m.sleeper_user_id) {
            userIdToName[m.sleeper_user_id] = m.full_name;
            if (m.name_id) {
              userIdToManagerId[m.sleeper_user_id] = m.name_id;
            }
          }
        });

        const rosterInfos = rosters.map(r => {
          const user = users.find(u => u.user_id === r.owner_id) || {};
          const teamName =
            r.metadata?.team_name ||
            user.metadata?.team_name ||
            user.display_name ||
            `Team ${r.roster_id}`;
          const managerName = userIdToName[r.owner_id] || teamName;
          const managerId = userIdToManagerId[r.owner_id] || null;

          const playerInfos = (r.players || []).map(pid => {
            const p = players[pid] || {};
            const name =
              p.full_name ||
              (p.first_name && p.last_name
                ? `${p.first_name} ${p.last_name}`
                : pid);
            return {
              id: pid,
              name,
              team: p.team || '',
              position: p.position || '',
              draft_cost: playerCosts[pid] || ''
            };
          });

          return {
            roster_id: r.roster_id,
            team_name: teamName,
            manager_name: managerName,
            manager_id: managerId,
            players: playerInfos
          };
        });

        const draftedPlayers = Object.entries(playerCosts).map(([pid, cost]) => {
          const p = players[pid] || {};
          const name =
            p.full_name ||
            (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : pid);
          return {
            id: pid,
            name,
            team: p.team || '',
            position: p.position || '',
            draft_cost: cost
          };
        });

        return { rosters: rosterInfos, draftedPlayers };
      } catch (error) {
        console.error('❌ Error fetching final rosters:', error.message);
        throw error;
      }
    }

    /**
     * Process and combine all fetched data
     */
    processLeagueData(year, leagueInfo, rosters, users, managers, playoffResults, highGames, seasonalIds = []) {
      // Create a map of roster_id to username
    // Map roster_id to Sleeper user_id (owner_id)
    const rosterToUserId = {};
    rosters.forEach(roster => {
      rosterToUserId[roster.roster_id] = roster.owner_id;
    });

    // Map user_id to username and team name for reference
    const userIdToUsername = {};
    const userIdToTeamName = {};
    users.forEach(user => {
      if (user.user_id) {
        userIdToUsername[user.user_id] = user.username;

        const userTeamName = user.metadata?.team_name || user.display_name;
        if (userTeamName) {
          userIdToTeamName[user.user_id] = userTeamName;
        }
      }
    });

    // Create a map of sleeper_user_id to name_id for easy lookup
    const userIdToNameId = {};
    managers.forEach(manager => {
      if (manager.sleeper_user_id) {
        userIdToNameId[manager.sleeper_user_id] = manager.name_id;
      }
    });
    seasonalIds.forEach(mapping => {
      if (mapping.sleeper_user_id) {
        userIdToNameId[mapping.sleeper_user_id] = mapping.name_id;
      }
    });

    // Calculate regular season rankings
    const sortedRosters = [...rosters].sort((a, b) => {
      // Sort by wins first, then by points_for as tiebreaker
      if (b.settings.wins !== a.settings.wins) {
        return b.settings.wins - a.settings.wins;
      }
      const aPoints = (a.settings.fpts || 0) + ((a.settings.fpts_decimal || 0) / 100);
      const bPoints = (b.settings.fpts || 0) + ((b.settings.fpts_decimal || 0) / 100);
      return bPoints - aPoints;
    });

    // Process each roster
    const teamSeasons = rosters.map(roster => {
      const rosterId = roster.roster_id;
      const userId = rosterToUserId[rosterId];
      const username = userIdToUsername[userId] || '';
      const nameId = userIdToNameId[userId] || null;

      // Get team name - Sleeper stores this on the roster or user metadata.
      // Fall back to league metadata keys for older seasons if needed.
      const teamName = roster.metadata?.team_name ||
                      userIdToTeamName[userId] ||
                      leagueInfo.metadata?.team_names?.[rosterId] ||
                      leagueInfo.metadata?.[`team_name_${rosterId}`] ||
                      '';

      // Calculate points (combining integer and decimal parts)
      const pointsFor = (roster.settings.fpts || 0) + 
                       ((roster.settings.fpts_decimal || 0) / 100);
      const pointsAgainst = (roster.settings.fpts_against || 0) + 
                            ((roster.settings.fpts_against_decimal || 0) / 100);

      // Get regular season rank
      const regularSeasonRank = sortedRosters.findIndex(r => r.roster_id === rosterId) + 1;

      // Get playoff finish (if applicable)
      const playoffFinish = playoffResults[rosterId] || null;

      // Get high game
      const highGame = highGames[rosterId] || null;

      return {
        year,
        name_id: nameId,
        sleeper_username: username,  // Keep for reference but won't save to DB
        sleeper_user_id: userId,     // For matching to managers
        team_name: teamName,
        wins: roster.settings.wins || 0,
        losses: roster.settings.losses || 0,
        points_for: Math.round(pointsFor * 100) / 100,  // Round to 2 decimals
        points_against: Math.round(pointsAgainst * 100) / 100,
        regular_season_rank: regularSeasonRank,
        playoff_finish: playoffFinish,
        high_game: highGame ? Math.round(highGame * 100) / 100 : null,
        // These fields will be preserved from existing data or set manually:
        // dues, payout, dues_chumpion
      };
    });

    return teamSeasons;
  }

  /**
   * Get the current NFL week
   */
  async getNFLState() {
    try {
      const now = Date.now();
      if (this.nflStateCache.data && now - this.nflStateCache.timestamp < this.nflStateCacheTtl) {
        return this.nflStateCache.data;
      }

      const response = await this.client.get('/state/nfl');
      const state = response.data;

      this.nflStateCache = {
        data: state,
        timestamp: now
      };

      return state;
    } catch (error) {
      console.error('❌ Error fetching NFL state:', error.message);
      return null;
    }
  }

  async getCurrentNFLWeek() {
    try {
      const state = await this.getNFLState();
      return state?.week || null;
    } catch (error) {
      console.error('❌ Error fetching current NFL week:', error.message);
      return null;
    }
  }

  async getCurrentNFLSeason() {
    try {
      const state = await this.getNFLState();
      return state?.season || null;
    } catch (error) {
      console.error('❌ Error fetching current NFL season:', error.message);
      return null;
    }
  }

  /**
   * Validate that we can connect to Sleeper API
   */
  async testConnection() {
    try {
      // Try to fetch NFL state as a simple test
      const response = await this.client.get('/state/nfl');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SleeperService();
