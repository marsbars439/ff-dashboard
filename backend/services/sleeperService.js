const axios = require('axios');

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

class SleeperService {
  constructor() {
    this.client = axios.create({
      baseURL: SLEEPER_BASE_URL,
      timeout: 10000,
    });
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

      return {
        success: true,
        data: processedData,
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
                manager_name: rosterIdToManager[m.roster_id] || rosterIdToTeam[m.roster_id] || '',
                points: m.points || 0
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

        // Map roster_id to team and manager names
        const rosterIdToTeam = {};
        const rosterIdToManager = {};
        rosters.forEach(r => {
          const user = users.find(u => u.user_id === r.owner_id) || {};
          const teamName = r.metadata?.team_name || user.metadata?.team_name || user.display_name || `Team ${r.roster_id}`;
          rosterIdToTeam[r.roster_id] = teamName;
          rosterIdToManager[r.roster_id] = userIdToName[r.owner_id] || teamName;
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
                manager_name: rosterIdToManager[m.roster_id] || rosterIdToTeam[m.roster_id] || '',
                points: m.points || 0
              };

              if (!matchupsMap[m.matchup_id].home) {
                matchupsMap[m.matchup_id].home = team;
              } else {
                matchupsMap[m.matchup_id].away = team;
              }
            });

            const matchups = Object.values(matchupsMap).filter(
              m => m.home && m.away && m.home.roster_id != null && m.away.roster_id != null
            );

            return { round: idx + 1, matchups };
          })
        );

        return rounds.every(r => !r.matchups || r.matchups.length === 0) ? [] : rounds;
      } catch (error) {
        console.error('❌ Error fetching playoff matchups:', error.message);
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
