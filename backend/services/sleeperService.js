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
   * @returns {Object} Processed data ready for database insertion
   */
  async fetchLeagueData(leagueId, year, managers) {
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
        highGames
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

      // Find 3rd place game if it exists
      const thirdPlaceGame = bracket.find(game => 
        game.r === championshipRound && 
        game.p === championshipGame.p + 1
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
   * Process and combine all fetched data
   */
  processLeagueData(year, leagueInfo, rosters, users, managers, playoffResults, highGames) {
    // Create a map of roster_id to username
    // Map roster_id to Sleeper user_id (owner_id)
    const rosterToUserId = {};
    rosters.forEach(roster => {
      rosterToUserId[roster.roster_id] = roster.owner_id;
    });

    // Map user_id to username for reference
    const userIdToUsername = {};
    users.forEach(user => {
      if (user.user_id) {
        userIdToUsername[user.user_id] = user.username;
      }
    });

    // Create a map of sleeper_user_id to name_id for easy lookup
    const userIdToNameId = {};
    managers.forEach(manager => {
      if (manager.sleeper_user_id) {
        userIdToNameId[manager.sleeper_user_id] = manager.name_id;
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

      // Get team name from metadata
      const teamName = leagueInfo.metadata?.team_names?.[rosterId] || 
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