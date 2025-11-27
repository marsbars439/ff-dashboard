import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CalendarRange, ChevronDown } from 'lucide-react';
import PlayoffBracket from '../../../components/PlayoffBracket';
import AISummary from '../../../components/AISummary';
import AIPreview from '../../../components/AIPreview';
import DashboardSection from '../../../components/DashboardSection';
import { parseFlexibleTimestamp, formatInUserTimeZone } from '../../../utils/date';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
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

const formatWeekRangeLabel = (weeks, fallbackLabel) => {
  if (!Array.isArray(weeks) || weeks.length === 0) {
    return fallbackLabel;
  }

  const weekNumbers = weeks
    .map(week => Number(week?.week))
    .filter(weekNumber => Number.isFinite(weekNumber));

  if (weekNumbers.length === 0) {
    return fallbackLabel;
  }

  const minWeek = Math.min(...weekNumbers);
  const maxWeek = Math.max(...weekNumbers);

  return minWeek === maxWeek
    ? `Week ${minWeek}`
    : `Weeks ${minWeek}-${maxWeek}`;
};

export function SeasonsView({ teamSeasons, loading, error }) {
  const seasonsWithoutMatchups = [2016, 2017, 2018, 2019];
  const [selectedSeasonYear, setSelectedSeasonYear] = useState(null);
  const [seasonMatchups, setSeasonMatchups] = useState([]);
  const [playoffBracket, setPlayoffBracket] = useState([]);
  const [activeWeekMatchups, setActiveWeekMatchups] = useState(null);
  const [activeWeekLoading, setActiveWeekLoading] = useState(false);
  const [activeWeekError, setActiveWeekError] = useState(null);
  const [expandedMatchups, setExpandedMatchups] = useState({});
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [showPreviousResults, setShowPreviousResults] = useState(false);
  const [showUpcomingMatchups, setShowUpcomingMatchups] = useState(false);
  const activeWeekNumber = activeWeekMatchups?.week ?? null;
  const hasLoadedActiveWeekRef = useRef(false);

  // Determine if a season's regular season is complete (all teams have 14 games)
  const isRegularSeasonComplete = year => {
    const seasons = teamSeasons.filter(s => s.year === year);
    return (
      seasons.length > 0 &&
      seasons.every(s => (s.wins + s.losses + (s.ties || 0)) === 14)
    );
  };

  const mostRecentYear = useMemo(() => (
    teamSeasons.length > 0
      ? Math.max(...teamSeasons.map(s => s.year))
      : new Date().getFullYear()
  ), [teamSeasons]);

  const availableYears = [...new Set(teamSeasons.map(s => s.year))].sort((a, b) => b - a);

  useEffect(() => {
    if (teamSeasons.length > 0 && !selectedSeasonYear) {
      const maxYear = Math.max(...teamSeasons.map(s => s.year));
      setSelectedSeasonYear(maxYear);
    }
  }, [teamSeasons, selectedSeasonYear]);

  useEffect(() => {
    if (selectedSeasonYear) {
      fetchSeasonMatchups(selectedSeasonYear);
      fetchPlayoffBracket(selectedSeasonYear);
    }
  }, [selectedSeasonYear]);

  const fetchSeasonMatchups = async (year) => {
    if (seasonsWithoutMatchups.includes(year)) {
      setSeasonMatchups([]);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/seasons/${year}/matchups`);
      if (response.ok) {
        const data = await response.json();
        setSeasonMatchups(data.matchups);
      }
    } catch (error) {
      console.error('Error fetching season matchups:', error);
    }
  };

  const fetchPlayoffBracket = async (year) => {
    if (!isRegularSeasonComplete(year)) {
      setPlayoffBracket([]);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/seasons/${year}/playoffs`);
      if (response.ok) {
        const data = await response.json();
        const cleanBracket = Array.isArray(data.bracket)
          ? data.bracket.map(round => ({
              ...round,
              matchups: Array.isArray(round.matchups)
                ? round.matchups.filter(
                    m =>
                      m.home?.roster_id != null &&
                      m.home?.seed <= 6 &&
                      (m.away == null ||
                        m.away?.roster_id == null ||
                        m.away?.seed <= 6)
                  )
                : []
            }))
          : [];
        const hasBracket = cleanBracket.some(r => r.matchups.length > 0);
        setPlayoffBracket(hasBracket ? cleanBracket : []);
      } else {
        setPlayoffBracket([]);
      }
    } catch (error) {
      console.error('Error fetching playoff bracket:', error);
      setPlayoffBracket([]);
    }
  };

  // Active week logic
  useEffect(() => {
    const latestYear = teamSeasons.length > 0 ? Math.max(...teamSeasons.map(s => s.year)) : null;

    if (
      !selectedSeasonYear ||
      !latestYear ||
      selectedSeasonYear !== latestYear ||
      seasonsWithoutMatchups.includes(selectedSeasonYear)
    ) {
      setActiveWeekMatchups(null);
      setActiveWeekError(null);
      setActiveWeekLoading(false);
      setExpandedMatchups({});
      hasLoadedActiveWeekRef.current = false;
      return;
    }

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
        const response = await fetch(`${API_BASE_URL}/seasons/${selectedSeasonYear}/active-week/matchups`);
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
  }, [selectedSeasonYear, teamSeasons]);

  useEffect(() => {
    setExpandedWeeks({});
  }, [selectedSeasonYear]);

  useEffect(() => {
    setShowPreviousResults(false);
    setShowUpcomingMatchups(false);
  }, [selectedSeasonYear]);

  useEffect(() => {
    if (!Array.isArray(seasonMatchups) || seasonMatchups.length === 0) {
      setExpandedWeeks({});
      return;
    }

    setExpandedWeeks(prev => {
      const desiredState = seasonMatchups.reduce((acc, week) => {
        acc[week.week] = activeWeekNumber ? week.week === activeWeekNumber : true;
        return acc;
      }, {});

      const prevKeys = Object.keys(prev);
      const desiredKeys = Object.keys(desiredState);
      const keysMatch =
        prevKeys.length === desiredKeys.length &&
        desiredKeys.every(key => prevKeys.includes(key));

      if (!keysMatch) {
        return desiredState;
      }

      if (activeWeekNumber) {
        const differs = desiredKeys.some(key => prev[key] !== desiredState[key]);
        return differs ? desiredState : prev;
      }

      return prev;
    });
  }, [seasonMatchups, activeWeekNumber]);

  const weeklyScores = useMemo(() => {
    return seasonMatchups
      .flatMap(week =>
        week.matchups.flatMap(m => [
          { manager: m.home.manager_name, points: m.home.points, week: week.week },
          { manager: m.away.manager_name, points: m.away.points, week: week.week }
        ])
      )
      .filter(score => score.points > 0);
  }, [seasonMatchups]);

  const lastCompletedWeek = useMemo(() => {
    const seasons = teamSeasons.filter(s => s.year === selectedSeasonYear);
    if (seasons.length === 0) return 0;
    return Math.max(
      ...seasons.map(s => s.wins + s.losses + (s.ties || 0))
    );
  }, [teamSeasons, selectedSeasonYear]);

  const completedWeeklyScores = useMemo(
    () => weeklyScores.filter(score => score.week <= lastCompletedWeek),
    [weeklyScores, lastCompletedWeek]
  );

  const topWeeklyScores = [...completedWeeklyScores]
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);
  const bottomWeeklyScores = [...completedWeeklyScores]
    .sort((a, b) => a.points - b.points)
    .slice(0, 5);

  const toggleMatchupExpansion = matchupKey => {
    setExpandedMatchups(prev => ({
      ...prev,
      [matchupKey]: !prev[matchupKey]
    }));
  };

  const toggleWeekExpansion = weekNumber => {
    setExpandedWeeks(prev => {
      const hasWeekState = Object.prototype.hasOwnProperty.call(prev, weekNumber);
      const currentValue = hasWeekState
        ? !!prev[weekNumber]
        : activeWeekNumber
        ? weekNumber === activeWeekNumber
        : true;

      return {
        ...prev,
        [weekNumber]: !currentValue
      };
    });
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

  const playerActivityOrder = {
    live: 0,
    upcoming: 1,
    finished: 2,
    inactive: 3
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

  const renderActiveWeekMatchup = (matchup, idx, weekNumber) => {
    const matchupKey =
      matchup.matchup_id != null ? `matchup-${matchup.matchup_id}` : `week-${weekNumber}-${idx}`;
    const home = matchup.home || null;
    const away = matchup.away || null;
    const homeLineup = buildTeamLineupData(home);
    const awayLineup = buildTeamLineupData(away);
    const homeSummary = renderStatusPills(homeLineup.statusCounts, 'xs');
    const awaySummary = renderStatusPills(awayLineup.statusCounts, 'xs');
    const homePointsValue = normalizePoints(home?.points);
    const awayPointsValue = normalizePoints(away?.points);
    const isWeekComplete = weekNumber <= lastCompletedWeek;
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

  const { previousWeeks, currentWeek, upcomingWeeks } = useMemo(() => {
    if (!Array.isArray(seasonMatchups) || seasonMatchups.length === 0) {
      return { previousWeeks: [], currentWeek: null, upcomingWeeks: [] };
    }

    const sortedWeeks = [...seasonMatchups].sort((a, b) => a.week - b.week);
    const highestScheduledWeek = sortedWeeks[sortedWeeks.length - 1]?.week ?? null;
    const now = Date.now();
    const normalizeKey = value =>
      typeof value === "string" ? value.toLowerCase().trim() : "";

    const starterActivityHints = starter => {
      if (!starter) {
        return { hasMetadata: false, isActive: false };
      }

      if (starter.is_bye) {
        return { hasMetadata: true, isActive: false };
      }

      const keyCandidates = [starter.activity_key, starter.scoreboard_activity_key]
        .map(normalizeKey)
        .filter(Boolean);

      if (keyCandidates.length) {
        if (keyCandidates.some(key => key === "live" || key === "upcoming")) {
          return { hasMetadata: true, isActive: true };
        }
        if (keyCandidates.some(key => key === "finished" || key === "inactive")) {
          return { hasMetadata: true, isActive: false };
        }
      }

      const statusTexts = [
        starter.game_status,
        starter.raw_game_status,
        starter.scoreboard_status,
        starter.scoreboard_detail
      ]
        .map(normalizeKey)
        .filter(Boolean);

      if (statusTexts.length) {
        const finalRegex = /(final|post|complete|finished|closed|bye)/;
        if (statusTexts.some(text => finalRegex.test(text))) {
          return { hasMetadata: true, isActive: false };
        }

        const liveRegex = /(in progress|progress|live|q[1-4]|1st|2nd|3rd|4th|ot|half)/;
        if (statusTexts.some(text => liveRegex.test(text))) {
          return { hasMetadata: true, isActive: true };
        }

        const upcomingRegex = /(pre|sched|upcoming|not started|delay|postponed)/;
        if (statusTexts.some(text => upcomingRegex.test(text))) {
          return { hasMetadata: true, isActive: true };
        }
      }

      const kickoffTimestamp = parseTimestamp(
        starter.scoreboard_start ??
          starter.game_start ??
          starter.start_time ??
          starter.startTime ??
          null
      );

      if (Number.isFinite(kickoffTimestamp)) {
        if (kickoffTimestamp > now) {
          return { hasMetadata: true, isActive: true };
        }
        if (now - kickoffTimestamp >= GAME_COMPLETION_BUFFER_MS) {
          return { hasMetadata: true, isActive: false };
        }
        return { hasMetadata: true, isActive: true };
      }

      return { hasMetadata: false, isActive: false };
    };

    const getLineupActivityState = team => {
      if (!Array.isArray(team?.starters) || team.starters.length === 0) {
        return { hasMetadata: false, hasActiveStarters: false };
      }

      let hasMetadata = false;
      let hasActiveStarters = false;

      team.starters.forEach(starter => {
        const { hasMetadata: starterHasMetadata, isActive } =
          starterActivityHints(starter);
        if (starterHasMetadata) {
          hasMetadata = true;
        }
        if (isActive) {
          hasActiveStarters = true;
        }
      });

      return { hasMetadata, hasActiveStarters };
    };

    const activeWeekLineupTeams = (() => {
      if (
        !activeWeekMatchups ||
        selectedSeasonYear !== mostRecentYear ||
        !Number.isFinite(activeWeekMatchups.week) ||
        !Array.isArray(activeWeekMatchups.matchups)
      ) {
        return null;
      }

      const rosterMap = new Map();
      activeWeekMatchups.matchups.forEach(matchup => {
        if (matchup?.home?.roster_id != null) {
          rosterMap.set(matchup.home.roster_id, matchup.home);
        }
        if (matchup?.away?.roster_id != null) {
          rosterMap.set(matchup.away.roster_id, matchup.away);
        }
      });

      if (rosterMap.size === 0) {
        return null;
      }

      return { week: activeWeekMatchups.week, rosterMap };
    })();

    const matchupHasRecordedScore = matchup => {
      if (!matchup) {
        return false;
      }
      const homePoints = normalizePoints(matchup.home?.points);
      const awayPoints = normalizePoints(matchup.away?.points);
      return homePoints !== null || awayPoints !== null;
    };

    const resolveTeamForActivity = (team, weekNumber) => {
      if (
        !team ||
        !activeWeekLineupTeams ||
        activeWeekLineupTeams.week !== weekNumber
      ) {
        return team;
      }

      if (team.roster_id == null) {
        return team;
      }

      return activeWeekLineupTeams.rosterMap.get(team.roster_id) || team;
    };

    const matchupIsComplete = (matchup, weekNumber) => {
      if (!matchup) {
        return false;
      }

      const homeState = getLineupActivityState(
        resolveTeamForActivity(matchup.home, weekNumber)
      );
      const awayState = getLineupActivityState(
        resolveTeamForActivity(matchup.away, weekNumber)
      );

      if (homeState.hasMetadata || awayState.hasMetadata) {
        return !homeState.hasActiveStarters && !awayState.hasActiveStarters;
      }

      return matchupHasRecordedScore(matchup);
    };

    const weekIsComplete = week => {
      if (!Array.isArray(week.matchups) || week.matchups.length === 0) {
        return false;
      }
      return week.matchups.every(matchup => matchupIsComplete(matchup, week.week));
    };

    const firstIncompleteWeekNumber = (() => {
      const week = sortedWeeks.find(w => !weekIsComplete(w));
      return week ? week.week : null;
    })();

    const allWeeksComplete =
      sortedWeeks.length > 0 && sortedWeeks.every(weekIsComplete);

    const inferredCurrentWeekNumber = (() => {
      if (activeWeekNumber) {
        return activeWeekNumber;
      }
      if (!highestScheduledWeek) {
        return null;
      }
      if (typeof firstIncompleteWeekNumber === "number") {
        return firstIncompleteWeekNumber;
      }
      if (allWeeksComplete) {
        return null;
      }
      if (lastCompletedWeek >= highestScheduledWeek) {
        return null;
      }
      if (lastCompletedWeek === 0) {
        return sortedWeeks[0]?.week ?? null;
      }
      return Math.min(lastCompletedWeek + 1, highestScheduledWeek);
    })();

    if (!inferredCurrentWeekNumber) {
      return { previousWeeks: sortedWeeks, currentWeek: null, upcomingWeeks: [] };
    }

    const previous = [];
    const upcoming = [];
    let current = null;

    sortedWeeks.forEach(week => {
      if (week.week === inferredCurrentWeekNumber) {
        current = week;
      } else if (week.week < inferredCurrentWeekNumber) {
        previous.push(week);
      } else {
        upcoming.push(week);
      }
    });

    if (!current) {
      return { previousWeeks: sortedWeeks, currentWeek: null, upcomingWeeks: [] };
    }

    return { previousWeeks: previous, currentWeek: current, upcomingWeeks: upcoming };
  }, [
    seasonMatchups,
    lastCompletedWeek,
    activeWeekNumber,
    activeWeekMatchups,
    selectedSeasonYear,
    mostRecentYear
  ]);

  const previousWeeksLabel = useMemo(
    () => formatWeekRangeLabel(previousWeeks, 'Previous Results'),
    [previousWeeks]
  );
  const currentWeekLabel = useMemo(
    () => formatWeekRangeLabel(currentWeek ? [currentWeek] : [], 'Current Week'),
    [currentWeek]
  );
  const upcomingWeeksLabel = useMemo(
    () => formatWeekRangeLabel(upcomingWeeks, 'Upcoming Matchups'),
    [upcomingWeeks]
  );

  const renderWeekCard = week => {
    const isActiveWeek =
      selectedSeasonYear === mostRecentYear &&
      activeWeekMatchups &&
      week.week === activeWeekMatchups.week;
    const hasActiveLineups =
      isActiveWeek &&
      !activeWeekLoading &&
      Array.isArray(activeWeekMatchups?.matchups) &&
      activeWeekMatchups.matchups.length > 0;
    const headerMessage = activeWeekLoading
      ? 'Loading starting lineups from Sleeper...'
      : hasActiveLineups
      ? 'Starting lineups provided by Sleeper'
      : activeWeekError
      ? 'Sleeper lineups unavailable'
      : 'Starting lineups unavailable';
    const headerMessageClass = activeWeekError
      ? 'text-xs text-red-500'
      : 'text-xs text-gray-500';
    const hasWeekState = Object.prototype.hasOwnProperty.call(
      expandedWeeks,
      week.week
    );
    const isExpanded = hasWeekState
      ? !!expandedWeeks[week.week]
      : activeWeekNumber
      ? week.week === activeWeekNumber
      : true;

    return (
      <div key={week.week} className="bg-gray-100 rounded-lg border border-gray-200">
        <button
          type="button"
          onClick={() => toggleWeekExpansion(week.week)}
          className="w-full flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4 text-left hover:bg-gray-50 transition-colors rounded-lg"
          aria-expanded={isExpanded}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-1 gap-2">
            <h4 className="font-semibold text-gray-900">Week {week.week}</h4>
            {isActiveWeek && <span className={headerMessageClass}>{headerMessage}</span>}
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-500 transition-transform ${
              isExpanded ? 'transform rotate-180' : ''
            }`}
          />
        </button>

        {isExpanded && (
          <div className="border-t border-gray-200 px-3 pb-3 sm:px-4 sm:pb-4 pt-3 sm:pt-4 bg-gray-50">
            {hasActiveLineups ? (
              <div className="space-y-3">
                {activeWeekMatchups.matchups.map((matchup, idx) =>
                  renderActiveWeekMatchup(matchup, idx, week.week)
                )}
              </div>
            ) : (
              <>
                {isActiveWeek && activeWeekLoading && (
                  <p className="text-xs text-gray-500 mb-2">
                    Loading starting lineups from Sleeper...
                  </p>
                )}
                {isActiveWeek && activeWeekError && (
                  <p className="text-xs text-red-600 mb-2">{activeWeekError}</p>
                )}
                <div className="space-y-3">
                  {week.matchups.map((m, idx) => {
                    const homePoints = normalizePoints(m.home?.points);
                    const awayPoints = normalizePoints(m.away?.points);
                    const isWeekComplete = week.week <= lastCompletedWeek;
                    const homeWin =
                      isWeekComplete &&
                      homePoints !== null &&
                      awayPoints !== null &&
                      homePoints > awayPoints;
                    const awayWin =
                      isWeekComplete &&
                      homePoints !== null &&
                      awayPoints !== null &&
                      awayPoints > homePoints;
                    return (
                      <div key={idx} className="rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
                        <div className="grid grid-cols-2 divide-x divide-gray-200">
                          <div className={`p-3 ${homeWin ? 'bg-emerald-600' : ''}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-sm font-medium truncate ${homeWin ? 'text-white' : 'text-gray-900'}`}>
                                {m.home?.manager_name || 'TBD'}
                              </span>
                              <span className={`text-lg font-bold ${homeWin ? 'text-white' : 'text-gray-700'}`}>
                                {formatPoints(m.home?.points)}
                              </span>
                            </div>
                          </div>
                          <div className={`p-3 ${awayWin ? 'bg-emerald-600' : ''}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-lg font-bold ${awayWin ? 'text-white' : 'text-gray-700'}`}>
                                {formatPoints(m.away?.points)}
                              </span>
                              <span className={`text-sm font-medium truncate ${awayWin ? 'text-white' : 'text-gray-900'}`}>
                                {m.away?.manager_name || 'TBD'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-24 w-24 sm:h-32 sm:w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-sm sm:text-base">Loading The League Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p className="text-sm">Dashboard is initializing, please wait a minute and refresh the page.</p>
          </div>
        </div>
      </div>
    );
  }

  const surfaceCard = 'card-primary';
  const subCard = 'card-secondary';
  const champion = teamSeasons.find(s => s.year === selectedSeasonYear && s.playoff_finish === 1);
  const runnerUp = teamSeasons.find(s => s.year === selectedSeasonYear && s.playoff_finish === 2);
  const thirdPlace = teamSeasons.find(s => s.year === selectedSeasonYear && s.playoff_finish === 3);

  const seasonSelector = (
    <div className="flex items-center gap-3">
      <select
        value={selectedSeasonYear || ''}
        onChange={e => setSelectedSeasonYear(Number(e.target.value))}
        className="border-2 border-blue-200 bg-white rounded-full px-4 py-2 text-base font-bold text-gray-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        {availableYears.map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </div>
  );

  return (
    <DashboardSection
      title="Season Overview"
      description={`View standings, matchups, and playoff results for the ${selectedSeasonYear || 'selected'} season.`}
      icon={CalendarRange}
      actions={seasonSelector}
      bodyClassName="space-y-6 sm:space-y-8"
    >
      {selectedSeasonYear === mostRecentYear && lastCompletedWeek > 0 && (
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

      <div className={`${surfaceCard} p-4 sm:p-6 space-y-6`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-50">{selectedSeasonYear}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="rounded-xl bg-gradient-to-br from-blue-500/20 via-slate-900/60 to-slate-900/60 border border-blue-400/30 p-3">
            <p className="text-xs sm:text-sm text-blue-100 font-semibold">Champion</p>
            <p className="font-semibold text-slate-50">{champion ? champion.manager_name : 'TBD'}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 via-slate-900/60 to-slate-900/60 border border-emerald-400/30 p-3">
            <p className="text-xs sm:text-sm text-emerald-100 font-semibold">Runner-Up</p>
            <p className="font-semibold text-slate-50">{runnerUp ? runnerUp.manager_name : 'TBD'}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-amber-500/20 via-slate-900/60 to-slate-900/60 border border-amber-300/40 p-3">
            <p className="text-xs sm:text-sm text-amber-100 font-semibold">Third Place</p>
            <p className="font-semibold text-slate-50">{thirdPlace ? thirdPlace.manager_name : 'TBD'}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-xs sm:text-sm">
            <thead className="bg-slate-900/60">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-200">Rank</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-200">Manager</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-200">Record</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-200">PF</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-200">PA</th>
              </tr>
            </thead>
            <tbody className="bg-slate-950/40 divide-y divide-white/10 text-slate-50">
              {teamSeasons
                .filter(s => s.year === selectedSeasonYear)
                .sort((a, b) => a.regular_season_rank - b.regular_season_rank)
                .map(season => (
                  <tr
                    key={season.name_id}
                    className={season.playoff_finish === 1 ? 'bg-amber-500/10' : ''}
                  >
                    <td className="px-3 py-2">{season.regular_season_rank}</td>
                    <td className="px-3 py-2">{season.manager_name}</td>
                    <td className="px-3 py-2">
                      {season.wins}-{season.losses}
                      {season.ties ? `-${season.ties}` : ''}
                    </td>
                    <td className="px-3 py-2">{season.points_for.toFixed(1)}</td>
                    <td className="px-3 py-2">{season.points_against.toFixed(1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {topWeeklyScores.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`${subCard} border-emerald-400/30 bg-emerald-500/10 p-4`}>
              <h4 className="font-semibold text-slate-50 mb-2">Top 5 Weekly Scores</h4>
              <ul className="space-y-2 text-sm text-slate-100">
                {topWeeklyScores.map((w, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{`Week ${w.week} - ${w.manager}`}</span>
                    <span className="font-medium">{w.points}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${subCard} border-rose-400/30 bg-rose-500/10 p-4`}>
              <h4 className="font-semibold text-slate-50 mb-2">Bottom 5 Weekly Scores</h4>
              <ul className="space-y-2 text-sm text-slate-100">
                {bottomWeeklyScores.map((w, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{`Week ${w.week} - ${w.manager}`}</span>
                    <span className="font-medium">{w.points}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {isRegularSeasonComplete(selectedSeasonYear) && playoffBracket.length > 0 && (
        <PlayoffBracket rounds={playoffBracket} />
      )}

      {!seasonsWithoutMatchups.includes(selectedSeasonYear) && (
        <div className={`${surfaceCard} p-4 sm:p-6 space-y-4`}>
          <h3 className="text-lg sm:text-xl font-bold text-slate-50">Matchups</h3>
          <div className="space-y-4">
            <div className="border border-white/10 rounded-lg bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowPreviousResults(prev => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4 text-left text-slate-100"
                aria-expanded={showPreviousResults}
              >
                <span className="font-semibold">{previousWeeksLabel}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform ${
                    showPreviousResults ? 'transform rotate-180' : ''
                  }`}
                />
              </button>
              {showPreviousResults && (
                <div className="border-t border-white/10 px-3 py-3 sm:px-4 sm:py-4 space-y-4">
                  {previousWeeks.length > 0 ? (
                    previousWeeks.map(renderWeekCard)
                  ) : (
                    <p className="text-sm text-slate-400">
                      No completed matchups yet.
                    </p>
                  )}
                </div>
              )}
            </div>
            {currentWeek && (
              <div className="border border-white/10 rounded-lg bg-slate-950/40">
                <div className="px-3 py-3 sm:px-4 sm:py-4 text-slate-100">
                  <span className="font-semibold">{currentWeekLabel}</span>
                </div>
                <div className="border-t border-white/10 px-3 py-3 sm:px-4 sm:py-4 space-y-4">
                  {renderWeekCard(currentWeek)}
                </div>
              </div>
            )}
            <div className="border border-white/10 rounded-lg bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowUpcomingMatchups(prev => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4 text-left text-slate-100"
                aria-expanded={showUpcomingMatchups}
              >
                <span className="font-semibold">{upcomingWeeksLabel}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform ${
                    showUpcomingMatchups ? 'transform rotate-180' : ''
                  }`}
                />
              </button>
              {showUpcomingMatchups && (
                <div className="border-t border-white/10 px-3 py-3 sm:px-4 sm:py-4 space-y-4">
                  {upcomingWeeks.length > 0 ? (
                    upcomingWeeks.map(renderWeekCard)
                  ) : (
                    <p className="text-sm text-slate-400">
                      No upcoming matchups remaining.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardSection>
  );
}
