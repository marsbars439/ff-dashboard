import { useEffect, useMemo, useState } from 'react';
import { Sparkles, RefreshCcw, Flame, BarChart3, GitBranch } from 'lucide-react';
import DashboardSection from '../../../components/DashboardSection';
import { ErrorMessage, SkeletonCard } from '../../../shared/components';
import { useManagers } from '../../../hooks/useManagers';
import { useTeamSeasons } from '../../../hooks/useTeamSeasons';
import { useSeasonMatchups } from '../hooks/useSeasonMatchups';
import { FANTASY } from '../../../utils/constants';

const normalizePoints = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : null;
};

const formatRecord = (team) => {
  const ties = team.ties || 0;
  return `${team.wins}-${team.losses}${ties ? `-${ties}` : ''}`;
};

const formatDelta = (delta) => {
  if (!delta) return '';
  return delta > 0 ? `+${delta}` : `${delta}`;
};

const buildMatchupKey = (week, matchup, idx) => {
  if (matchup?.matchup_id != null) {
    return `${week}-${matchup.matchup_id}`;
  }
  const homeIdPart = matchup?.home?.roster_id ?? matchup?.home?.team_name ?? 'home';
  const awayIdPart = matchup?.away?.roster_id ?? matchup?.away?.team_name ?? 'away';
  return `${week}-${homeIdPart}-${awayIdPart}-${idx}`;
};

const resolveManagerId = (team, managerNameToId) => {
  if (!team) return null;
  if (team.name_id) return team.name_id;
  const managerName = team.manager_name || team.managerName || team.manager;
  if (!managerName) return null;
  return managerNameToId.get(managerName) || null;
};

const MatchupCard = ({ matchup, prediction, onScoreChange, className = '' }) => {
  const homeScoreValue = prediction?.homeScore ?? '';
  const awayScoreValue = prediction?.awayScore ?? '';
  const parsedHome = normalizePoints(homeScoreValue);
  const parsedAway = normalizePoints(awayScoreValue);
  const homeLeads = parsedHome !== null && parsedAway !== null && parsedHome > parsedAway;
  const awayLeads = parsedHome !== null && parsedAway !== null && parsedAway > parsedHome;

  const renderTeamInput = (side) => {
    const isHome = side === 'home';
    const team = isHome ? matchup.home : matchup.away;
    const value = isHome ? homeScoreValue : awayScoreValue;
    const currentPoints = isHome ? matchup.currentHomePoints : matchup.currentAwayPoints;
    const isWinner = isHome ? homeLeads : awayLeads;

    return (
      <div className={`p-1.5 sm:p-3 flex flex-col gap-1 sm:gap-1.5 ${isWinner ? 'bg-emerald-600' : ''}`}>
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] sm:text-sm font-medium truncate ${isWinner ? 'text-white' : 'text-gray-900'}`}>
              {team.managerName || 'TBD'}
            </p>
            {team.teamName && (
              <p className={`text-[10px] sm:text-xs mt-0 sm:mt-1 truncate ${isWinner ? 'text-white/80' : 'text-gray-500'}`}>
                {team.teamName}
              </p>
            )}
          </div>
          {isWinner && (
            <span className="text-[10px] sm:text-[11px] font-semibold text-white flex-shrink-0">Win</span>
          )}
        </div>
        <input
          type="number"
          min="0"
          step="0.1"
          value={value}
          placeholder={currentPoints !== null ? currentPoints.toFixed(1) : 'Points'}
          onChange={(e) => onScoreChange(matchup.key, isHome ? 'homeScore' : 'awayScore', e.target.value)}
          className={`w-full rounded-md border px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 ${
            isWinner
              ? 'border-white/30 bg-white/10 text-white placeholder-white/60 focus:border-white/50 focus:ring-white/20'
              : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-emerald-500/30'
          }`}
        />
      </div>
    );
  };

  return (
    <div className={`rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm w-full ${className}`}>
      {matchup.unmapped && (
        <div className="flex justify-end px-1.5 pt-1.5 sm:px-3 sm:pt-2">
          <span className="rounded-full border border-amber-400/60 bg-amber-50 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-amber-700">
            Not in standings
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 divide-x divide-gray-200">
        {renderTeamInput('home')}
        {renderTeamInput('away')}
      </div>
    </div>
  );
};

const ProjectedStandingsTable = ({ standings, playoffIds, wildcardId, byeIds, chumpionId, firstPlaceId, highestPfIds }) => (
  <div className="card-primary space-y-2 sm:space-y-3">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
      <h3 className="text-base sm:text-lg font-bold text-slate-50 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-300" />
        <span>Projected Standings</span>
      </h3>
      <p className="text-[10px] sm:text-[11px] text-slate-300">Includes simulated results</p>
    </div>
    <div className="w-full overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
      <table className="w-full text-[10px] sm:text-xs md:text-sm table-auto">
        <thead className="text-slate-300 border-b border-slate-700/40">
          <tr>
            <th className="text-left py-1.5 sm:py-2 pr-2 sm:pr-3 font-semibold">Rank</th>
            <th className="text-left py-1.5 sm:py-2 pr-2 sm:pr-3 font-semibold">Manager</th>
            <th className="text-left py-1.5 sm:py-2 pr-2 sm:pr-3 font-semibold">Record</th>
            <th className="text-left py-1.5 sm:py-2 pr-2 sm:pr-3 font-semibold">PF</th>
            <th className="text-left py-1.5 sm:py-2 pr-2 sm:pr-3 font-semibold hidden sm:table-cell">PA</th>
            <th className="text-left py-1.5 sm:py-2 font-semibold hidden md:table-cell">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {standings.map((team) => {
            const inPlayoffs = playoffIds.has(team.id);
            const isWildcard = wildcardId && team.id === wildcardId;
            const hasBye = byeIds?.has?.(team.id);
            const isChumpion = chumpionId && team.id === chumpionId;
            const changeBits = [];
            if (team.deltaWins) changeBits.push(`${formatDelta(team.deltaWins)} W`);
            if (team.deltaLosses) changeBits.push(`${formatDelta(team.deltaLosses)} L`);
            const pfDeltaRounded = Math.round(team.deltaPointsFor);
            if (pfDeltaRounded) changeBits.push(`${formatDelta(pfDeltaRounded)} PF`);
            const isFirstPlace = firstPlaceId && team.id === firstPlaceId;
            const hasHighestPf = highestPfIds?.has?.(team.id);
            const payoutReasons = [];
            if (isFirstPlace) payoutReasons.push('1st');
            if (hasHighestPf) payoutReasons.push('PF');
            const payoutAmount = payoutReasons.length * 300;
            const payoutLabel = payoutAmount ? `+$${payoutAmount}` : '';
            const payoutDetail = payoutReasons.length === 2 ? '1st + PF' : payoutReasons[0];

            return (
              <tr
                key={team.id}
                className={`${inPlayoffs ? 'bg-emerald-500/5' : ''} ${isWildcard ? 'bg-amber-500/10' : ''}`}
              >
                <td className="py-1.5 sm:py-2 pr-2 sm:pr-3 text-slate-50 font-semibold">{team.rank}</td>
                <td className="py-1.5 sm:py-2 pr-2 sm:pr-3">
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    <span className="text-slate-50 font-semibold truncate">{team.managerName}</span>
                    {hasBye && (
                      <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-emerald-100">
                        Bye
                      </span>
                    )}
                    {isWildcard && (
                      <span className="rounded-full border border-amber-400/60 bg-amber-500/10 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-amber-100">
                        Wildcard
                      </span>
                    )}
                    {isChumpion && (
                      <span className="rounded-full border border-red-400/60 bg-red-500/10 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-red-200">
                        Chump
                      </span>
                    )}
                    {payoutAmount > 0 && (
                      <span className="rounded-full border border-lime-300/60 bg-lime-500/10 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-lime-50">
                        {payoutDetail ? `${payoutLabel} ${payoutDetail}` : payoutLabel}
                      </span>
                    )}
                  </div>
                  {team.teamName && (
                    <p className="text-[9px] sm:text-[11px] text-slate-400 truncate">{team.teamName}</p>
                  )}
                </td>
                <td className="py-1.5 sm:py-2 pr-2 sm:pr-3 text-slate-100 whitespace-nowrap">{formatRecord(team)}</td>
                <td className="py-1.5 sm:py-2 pr-2 sm:pr-3 text-slate-100">{team.pointsFor.toFixed(1)}</td>
                <td className="py-1.5 sm:py-2 pr-2 sm:pr-3 text-slate-100 hidden sm:table-cell">{team.pointsAgainst.toFixed(1)}</td>
                <td className="py-1.5 sm:py-2 text-slate-200 hidden md:table-cell">
                  {changeBits.length > 0 ? changeBits.join(', ') : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const ProjectedBracket = ({ seeds }) => {
  const getSeed = (n) => seeds.find((s) => s.seed === n) || null;
  const seed1 = getSeed(1);
  const seed2 = getSeed(2);
  const seed3 = getSeed(3);
  const seed4 = getSeed(4);
  const seed5 = getSeed(5);
  const seed6 = getSeed(6);

  const MatchupBox = ({ topSeed, bottomSeed, topPlaceholder, bottomPlaceholder }) => {
    const topName = topSeed ? topSeed.managerName : (topPlaceholder || 'TBD');
    const topSeedLabel = topSeed ? `Seed ${topSeed.seed}` : topPlaceholder ? topPlaceholder : '';
    const bottomName = bottomSeed ? bottomSeed.managerName : (bottomPlaceholder || 'TBD');
    const bottomSeedLabel = bottomSeed ? `Seed ${bottomSeed.seed}` : bottomPlaceholder ? bottomPlaceholder : '';

    const topMuted = !topSeed;
    const bottomMuted = !bottomSeed;

    return (
      <div className="rounded-md border border-slate-700/40 bg-slate-900/30 px-2 sm:px-3 py-1.5 sm:py-2 space-y-1">
        <div className="space-y-1">
          <div className="rounded border border-slate-700/40 bg-slate-900/50 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs flex justify-between items-center gap-1">
            <span className={`font-semibold truncate ${topMuted ? 'text-slate-400' : 'text-slate-50'}`}>{topName}</span>
            <span className="text-[9px] sm:text-[10px] text-slate-300 whitespace-nowrap flex-shrink-0">{topSeedLabel}</span>
          </div>
          <div className="rounded border border-slate-700/40 bg-slate-900/50 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs flex justify-between items-center gap-1">
            <span className={`font-semibold truncate ${bottomMuted ? 'text-slate-400' : 'text-slate-50'}`}>{bottomName}</span>
            <span className="text-[9px] sm:text-[10px] text-slate-300 whitespace-nowrap flex-shrink-0">{bottomSeedLabel}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="card-primary space-y-2 sm:space-y-3">
      <h3 className="text-base sm:text-lg font-bold text-slate-50 flex items-center gap-2">
        <GitBranch className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300" />
        <span>Projected Bracket</span>
      </h3>

      {/* Mobile: Stacked view */}
      <div className="space-y-2 lg:hidden">
        <div>
          <p className="text-xs font-semibold text-slate-300 mb-1.5">First Round</p>
          <div className="space-y-1.5">
            <MatchupBox topSeed={seed1} bottomSeed={null} bottomPlaceholder="Bye" />
            <MatchupBox topSeed={seed4} bottomSeed={seed5} />
            <MatchupBox topSeed={seed2} bottomSeed={null} bottomPlaceholder="Bye" />
            <MatchupBox topSeed={seed6} bottomSeed={seed3} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-300 mb-1.5">Semifinals</p>
          <div className="space-y-1.5">
            <MatchupBox topSeed={seed1} bottomSeed={null} topPlaceholder="Seed 1" bottomPlaceholder="Winner 4/5" />
            <MatchupBox topSeed={seed2} bottomSeed={null} topPlaceholder="Seed 2" bottomPlaceholder="Winner 3/6" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-300 mb-1.5">Championship</p>
          <MatchupBox topSeed={null} bottomSeed={null} topPlaceholder="Winner Semis" bottomPlaceholder="Winner Semis" />
        </div>
      </div>

      {/* Desktop: Grid view */}
      <div className="hidden lg:block">
        <div className="flex items-center gap-3">
          {/* Round 1 */}
          <div className="flex-1 flex flex-col justify-center gap-3">
            <MatchupBox topSeed={seed1} bottomSeed={null} bottomPlaceholder="Bye" />
            <MatchupBox topSeed={seed4} bottomSeed={seed5} />
            <MatchupBox topSeed={seed2} bottomSeed={null} bottomPlaceholder="Bye" />
            <MatchupBox topSeed={seed6} bottomSeed={seed3} />
          </div>

          {/* Semifinals */}
          <div className="flex-1 flex flex-col justify-center gap-6">
            <MatchupBox topSeed={seed1} bottomSeed={null} topPlaceholder="Seed 1" bottomPlaceholder="Winner 4/5" />
            <MatchupBox topSeed={seed2} bottomSeed={null} topPlaceholder="Seed 2" bottomPlaceholder="Winner 3/6" />
          </div>

          {/* Final */}
          <div className="flex-1 flex flex-col justify-center">
            <MatchupBox topSeed={null} bottomSeed={null} topPlaceholder="Winner Semis" bottomPlaceholder="Winner Semis" />
          </div>
        </div>
      </div>
    </div>
  );
};

const PlayoffSimulator = () => {
  const { managers, loading: managersLoading, error: managersError } = useManagers();
  const { teamSeasons, loading: seasonsLoading, error: seasonsError } = useTeamSeasons();

  const mostRecentYear = useMemo(() => {
    if (teamSeasons.length === 0) return null;
    return Math.max(...teamSeasons.map((s) => s.year));
  }, [teamSeasons]);

  const {
    matchups: seasonMatchups,
    loading: matchupsLoading,
    error: matchupsError
  } = useSeasonMatchups(mostRecentYear);

  const [predictions, setPredictions] = useState({});

  const managerNameToId = useMemo(() => {
    const map = new Map();
    managers.forEach((manager) => {
      if (manager.full_name && manager.name_id) {
        map.set(manager.full_name, manager.name_id);
      }
    });
    teamSeasons
      .filter((season) => season.year === mostRecentYear)
      .forEach((season) => {
        if (season.manager_name && season.name_id) {
          map.set(season.manager_name, season.name_id);
        }
      });
    return map;
  }, [managers, teamSeasons, mostRecentYear]);

  const baseEntries = useMemo(() => {
    return teamSeasons
      .filter((season) => season.year === mostRecentYear)
      .map((season) => {
        const wins = Number(season.wins) || 0;
        const losses = Number(season.losses) || 0;
        const ties = Number(season.ties) || 0;
        const pointsFor = Number(season.points_for) || 0;
        const pointsAgainst = Number(season.points_against) || 0;
        return {
          id: season.name_id,
          managerName: season.manager_name || managers.find((m) => m.name_id === season.name_id)?.full_name || 'Unknown',
          teamName: season.team_name || '',
          wins,
          losses,
          ties,
          pointsFor,
          pointsAgainst,
          games: wins + losses + ties,
          winPct: wins + losses + ties > 0 ? (wins + 0.5 * ties) / (wins + losses + ties) : 0
        };
      });
  }, [teamSeasons, mostRecentYear, managers]);

  const baseLookup = useMemo(() => {
    return baseEntries.reduce((acc, team) => {
      acc[team.id] = team;
      return acc;
    }, {});
  }, [baseEntries]);

  const lastCompletedWeek = useMemo(() => {
    if (baseEntries.length === 0) return 0;
    return Math.max(...baseEntries.map((t) => t.games));
  }, [baseEntries]);

  const regularSeasonWeeks = useMemo(() => {
    if (!Array.isArray(seasonMatchups) || seasonMatchups.length === 0) {
      return FANTASY.REGULAR_SEASON_WEEKS;
    }
    return Math.max(...seasonMatchups.map((week) => week.week || 0), FANTASY.REGULAR_SEASON_WEEKS);
  }, [seasonMatchups]);

  const upcomingWeeks = useMemo(() => {
    if (!Array.isArray(seasonMatchups)) return [];
    return seasonMatchups
      .filter((week) => Number(week.week) > lastCompletedWeek)
      .sort((a, b) => a.week - b.week);
  }, [seasonMatchups, lastCompletedWeek]);

  const simulatableMatchups = useMemo(() => {
    const future = [];
    upcomingWeeks.forEach((week) => {
      (week.matchups || []).forEach((matchup, idx) => {
        const homeId = resolveManagerId(matchup.home, managerNameToId);
        const awayId = resolveManagerId(matchup.away, managerNameToId);
        future.push({
          key: buildMatchupKey(week.week, matchup, idx),
          week: week.week,
          home: {
            id: homeId,
            managerName: matchup.home?.manager_name || matchup.home?.managerName || matchup.home?.manager || 'Home',
            teamName: matchup.home?.team_name || matchup.home?.teamName || ''
          },
          away: {
            id: awayId,
            managerName: matchup.away?.manager_name || matchup.away?.managerName || matchup.away?.manager || 'Away',
            teamName: matchup.away?.team_name || matchup.away?.teamName || ''
          },
          currentHomePoints: normalizePoints(matchup.home?.points),
          currentAwayPoints: normalizePoints(matchup.away?.points),
          unmapped: !homeId || !awayId
        });
      });
    });
    return future;
  }, [upcomingWeeks, managerNameToId]);

  const mappableMatchups = useMemo(
    () => simulatableMatchups.filter((matchup) => matchup.home.id && matchup.away.id),
    [simulatableMatchups]
  );

  const projectedStandings = useMemo(() => {
    if (baseEntries.length === 0) return [];

    const working = baseEntries.reduce((acc, team) => {
      acc[team.id] = { ...team };
      return acc;
    }, {});

    mappableMatchups.forEach((matchup) => {
      const pick = predictions[matchup.key];
      const homeScore = normalizePoints(pick?.homeScore);
      const awayScore = normalizePoints(pick?.awayScore);
      if (homeScore === null || awayScore === null) return;

      const home = working[matchup.home.id];
      const away = working[matchup.away.id];
      if (!home || !away) return;

      home.pointsFor += homeScore;
      home.pointsAgainst += awayScore;
      away.pointsFor += awayScore;
      away.pointsAgainst += homeScore;

      if (homeScore > awayScore) {
        home.wins += 1;
        away.losses += 1;
      } else if (awayScore > homeScore) {
        away.wins += 1;
        home.losses += 1;
      } else {
        home.ties += 1;
        away.ties += 1;
      }
    });

    return Object.values(working)
      .map((team) => {
        const games = team.wins + team.losses + team.ties;
        const winPct = games > 0 ? (team.wins + 0.5 * team.ties) / games : 0;
        const base = baseLookup[team.id];
        return {
          ...team,
          games,
          winPct,
          deltaWins: team.wins - (base?.wins ?? 0),
          deltaLosses: team.losses - (base?.losses ?? 0),
          deltaPointsFor: team.pointsFor - (base?.pointsFor ?? 0)
        };
      })
      .sort((a, b) => {
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
        return a.managerName.localeCompare(b.managerName);
      })
      .map((team, idx) => ({ ...team, rank: idx + 1 }));
  }, [baseEntries, baseLookup, mappableMatchups, predictions]);

  const playoffSeeds = useMemo(() => {
    if (projectedStandings.length === 0) {
      return { seeds: [], playoffIds: new Set(), wildcardId: null };
    }

    const topFive = projectedStandings.slice(0, 5);
    const wildcardPool = projectedStandings.slice(5, 10);
    const wildcard = [...wildcardPool].sort((a, b) => {
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return a.managerName.localeCompare(b.managerName);
    })[0];

    const seeds = topFive.map((team, idx) => ({
      ...team,
      seed: idx + 1,
      isWildcard: false
    }));

    if (wildcard && !seeds.some((seed) => seed.id === wildcard.id)) {
      seeds.push({ ...wildcard, seed: 6, isWildcard: true });
    }

    const wildcardSeed = seeds.find((seed) => seed.isWildcard) || null;

    return {
      seeds,
      playoffIds: new Set(seeds.map((seed) => seed.id)),
      wildcardId: wildcardSeed ? wildcardSeed.id : null
    };
  }, [projectedStandings]);

  const byeIds = useMemo(() => {
    const ids = new Set();
    playoffSeeds.seeds.forEach((seed) => {
      if (seed.seed === 1 || seed.seed === 2) {
        ids.add(seed.id);
      }
    });
    return ids;
  }, [playoffSeeds]);

  const chumpionId = useMemo(
    () => (projectedStandings.length > 0 ? projectedStandings[projectedStandings.length - 1].id : null),
    [projectedStandings]
  );

  const firstPlaceId = useMemo(
    () => (projectedStandings.length > 0 ? projectedStandings[0].id : null),
    [projectedStandings]
  );

  const highestPfIds = useMemo(() => {
    if (projectedStandings.length === 0) return new Set();
    const topPointsFor = Math.max(...projectedStandings.map((team) => team.pointsFor));
    return new Set(projectedStandings.filter((team) => team.pointsFor === topPointsFor).map((team) => team.id));
  }, [projectedStandings]);

  const teamAverages = useMemo(() => {
    return baseEntries.reduce((acc, team) => {
      const games = team.games || 0;
      const ppg = games > 0 ? team.pointsFor / games : null;
      acc[team.id] = Number.isFinite(ppg) ? ppg : null;
      return acc;
    }, {});
  }, [baseEntries]);

  const loading = managersLoading || seasonsLoading || matchupsLoading;
  const error = managersError || seasonsError || matchupsError;

  const buildDefaultPredictions = useMemo(() => {
    return () => {
      const defaults = {};
      simulatableMatchups.forEach((matchup) => {
        const homeAvg = matchup.home.id ? teamAverages[matchup.home.id] : null;
        const awayAvg = matchup.away.id ? teamAverages[matchup.away.id] : null;
        defaults[matchup.key] = {
          homeScore: homeAvg !== null ? Number(homeAvg.toFixed(1)) : '',
          awayScore: awayAvg !== null ? Number(awayAvg.toFixed(1)) : ''
        };
      });
      return defaults;
    };
  }, [simulatableMatchups, teamAverages]);

  const handleScoreChange = (key, side, value) => {
    setPredictions((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [side]: value === '' ? '' : normalizePoints(value)
      }
    }));
  };

  const handleReset = () => setPredictions(buildDefaultPredictions());

  useEffect(() => {
    if (simulatableMatchups.length === 0) return;
    setPredictions(buildDefaultPredictions());
  }, [simulatableMatchups, teamAverages, buildDefaultPredictions]);

  if (loading) {
    return (
      <DashboardSection
        title="Playoff Simulator"
        description="Pick winners and scores for remaining weeks to project playoff berths."
        icon={Sparkles}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </DashboardSection>
    );
  }

  if (error) {
    return <ErrorMessage message={`Unable to load simulator data: ${error}`} />;
  }

  if (!mostRecentYear || baseEntries.length === 0) {
    return <ErrorMessage message="Season data is not available yet for the simulator." />;
  }

  const gamesRemaining = simulatableMatchups.length;
  const unmappedCount = simulatableMatchups.length - mappableMatchups.length;
  const simulationStartWeek = Math.min(lastCompletedWeek + 1, regularSeasonWeeks);
  const simulationEndWeek = upcomingWeeks.length > 0
    ? Math.max(...upcomingWeeks.map((w) => Number(w.week) || simulationStartWeek))
    : simulationStartWeek;
  const simulationLabel = simulationStartWeek === simulationEndWeek
    ? `Simulating week ${simulationStartWeek}`
    : `Simulating weeks ${simulationStartWeek}-${simulationEndWeek}`;

  return (
    <DashboardSection
      title="Playoff Simulator"
      description="Select winners and scores for current and future weeks to see playoff projections update instantly."
      icon={Sparkles}
      bodyClassName="space-y-2 sm:space-y-4"
    >
      <div className="card-primary space-y-2">
        <h3 className="text-base sm:text-lg font-bold text-slate-50 flex items-center gap-2">
          <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
          <span>How it works</span>
        </h3>
        <ul className="space-y-0.5 sm:space-y-1 text-xs sm:text-[13px] text-slate-200 list-disc list-inside">
          <li>Each matchup starts with both teams' season PPG; adjust scores to explore scenarios.</li>
          <li>Standings update immediately with each score you add.</li>
          <li>Seeds 1-5 are by record; seed 6 goes to the PF leader among ranks 6-10.</li>
        </ul>
        {unmappedCount > 0 && (
          <p className="text-[10px] sm:text-[11px] text-amber-200">
            {unmappedCount} matchup(s) are missing a standings mapping and are excluded from calculations.
          </p>
        )}
      </div>

      <div className="card-primary space-y-2 sm:space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-50">Matchups</h3>
              <p className="text-[10px] sm:text-[11px] text-slate-300">
                {simulationLabel} ({gamesRemaining} games remaining)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg border border-slate-400/40 bg-slate-900/60 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-100 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/60"
          >
            <RefreshCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Reset picks</span>
          </button>
        </div>
        {upcomingWeeks.length === 0 ? (
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5 sm:p-3">
            <p className="text-xs sm:text-sm text-slate-200">Regular season is complete. No matchups left to simulate.</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {upcomingWeeks.map((week) => {
              const weekMatchups = simulatableMatchups.filter((m) => m.week === week.week);
              return (
                <div key={week.week} className="space-y-1.5">
                  <div className="flex items-center justify-between px-0.5 sm:px-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-50">Week {week.week}</h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-300">
                      {weekMatchups.filter((m) => !m.unmapped).length} of {weekMatchups.length} matchups
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
                    {weekMatchups.map((matchup) => (
                      <MatchupCard
                        key={matchup.key}
                        matchup={matchup}
                        prediction={predictions[matchup.key]}
                        onScoreChange={handleScoreChange}
                        className="w-full sm:w-[calc(50%-0.25rem)] lg:w-[calc(33.333%-0.375rem)]"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
        <ProjectedStandingsTable
          standings={projectedStandings}
          playoffIds={playoffSeeds.playoffIds}
          wildcardId={playoffSeeds.wildcardId}
          byeIds={byeIds}
          chumpionId={chumpionId}
          firstPlaceId={firstPlaceId}
          highestPfIds={highestPfIds}
        />
        <ProjectedBracket seeds={playoffSeeds.seeds} />
      </div>
    </DashboardSection>
  );
};

export default PlayoffSimulator;
