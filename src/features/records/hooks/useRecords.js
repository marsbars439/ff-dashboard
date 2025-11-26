/**
 * useRecords Hook
 * Calculates hall of records data from managers and team seasons
 */

import { useMemo } from 'react';
import { useManagers } from '../../../hooks/useManagers';
import { useTeamSeasons } from '../../../hooks/useTeamSeasons';

export function useRecords() {
  const { managers, loading: managersLoading, error: managersError } = useManagers();
  const { teamSeasons, loading: seasonsLoading, error: seasonsError } = useTeamSeasons();

  const loading = managersLoading || seasonsLoading;
  const error = managersError || seasonsError;

  // Calculate the most recent year
  const mostRecentYear = useMemo(() => {
    if (teamSeasons.length === 0) return new Date().getFullYear();
    return Math.max(...teamSeasons.map(s => s.year));
  }, [teamSeasons]);

  // Get current year seasons
  const currentYearSeasons = useMemo(
    () => teamSeasons.filter(s => s.year === mostRecentYear),
    [teamSeasons, mostRecentYear]
  );

  // Find current champion
  const currentChampion = useMemo(
    () => currentYearSeasons.find(s => s.playoff_finish === 1),
    [currentYearSeasons]
  );

  // Check if regular season is complete
  const isRegularSeasonComplete = (year) => {
    const seasons = teamSeasons.filter(s => s.year === year);
    return (
      seasons.length > 0 &&
      seasons.every(s => (s.wins + s.losses + (s.ties || 0)) === 14)
    );
  };

  const currentSeasonComplete = isRegularSeasonComplete(mostRecentYear);

  // Find current chumpion
  const currentChumpion = useMemo(() => {
    const seasonsWithRank = currentYearSeasons.filter(
      s => s.regular_season_rank && s.regular_season_rank > 0
    );

    if (
      !currentSeasonComplete ||
      seasonsWithRank.length !== currentYearSeasons.length ||
      seasonsWithRank.length === 0
    ) {
      return null;
    }

    return seasonsWithRank.reduce((worst, current) =>
      current.regular_season_rank > worst.regular_season_rank ? current : worst
    );
  }, [currentYearSeasons, currentSeasonComplete]);

  // Calculate all records
  const allRecords = useMemo(() => {
    if (managers.length === 0 || teamSeasons.length === 0) {
      return {};
    }

    const records = {};

    // Initialize records for each manager
    managers.forEach(manager => {
      records[manager.name_id] = {
        name: manager.full_name,
        active: manager.active,
        championships: 0,
        secondPlace: 0,
        thirdPlace: 0,
        chumpionships: 0,
        chumpionYears: [],
        totalWins: 0,
        totalLosses: 0,
        totalPointsFor: 0,
        totalPointsAgainst: 0,
        totalPayout: 0,
        totalDues: 0,
        totalDuesChumpion: 0,
        seasons: 0,
        playoffAppearances: 0,
        gamesPlayed: 0,
        bestRecord: null,
        worstRecord: null,
        highestSeasonPoints: 0,
        highestGamePoints: 0,
        mostPointsAgainst: 0,
        netEarnings: 0
      };
    });

    // Group seasons by year to find chumpions
    const seasonsByYear = {};
    teamSeasons.forEach(season => {
      if (!seasonsByYear[season.year]) {
        seasonsByYear[season.year] = [];
      }
      seasonsByYear[season.year].push(season);
    });

    // Determine chumpions for each year
    const chumpionsByYear = {};
    Object.keys(seasonsByYear).forEach(year => {
      const seasonsInYear = seasonsByYear[year];
      const validRanks = seasonsInYear.filter(
        s => s.regular_season_rank && s.regular_season_rank > 0
      );
      const seasonComplete = seasonsInYear.every(
        s => (s.wins + s.losses + (s.ties || 0)) === 14
      );

      if (seasonComplete && validRanks.length === seasonsInYear.length && validRanks.length > 0) {
        const chumpion = validRanks.reduce((worst, current) =>
          current.regular_season_rank > worst.regular_season_rank ? current : worst
        );
        chumpionsByYear[year] = chumpion.name_id;
      }
    });

    // Check if current season is in progress
    const currentYearSeasonsLocal = seasonsByYear[mostRecentYear] || [];
    const currentSeasonInProgress = !currentYearSeasonsLocal.some(
      s => s.playoff_finish === 1
    );

    // Aggregate stats for each manager
    teamSeasons.forEach(season => {
      if (records[season.name_id]) {
        const record = records[season.name_id];
        record.totalWins += season.wins;
        record.totalLosses += season.losses;
        record.totalPointsFor += season.points_for;
        record.totalPointsAgainst += season.points_against;
        record.totalPayout += season.payout || 0;

        const isCurrentIncomplete =
          season.year === mostRecentYear && currentSeasonInProgress;
        record.totalDues += isCurrentIncomplete ? 0 : (season.dues || 250);
        record.totalDuesChumpion += isCurrentIncomplete
          ? 0
          : (season.dues_chumpion || 0);
        record.seasons += 1;
        record.gamesPlayed += (season.wins + season.losses);

        if (season.playoff_finish === 1) record.championships += 1;
        if (season.playoff_finish === 2) record.secondPlace += 1;
        if (season.playoff_finish === 3) record.thirdPlace += 1;

        if (chumpionsByYear[season.year] === season.name_id) {
          record.chumpionships += 1;
          record.chumpionYears.push(season.year);
        }

        if (season.regular_season_rank && season.regular_season_rank <= 6) {
          record.playoffAppearances += 1;
        }

        const winPct = season.wins / (season.wins + season.losses);
        if (!record.bestRecord || winPct > record.bestRecord.pct) {
          record.bestRecord = { wins: season.wins, losses: season.losses, pct: winPct, year: season.year };
        }
        if (!record.worstRecord || winPct < record.worstRecord.pct) {
          record.worstRecord = { wins: season.wins, losses: season.losses, pct: winPct, year: season.year };
        }

        if (season.points_for > record.highestSeasonPoints) {
          record.highestSeasonPoints = season.points_for;
          record.highestSeasonYear = season.year;
        }
        if (season.high_game && season.high_game > record.highestGamePoints) {
          record.highestGamePoints = season.high_game;
          record.highestGameYear = season.year;
        }
        if (season.points_against > record.mostPointsAgainst) {
          record.mostPointsAgainst = season.points_against;
          record.mostPointsAgainstYear = season.year;
        }
      }
    });

    // Calculate derived stats
    Object.values(records).forEach(record => {
      record.winPct = record.gamesPlayed > 0 ? record.totalWins / (record.totalWins + record.totalLosses) : 0;
      record.pointsPerGame = record.gamesPlayed > 0 ? record.totalPointsFor / record.gamesPlayed : 0;
      record.netEarnings = record.totalPayout - record.totalDues - record.totalDuesChumpion;
      record.totalMedals = record.championships + record.secondPlace + record.thirdPlace;
      record.chumpionYears.sort((a, b) => a - b);
    });

    return records;
  }, [managers, teamSeasons, mostRecentYear]);

  // Calculate rankings
  const medalRankings = useMemo(() => {
    return Object.values(allRecords)
      .filter(record => record.totalMedals > 0)
      .sort((a, b) => {
        if (b.championships !== a.championships) return b.championships - a.championships;
        if (b.secondPlace !== a.secondPlace) return b.secondPlace - a.secondPlace;
        if (b.thirdPlace !== a.thirdPlace) return b.thirdPlace - a.thirdPlace;
        return b.pointsPerGame - a.pointsPerGame;
      });
  }, [allRecords]);

  const chumpionRankings = useMemo(() => {
    return Object.values(allRecords)
      .filter(record => record.chumpionships > 0) // Only show managers with at least 1 chumpionship
      .sort((a, b) => {
        if (b.chumpionships !== a.chumpionships) return b.chumpionships - a.chumpionships;
        return a.name.localeCompare(b.name);
      });
  }, [allRecords]);

  const winPctRankings = useMemo(() => {
    return Object.values(allRecords)
      .filter(record => record.gamesPlayed > 0)
      .sort((a, b) => {
        // Sort inactive managers to the bottom
        if (a.active !== b.active) {
          return b.active ? 1 : -1; // Active (true) comes before inactive (false)
        }
        // Then sort by win percentage
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        return b.gamesPlayed - a.gamesPlayed;
      });
  }, [allRecords]);

  const ppgRankings = useMemo(() => {
    return Object.values(allRecords)
      .filter(record => record.gamesPlayed > 0)
      .sort((a, b) => {
        // Sort inactive managers to the bottom
        if (a.active !== b.active) {
          return b.active ? 1 : -1; // Active (true) comes before inactive (false)
        }
        // Then sort by points per game
        return b.pointsPerGame - a.pointsPerGame;
      });
  }, [allRecords]);

  // Calculate current year chumpion dues
  const getCurrentYearChumpionDues = () => {
    if (!mostRecentYear || !currentSeasonComplete) return 0;

    const seasons = teamSeasons.filter(s => s.year === mostRecentYear);
    const currentChumpionSeason = seasons.reduce(
      (worst, current) =>
        !worst || current.regular_season_rank > worst.regular_season_rank
          ? current
          : worst,
      null
    );
    return currentChumpionSeason?.dues_chumpion || 0;
  };

  return {
    allRecords,
    mostRecentYear,
    currentChampion,
    currentChumpion,
    currentYearSeasons,
    medalRankings,
    chumpionRankings,
    winPctRankings,
    ppgRankings,
    getCurrentYearChumpionDues,
    loading,
    error
  };
}
