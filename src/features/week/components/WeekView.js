import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import AISummary from '../../../components/AISummary';
import AIPreview from '../../../components/AIPreview';
import DashboardSection from '../../../components/DashboardSection';
import { parseFlexibleTimestamp, formatInUserTimeZone } from '../../../utils/date';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api');
const ACTIVE_WEEK_REFRESH_INTERVAL_MS = 30000;
const GAME_COMPLETION_BUFFER_MS = 4.5 * 60 * 60 * 1000;

// Utility functions
const normalizePoints = value => {
  if (value === null || value === undefined) {
    return null;
  }
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(num)) {
    return null;
  }
  return num;
};

const formatPoints = value => {
  const num = normalizePoints(value);
  if (num === null) {
    return '--';
  }
  const rounded = Math.round(num * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
};

export function WeekView({ teamSeasons }) {
  const [activeWeekMatchups, setActiveWeekMatchups] = useState(null);
  const [activeWeekLoading, setActiveWeekLoading] = useState(false);
  const [activeWeekError, setActiveWeekError] = useState(null);
  const [expandedMatchups, setExpandedMatchups] = useState({});
  const hasLoadedActiveWeekRef = useRef(false);

  const mostRecentYear = useMemo(() => (
    teamSeasons.length > 0
      ? Math.max(...teamSeasons.map(s => s.year))
      : new Date().getFullYear()
  ), [teamSeasons]);

  const lastCompletedWeek = useMemo(() => {
    const seasons = teamSeasons.filter(s => s.year === mostRecentYear);
    if (seasons.length === 0) return 0;
    return Math.max(
      ...seasons.map(s => s.wins + s.losses + (s.ties || 0))
    );
  }, [teamSeasons, mostRecentYear]);

  const currentWeekNumber = activeWeekMatchups?.week ?? lastCompletedWeek + 1;

  // Active week logic
  useEffect(() => {
    let isCancelled = false;
    let intervalId = null;
    let isFetching = false;

    const fetchActiveWeekMatchups = async (forceLoading = false) => {
      if (isCancelled || isFetching) {
        return;
      }

      isFetching = true;

      try {
        if (forceLoading || !hasLoadedActiveWeekRef.current) {
          setActiveWeekLoading(true);
        }
        setActiveWeekError(null);
        const response = await fetch(`${API_BASE_URL}/seasons/${mostRecentYear}/active-week/matchups`);
        if (!response.ok) {
          throw new Error('Failed to fetch active week matchups');
        }
        const data = await response.json();
        if (isCancelled) {
          return;
        }
        setActiveWeekMatchups(prev => {
          if (!prev || prev.week !== data.week) {
            setExpandedMatchups({});
          }
          return data;
        });
        hasLoadedActiveWeekRef.current = true;
      } catch (err) {
        console.error('Error fetching active week matchups:', err);
        if (isCancelled) {
          return;
        }
        setActiveWeekError('Unable to load starting lineups from Sleeper.');
        setActiveWeekMatchups(null);
        hasLoadedActiveWeekRef.current = false;
      } finally {
        if (!isCancelled) {
          setActiveWeekLoading(false);
        }
        isFetching = false;
      }
    };

    fetchActiveWeekMatchups(!hasLoadedActiveWeekRef.current);

    intervalId = setInterval(() => {
      fetchActiveWeekMatchups(false);
    }, ACTIVE_WEEK_REFRESH_INTERVAL_MS);

    return () => {
      isCancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [mostRecentYear]);

  const toggleMatchupExpansion = matchupKey => {
    setExpandedMatchups(prev => ({
      ...prev,
      [matchupKey]: !prev[matchupKey]
    }));
  };

  const parseTimestamp = value => parseFlexibleTimestamp(value);

  const formatKickoffTime = kickoff => {
    const timestamp = parseFlexibleTimestamp(kickoff);
    if (!timestamp) {
      return null;
    }
    return formatInUserTimeZone(timestamp, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getOpponentLabel = starter => {
    if (!starter?.opponent) {
      return null;
    }
    const prefix = starter.home_away === 'home' ? 'vs' : '@';
    return `${prefix} ${starter.opponent}`;
  };

  const playerActivityStyles = {
    live: {
      key: 'live',
      label: 'In Progress',
      description: 'Game currently in progress.',
      badgeClasses: 'border-amber-200 bg-amber-50 text-amber-700',
      dotClasses: 'bg-amber-500',
      rowClasses: 'bg-amber-50/40'
    },
    upcoming: {
      key: 'upcoming',
      label: 'Not Started',
      description: 'Game has not kicked off yet.',
      badgeClasses: 'border-sky-200 bg-sky-50 text-sky-700',
      dotClasses: 'bg-sky-500',
      rowClasses: 'bg-sky-50/40'
    },
    finished: {
      key: 'finished',
      label: '',
      summaryLabel: 'Finished',
      description: 'Game has concluded.',
      badgeClasses: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      dotClasses: 'bg-emerald-500',
      rowClasses: 'bg-emerald-50/40',
      showBadge: false
    },
    inactive: {
      key: 'inactive',
      label: 'Inactive',
      description: 'Bye week, inactive, or no matchup this week.',
      badgeClasses: 'border-slate-200 bg-slate-50 text-slate-600',
      dotClasses: 'bg-slate-400',
      rowClasses: 'bg-slate-50/60'
    }
  };

  const getStarterActivityStatus = starter => {
    if (!starter) {
      return playerActivityStyles.inactive;
    }

    const now = Date.now();

    const kickoff = parseTimestamp(
      starter?.scoreboard_start ??
        starter?.game_start ??
        starter?.kickoff ??
        starter?.start_time ??
        starter?.startTime
    );
    const pointsValue = normalizePoints(starter.points);
    const statsAvailable = Boolean(starter?.stats_available);
    const scoreboardStatusRaw = (starter?.scoreboard_status || '')
      .toString()
      .toLowerCase()
      .trim();
    const scoreboardActivityKeyRaw = starter?.scoreboard_activity_key
      ? starter.scoreboard_activity_key.toString().toLowerCase().trim()
      : '';
    const scoreboardDetail = typeof starter?.scoreboard_detail === 'string'
      ? starter.scoreboard_detail.trim()
      : '';
    const rawStatusPieces = [
      starter?.game_status,
      starter?.raw_game_status,
      scoreboardDetail,
      scoreboardStatusRaw
    ].filter(Boolean);
    const rawStatus = rawStatusPieces
      .map(value => value.toString().toLowerCase().trim())
      .filter(Boolean)
      .join(' ');
    const normalizedBackendKey = starter.activity_key
      ? starter.activity_key.toString().toLowerCase().trim()
      : '';

    const isBye =
      starter.is_bye ||
      rawStatus.includes('bye') ||
      scoreboardStatusRaw.includes('bye') ||
      scoreboardActivityKeyRaw.includes('bye');
    if (isBye) {
      return playerActivityStyles.inactive;
    }

    let backendKey = null;
    if (normalizedBackendKey && playerActivityStyles[normalizedBackendKey]) {
      backendKey = normalizedBackendKey;
    } else if (normalizedBackendKey) {
      if (
        normalizedBackendKey.includes('live') ||
        normalizedBackendKey.includes('progress') ||
        normalizedBackendKey.includes('play')
      ) {
        backendKey = 'live';
      } else if (
        normalizedBackendKey.includes('final') ||
        normalizedBackendKey.includes('finish') ||
        normalizedBackendKey.includes('complete') ||
        normalizedBackendKey.includes('closed')
      ) {
        backendKey = 'finished';
      } else if (
        normalizedBackendKey.includes('inactive') ||
        normalizedBackendKey.includes('bye')
      ) {
        backendKey = 'inactive';
      } else if (
        normalizedBackendKey.includes('pre') ||
        normalizedBackendKey.includes('sched') ||
        normalizedBackendKey.includes('upcoming') ||
        normalizedBackendKey.includes('not_started')
      ) {
        backendKey = 'upcoming';
      }
    }

    if (!backendKey && scoreboardActivityKeyRaw && playerActivityStyles[scoreboardActivityKeyRaw]) {
      backendKey = scoreboardActivityKeyRaw;
    } else if (!backendKey && scoreboardActivityKeyRaw) {
      if (
        scoreboardActivityKeyRaw.includes('live') ||
        scoreboardActivityKeyRaw.includes('progress') ||
        scoreboardActivityKeyRaw.includes('play')
      ) {
        backendKey = 'live';
      } else if (
        scoreboardActivityKeyRaw.includes('final') ||
        scoreboardActivityKeyRaw.includes('finish') ||
        scoreboardActivityKeyRaw.includes('complete') ||
        scoreboardActivityKeyRaw.includes('closed')
      ) {
        backendKey = 'finished';
      } else if (
        scoreboardActivityKeyRaw.includes('inactive') ||
        scoreboardActivityKeyRaw.includes('bye')
      ) {
        backendKey = 'inactive';
      } else if (
        scoreboardActivityKeyRaw.includes('pre') ||
        scoreboardActivityKeyRaw.includes('sched') ||
        scoreboardActivityKeyRaw.includes('upcoming') ||
        scoreboardActivityKeyRaw.includes('not_started')
      ) {
        backendKey = 'upcoming';
      }
    }

    let rawStatusKey = null;
    if (rawStatus) {
      const liveRegex = /\b(q[1-4]|1st|2nd|3rd|4th|ot)\b/;
      if (
        rawStatus.includes('final') ||
        rawStatus.includes('post') ||
        rawStatus.includes('complete') ||
        rawStatus.includes('finished') ||
        rawStatus.includes('closed')
      ) {
        rawStatusKey = 'finished';
      } else if (
        rawStatus.includes('in_progress') ||
        rawStatus.includes('live') ||
        rawStatus.includes('playing') ||
        liveRegex.test(rawStatus) ||
        rawStatus.includes('half') ||
        rawStatus.includes('quarter')
      ) {
        rawStatusKey = 'live';
      } else if (
        rawStatus.includes('pre') ||
        rawStatus.includes('sched') ||
        rawStatus.includes('upcoming') ||
        rawStatus.includes('not_started')
      ) {
        rawStatusKey = 'upcoming';
      } else if (rawStatus.includes('bye')) {
        rawStatusKey = 'inactive';
      }
    }

    if (!rawStatusKey && scoreboardActivityKeyRaw) {
      if (
        scoreboardActivityKeyRaw.includes('live') ||
        scoreboardActivityKeyRaw.includes('progress') ||
        scoreboardActivityKeyRaw.includes('play')
      ) {
        rawStatusKey = 'live';
      } else if (
        scoreboardActivityKeyRaw.includes('final') ||
        scoreboardActivityKeyRaw.includes('finish') ||
        scoreboardActivityKeyRaw.includes('complete') ||
        scoreboardActivityKeyRaw.includes('closed')
      ) {
        rawStatusKey = 'finished';
      } else if (
        scoreboardActivityKeyRaw.includes('inactive') ||
        scoreboardActivityKeyRaw.includes('bye')
      ) {
        rawStatusKey = 'inactive';
      } else if (
        scoreboardActivityKeyRaw.includes('pre') ||
        scoreboardActivityKeyRaw.includes('sched') ||
        scoreboardActivityKeyRaw.includes('upcoming') ||
        scoreboardActivityKeyRaw.includes('not_started')
      ) {
        rawStatusKey = 'upcoming';
      }
    }

    if (rawStatusKey === 'inactive') {
      return playerActivityStyles.inactive;
    }

    let resolvedKey = null;
    if (rawStatusKey && playerActivityStyles[rawStatusKey]) {
      resolvedKey = rawStatusKey;
    }

    if (!resolvedKey && backendKey && playerActivityStyles[backendKey]) {
      resolvedKey = backendKey;
    }

    const hasKickoff = Number.isFinite(kickoff);
    const kickoffHasPassed = hasKickoff && kickoff <= now;
    const kickoffLikelyFinished = hasKickoff && now - kickoff >= GAME_COMPLETION_BUFFER_MS;
    const liveDetailRegex = /\b(q[1-4]|1st|2nd|3rd|4th|ot)\b/;
    const hasLiveDetail = liveDetailRegex.test(rawStatus) || rawStatus.includes('half') || rawStatus.includes('quarter');
    const hasFinishedDetail =
      rawStatus.includes('final') ||
      rawStatus.includes('post') ||
      rawStatus.includes('complete') ||
      rawStatus.includes('finished') ||
      rawStatus.includes('closed');

    const scoreboardHasFinished =
      scoreboardActivityKeyRaw === 'finished' ||
      scoreboardStatusRaw.includes('final') ||
      scoreboardStatusRaw.includes('complete') ||
      scoreboardStatusRaw.includes('post');
    const scoreboardHasLive =
      scoreboardActivityKeyRaw === 'live' ||
      scoreboardStatusRaw.includes('progress') ||
      scoreboardStatusRaw.includes('live') ||
      scoreboardStatusRaw.includes('playing');
    const scoreboardHasUpcoming =
      scoreboardActivityKeyRaw === 'upcoming' ||
      scoreboardStatusRaw.includes('pre') ||
      scoreboardStatusRaw.includes('sched') ||
      scoreboardStatusRaw.includes('upcoming');
    const scoreboardIsInactive =
      scoreboardActivityKeyRaw === 'inactive' ||
      scoreboardStatusRaw.includes('postpon') ||
      scoreboardStatusRaw.includes('cancel') ||
      scoreboardStatusRaw.includes('delay');

    const hasGameFinishedSignal = Boolean(
      scoreboardHasFinished ||
        (resolvedKey === 'finished' && playerActivityStyles[resolvedKey]) ||
        backendKey === 'finished' ||
        hasFinishedDetail ||
        kickoffLikelyFinished
    );

    const hasGameStartedSignal = Boolean(
      hasGameFinishedSignal ||
        resolvedKey === 'live' ||
        backendKey === 'live' ||
        scoreboardHasLive ||
        hasLiveDetail ||
        statsAvailable ||
        kickoffHasPassed ||
        pointsValue !== null
    );

    const hasGameUpcomingSignal = Boolean(
      resolvedKey === 'upcoming' ||
        backendKey === 'upcoming' ||
        scoreboardHasUpcoming ||
        (!hasGameStartedSignal && hasKickoff && kickoff > now)
    );

    if (!resolvedKey && hasGameFinishedSignal) {
      resolvedKey = 'finished';
    }

    if (!resolvedKey && hasGameStartedSignal) {
      resolvedKey = 'live';
    }

    if (!resolvedKey && hasGameUpcomingSignal) {
      resolvedKey = 'upcoming';
    }

    if (
      !resolvedKey &&
      scoreboardIsInactive &&
      !hasGameStartedSignal &&
      !hasGameFinishedSignal
    ) {
      resolvedKey = 'inactive';
    }

    if (!resolvedKey && pointsValue !== null) {
      if (hasGameFinishedSignal) {
        resolvedKey = 'finished';
      } else if (hasGameStartedSignal) {
        resolvedKey = 'live';
      } else {
        resolvedKey = 'upcoming';
      }
    }

    if (
      !resolvedKey &&
      (!starter.player_id || (!starter.team && !starter.opponent))
    ) {
      resolvedKey = 'inactive';
    }

    if (!resolvedKey) {
      resolvedKey = 'upcoming';
    }

    if (resolvedKey === 'live') {
      const hasAnyLiveIndicators = hasLiveDetail || scoreboardHasLive || scoreboardActivityKeyRaw === 'live';

      if (!hasAnyLiveIndicators) {
        if (kickoffLikelyFinished) {
          resolvedKey = 'finished';
        } else if (!hasKickoff && pointsValue !== null) {
          resolvedKey = 'finished';
        } else if (hasKickoff && kickoffHasPassed && !scoreboardHasUpcoming) {
          const timeSinceKickoff = now - kickoff;
          const minGameDuration = 3 * 60 * 60 * 1000;
          if (timeSinceKickoff >= minGameDuration) {
            resolvedKey = 'finished';
          }
        }
      }
    }

    return playerActivityStyles[resolvedKey] || playerActivityStyles.upcoming;
  };

  const buildTeamLineupData = team => {
    if (!team) {
      return {
        starters: [],
        startersWithStatus: [],
        statusCounts: {}
      };
    }

    const starters = Array.isArray(team.starters) ? team.starters : [];
    const startersWithStatus = starters.map(starter => {
      const statusMeta = getStarterActivityStatus(starter);
      return { starter, statusMeta };
    });
    const statusCounts = startersWithStatus.reduce((acc, { statusMeta }) => {
      if (!statusMeta?.key) {
        return acc;
      }
      acc[statusMeta.key] = (acc[statusMeta.key] || 0) + 1;
      return acc;
    }, {});

    return { starters, startersWithStatus, statusCounts };
  };

  const renderStatusPills = (statusCounts, size = 'md', options = {}) => {
    if (!statusCounts) {
      return null;
    }

    const live = statusCounts.live || 0;
    const upcoming = statusCounts.upcoming || 0;
    const remaining = live + upcoming;

    if (remaining === 0) {
      return null;
    }

    const baseClass =
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';

    return (
      <div className="flex justify-center">
        <span
          className={`inline-flex items-center gap-1 rounded-full border font-medium border-sky-200 bg-sky-50 text-sky-700 ${baseClass}`}
        >
          {remaining} Remaining
        </span>
      </div>
    );
  };

  const getStarterSecondaryInfo = (starter, statusMeta) => {
    const gameInfo = [];
    let injuryInfo = null;

    const addGameInfo = value => {
      if (value === null || value === undefined) {
        return;
      }
      const text = value.toString().trim();
      if (!text) {
        return;
      }
      const exists = gameInfo.some(item => item.toLowerCase() === text.toLowerCase());
      if (!exists) {
        gameInfo.push(text);
      }
    };

    if (starter?.is_bye) {
      addGameInfo(
        starter?.bye_week != null && starter.bye_week !== ''
          ? `Bye Week ${starter.bye_week}`
          : 'Bye Week'
      );
      return { gameInfo, injuryInfo };
    }

    const opponentLabel = getOpponentLabel(starter);
    if (opponentLabel) {
      addGameInfo(opponentLabel);
    }

    if (statusMeta?.key === 'upcoming') {
      const kickoffLabel = formatKickoffTime(
        starter?.scoreboard_start ?? starter?.game_start
      );
      if (kickoffLabel) {
        addGameInfo(kickoffLabel);
      }
    }

    if (statusMeta?.key === 'live') {
      const detail =
        (typeof starter?.scoreboard_detail === 'string' && starter.scoreboard_detail) ||
        (typeof starter?.raw_game_status === 'string' && starter.raw_game_status) ||
        (typeof starter?.game_status === 'string' && starter.game_status);
      if (detail) {
        addGameInfo(detail.toUpperCase());
      }

      if (starter?.espn_stats?.stat_line) {
        addGameInfo(starter.espn_stats.stat_line);
      }
    }

    if (statusMeta?.key === 'finished') {
      if (starter?.espn_stats?.stat_line) {
        addGameInfo(starter.espn_stats.stat_line);
      }
    }

    const injury = starter?.injury_status;
    if (injury && typeof injury === 'string') {
      const trimmed = injury.trim();
      if (trimmed && trimmed.toLowerCase() !== 'n/a' && trimmed.toLowerCase() !== 'healthy') {
        injuryInfo = trimmed.toUpperCase();
      }
    } else {
      const practice = starter?.practice_status;
      if (practice && typeof practice === 'string') {
        const trimmedPractice = practice.trim();
        if (
          trimmedPractice &&
          trimmedPractice.toLowerCase() !== 'full' &&
          trimmedPractice.toLowerCase() !== 'na'
        ) {
          injuryInfo = trimmedPractice.toUpperCase();
        }
      }
    }

    return { gameInfo, injuryInfo };
  };

  const renderTeamLineup = (team, label = null, lineupDataOverride = null) => {
    if (!team) {
      return (
        <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center text-sm text-gray-500 bg-white">
          Lineup TBD
        </div>
      );
    }

    const lineupData = lineupDataOverride || buildTeamLineupData(team);
    const { startersWithStatus } = lineupData;

    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="px-3 py-2 border-b bg-gray-50">
          {label && (
            <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
          )}
          <p className="text-sm font-semibold text-gray-900">{team.manager_name || 'TBD'}</p>
          {team.team_name && (
            <p className="text-xs text-gray-500">{team.team_name}</p>
          )}
        </div>
        <ul className="divide-y divide-gray-200">
          {startersWithStatus.length > 0 ? (
            startersWithStatus.map(({ starter, statusMeta }) => {
              const { gameInfo, injuryInfo } = getStarterSecondaryInfo(starter, statusMeta);
              return (
                <li
                  key={`${team.roster_id}-${starter.slot}-${starter.player_id}`}
                  className={`px-3 py-2 flex items-center justify-between text-xs sm:text-sm bg-white ${statusMeta.rowClasses || ''}`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-10 text-xs font-semibold uppercase text-gray-500">
                      {starter.position || ''}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">{starter.name}</p>
                        {injuryInfo && (
                          <span className="text-[10px] font-semibold text-red-600">
                            {injuryInfo}
                          </span>
                        )}
                      </div>
                      {starter.team && (
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">
                          {starter.team}
                        </p>
                      )}
                      {gameInfo.length > 0 && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {gameInfo.join(' • ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {statusMeta.showBadge !== false && (
                      <span
                        title={statusMeta.description}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusMeta.badgeClasses}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClasses}`} />
                        {statusMeta.label}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-gray-700">
                      {formatPoints(starter.points)}
                    </span>
                  </div>
                </li>
              );
            })
          ) : (
            <li className="px-3 py-2 text-xs text-gray-500 bg-white">Lineup not set</li>
          )}
        </ul>
      </div>
    );
  };

  const renderActiveWeekMatchup = (matchup, idx) => {
    const matchupKey =
      matchup.matchup_id != null ? `matchup-${matchup.matchup_id}` : `week-${currentWeekNumber}-${idx}`;
    const home = matchup.home || null;
    const away = matchup.away || null;
    const homeLineup = buildTeamLineupData(home);
    const awayLineup = buildTeamLineupData(away);
    const homeSummary = renderStatusPills(homeLineup.statusCounts, 'xs');
    const awaySummary = renderStatusPills(awayLineup.statusCounts, 'xs');
    const homePointsValue = normalizePoints(home?.points);
    const awayPointsValue = normalizePoints(away?.points);
    const isWeekComplete = currentWeekNumber <= lastCompletedWeek;
    const homeWin =
      isWeekComplete &&
      homePointsValue !== null &&
      awayPointsValue !== null &&
      homePointsValue > awayPointsValue;
    const awayWin =
      isWeekComplete &&
      homePointsValue !== null &&
      awayPointsValue !== null &&
      awayPointsValue > homePointsValue;
    const isExpanded = !!expandedMatchups[matchupKey];

    return (
      <div key={matchupKey} className="rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
        <div className="grid grid-cols-2 divide-x divide-gray-200">
          <div className={`p-3 ${homeWin ? 'bg-emerald-600' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium block truncate ${homeWin ? 'text-white' : 'text-gray-900'}`}>
                  {home?.manager_name || 'TBD'}
                </span>
                {home?.team_name && (
                  <p className={`text-xs mt-1 ${homeWin ? 'text-white/80' : 'text-gray-500'}`}>{home.team_name}</p>
                )}
              </div>
              <div className="flex-shrink-0 text-center">
                <span className={`text-lg font-bold block ${homeWin ? 'text-white' : 'text-gray-700'}`}>
                  {formatPoints(home?.points)}
                </span>
                <div className="mt-1 min-h-[20px]">
                  {homeSummary}
                </div>
              </div>
            </div>
          </div>
          <div className={`p-3 ${awayWin ? 'bg-emerald-600' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-shrink-0 text-center">
                <span className={`text-lg font-bold block ${awayWin ? 'text-white' : 'text-gray-700'}`}>
                  {formatPoints(away?.points)}
                </span>
                <div className="mt-1 min-h-[20px]">
                  {awaySummary}
                </div>
              </div>
              <div className="flex-1 min-w-0 text-right">
                <span className={`text-sm font-medium block truncate ${awayWin ? 'text-white' : 'text-gray-900'}`}>
                  {away?.manager_name || 'TBD'}
                </span>
                {away?.team_name && (
                  <p className={`text-xs mt-1 ${awayWin ? 'text-white/80' : 'text-gray-500'}`}>{away.team_name}</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => toggleMatchupExpansion(matchupKey)}
          className="w-full px-3 py-2 border-t border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span>{isExpanded ? 'Hide Lineups' : 'View Lineups'}</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              isExpanded ? 'transform rotate-180' : ''
            }`}
          />
        </button>
        {isExpanded && (
          <div className="border-t border-gray-200 px-3 py-3 sm:px-4 sm:py-4 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderTeamLineup(home, null, homeLineup)}
              {renderTeamLineup(away, null, awayLineup)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const surfaceCard = 'card-primary';
  const hasActiveLineups =
    !activeWeekLoading &&
    Array.isArray(activeWeekMatchups?.matchups) &&
    activeWeekMatchups.matchups.length > 0;

  return (
    <DashboardSection
      title={`Week ${currentWeekNumber}`}
      description={`Current week matchups, lineups, and AI-powered insights for Week ${currentWeekNumber}.`}
      icon={CalendarDays}
      bodyClassName="space-y-6 sm:space-y-8"
    >
      {lastCompletedWeek > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className={`${surfaceCard} p-4 sm:p-6`}>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-50 mb-4">
              Week {lastCompletedWeek} In Review
            </h2>
            <AISummary />
          </div>
          <div className={`${surfaceCard} p-4 sm:p-6`}>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-50 mb-4">
              Week {lastCompletedWeek + 1} Preview
            </h2>
            <AIPreview />
          </div>
        </div>
      )}

      <div className={`${surfaceCard} p-4 sm:p-6 space-y-4`}>
        <h3 className="text-lg sm:text-xl font-bold text-slate-50">
          Week {currentWeekNumber} Matchups
        </h3>

        {activeWeekLoading && (
          <p className="text-xs text-slate-300">Loading starting lineups from Sleeper...</p>
        )}

        {activeWeekError && (
          <p className="text-xs text-red-400">{activeWeekError}</p>
        )}

        {hasActiveLineups && (
          <div>
            <p className="text-xs text-slate-300 mb-4">Starting lineups provided by Sleeper</p>
            <div className="space-y-3">
              {activeWeekMatchups.matchups.map((matchup, idx) =>
                renderActiveWeekMatchup(matchup, idx)
              )}
            </div>
          </div>
        )}

        {!activeWeekLoading && !hasActiveLineups && !activeWeekError && (
          <p className="text-sm text-slate-400">No matchup data available for this week.</p>
        )}
      </div>
    </DashboardSection>
  );
}

export default WeekView;
