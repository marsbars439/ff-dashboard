import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import PlayoffBracket from './PlayoffBracket';
import AISummary from './AISummary';
import AIPreview from './AIPreview';
import Analytics from './Analytics';
import KeeperTools from './KeeperTools';
import RecordsView from './RecordsView';
import AdminTools from './AdminTools';
import DashboardHeader from './DashboardHeader';
import ActiveTabSection from './ActiveTabSection';
import RulesSection from './RulesSection';
import { useAdminSession } from '../state/AdminSessionContext';
import { useManagerAuth } from '../state/ManagerAuthContext';
import { useKeeperTools } from '../state/KeeperToolsContext';
import { parseFlexibleTimestamp, formatInUserTimeZone } from '../utils/date';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const ACTIVE_WEEK_REFRESH_INTERVAL_MS = 30000;
const GAME_COMPLETION_BUFFER_MS = 4.5 * 60 * 60 * 1000;
const VALID_TABS = new Set(['records', 'seasons', 'preseason', 'rules', 'admin', 'analytics']);
const DASHBOARD_TABS = [
  { id: 'records', label: 'Hall of Records' },
  { id: 'seasons', label: 'Seasons' },
  { id: 'preseason', label: 'Preseason' },
  { id: 'rules', label: 'Rules' },
  {
    id: 'admin',
    label: 'Admin',
    isActive: (currentTab) => currentTab === 'admin' || currentTab === 'analytics'
  }
];

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

const FantasyFootballApp = () => {
  const { adminSession, enforceAdminTabAccess } = useAdminSession();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') {
      return 'records';
    }

    const storedAdminAuthorized = Boolean(adminSession?.token);

    try {
      const storedTab = window.localStorage?.getItem('ff-dashboard-active-tab');
      if (storedTab && VALID_TABS.has(storedTab)) {
        if (!storedAdminAuthorized && (storedTab === 'admin' || storedTab === 'analytics')) {
          return 'records';
        }
        return storedTab;
      }
    } catch (error) {
      console.warn('Unable to read stored active tab:', error);
    }

    return 'records';
  });
  const [selectedManager, setSelectedManager] = useState('');
  const [managers, setManagers] = useState([]);
  const [teamSeasons, setTeamSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rulesContent, setRulesContent] = useState('');

  // NEW: Manager editing state variables
  const [editingManager, setEditingManager] = useState(null);
  const [editedManagerData, setEditedManagerData] = useState({});

  const [selectedSeasonYear, setSelectedSeasonYear] = useState(null);
  const [seasonMatchups, setSeasonMatchups] = useState([]);
  const [playoffBracket, setPlayoffBracket] = useState([]);
  const {
    managerAuth,
    managerAuthSelection,
    setManagerAuthSelection,
    managerAuthPasscode,
    setManagerAuthPasscode,
    managerAuthError,
    managerAuthLoading,
    loginManager,
    clearManagerAuth
  } = useManagerAuth();
  const { selectedKeeperYear, setSelectedKeeperYear } = useKeeperTools();
  const updateActiveTab = tab => {
    const nextTab = VALID_TABS.has(tab) ? tab : 'records';
    setActiveTab(enforceAdminTabAccess(nextTab));
  };
  const seasonsWithoutMatchups = [2016, 2017, 2018, 2019];
  const [activeWeekMatchups, setActiveWeekMatchups] = useState(null);
  const [activeWeekLoading, setActiveWeekLoading] = useState(false);
  const [activeWeekError, setActiveWeekError] = useState(null);
  const [expandedMatchups, setExpandedMatchups] = useState({});
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [showPreviousResults, setShowPreviousResults] = useState(true);
  const [showUpcomingMatchups, setShowUpcomingMatchups] = useState(true);
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

  const managerOptions = useMemo(() => {
    if (!Array.isArray(managers)) {
      return [];
    }

    return managers
      .filter(manager => {
        if (!manager) {
          return false;
        }

        if (manager.active === undefined || manager.active === null) {
          return true;
        }

        return (
          manager.active === true ||
          manager.active === 1 ||
          manager.active === '1'
        );
      })
      .map(manager => ({
        id: manager?.name_id || '',
        name:
          manager?.full_name ||
          manager?.manager_name ||
          manager?.name ||
          manager?.name_id || ''
      }))
      .filter(option => option.id && option.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [managers]);

  const parseJsonResponse = useCallback(async (response) => {
    const text = await response.text();
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      console.warn('Unable to parse JSON response:', error);
      return {};
    }
  }, []);


  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!VALID_TABS.has(activeTab)) {
      try {
        window.localStorage?.removeItem('ff-dashboard-active-tab');
      } catch (error) {
        console.warn('Unable to remove stored active tab:', error);
      }
      return;
    }

    try {
      window.localStorage?.setItem('ff-dashboard-active-tab', activeTab);
    } catch (error) {
      console.warn('Unable to store active tab:', error);
    }
  }, [activeTab]);

  useEffect(() => {
    setActiveTab(prevTab => enforceAdminTabAccess(prevTab));
  }, [enforceAdminTabAccess]);

  useEffect(() => {
    fetchData();
    fetchRules();
    // Set document title
    document.title = 'The League Dashboard';
  }, []);


  useEffect(() => {
    if (teamSeasons.length > 0 && !selectedSeasonYear) {
      const maxYear = Math.max(...teamSeasons.map(s => s.year));
      setSelectedSeasonYear(maxYear);
    }
    if (teamSeasons.length > 0 && !selectedKeeperYear) {
      const maxYear = Math.max(...teamSeasons.map(s => s.year));
      setSelectedKeeperYear(maxYear);
    }
  }, [teamSeasons, selectedSeasonYear, selectedKeeperYear]);

  useEffect(() => {
    if (selectedSeasonYear) {
      fetchSeasonMatchups(selectedSeasonYear);
      fetchPlayoffBracket(selectedSeasonYear);
    }
  }, [selectedSeasonYear]);

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
    setShowPreviousResults(true);
    setShowUpcomingMatchups(true);
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

  const fetchData = async (options = {}) => {
    const { silent = false } = options;

    if (!silent) {
      setLoading(true);
    }

    try {
      const [managersResponse, seasonsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/managers`),
        fetch(`${API_BASE_URL}/team-seasons`)
      ]);

      if (!managersResponse.ok || !seasonsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const managersData = await managersResponse.json();
      const seasonsData = await seasonsResponse.json();

      setManagers(managersData.managers);
      setTeamSeasons(seasonsData.teamSeasons);
    } catch (err) {
      if (silent) {
        console.error('Failed to refresh data:', err);
      } else {
        setError('Failed to load data: ' + err.message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const fetchRules = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/rules`);
      if (response.ok) {
        const data = await response.json();
        setRulesContent(data.rules);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

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
    // Only fetch playoff data once the regular season has concluded
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

  const saveRules = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/rules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rules: rulesContent }),
      });
      
      if (response.ok) {
        alert('Rules updated successfully!');
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  // NEW: Manager editing functions
  const startManagerEdit = (manager) => {
    setEditingManager(manager.id);
    setEditedManagerData({ ...manager });
  };

  const cancelManagerEdit = () => {
    setEditingManager(null);
    setEditedManagerData({});
  };

  const saveManagerEdit = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/managers/${editingManager}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedManagerData),
      });
      
      if (response.ok) {
        await fetchData();
        setEditingManager(null);
        setEditedManagerData({});
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const deleteManager = async (id) => {
    if (!window.confirm('Are you sure you want to delete this manager? This action cannot be undone.')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/managers/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        await fetchData();
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const addNewManager = async () => {
    const newManager = {
      name_id: '',
      full_name: '',
      sleeper_username: '',
      sleeper_user_id: '',
      active: 1
    };

    try {
      const response = await fetch(`${API_BASE_URL}/managers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newManager),
      });
      
      if (response.ok) {
        await fetchData();
        // Auto-edit the new manager
        const managersResponse = await fetch(`${API_BASE_URL}/managers`);
        const managersData = await managersResponse.json();
        const lastManager = managersData.managers[managersData.managers.length - 1];
        startManagerEdit(lastManager);
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const calculateAllRecords = () => {
    const records = {};
    
    managers.forEach(manager => {
      records[manager.name_id] = {
        name: manager.full_name,
        active: manager.active,
        championships: 0,
        secondPlace: 0,
        thirdPlace: 0,
        chumpionships: 0,
        chumpionYears: [], // Track years when manager was chumpion
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

    // Group seasons by year to find the chumpion (worst regular season rank) for each year
    const seasonsByYear = {};
    teamSeasons.forEach(season => {
      if (!seasonsByYear[season.year]) {
        seasonsByYear[season.year] = [];
      }
      seasonsByYear[season.year].push(season);
    });

    // For each year, find the chumpion (highest regular_season_rank number)
    const chumpionsByYear = {};
    Object.keys(seasonsByYear).forEach(year => {
      const seasonsInYear = seasonsByYear[year];
      const validRanks = seasonsInYear.filter(
        s => s.regular_season_rank && s.regular_season_rank > 0
      );
      const seasonComplete = seasonsInYear.every(
        s => (s.wins + s.losses + (s.ties || 0)) === 14
      );
      // Only determine a chumpion if regular season is complete and all teams have a valid rank
      if (seasonComplete && validRanks.length === seasonsInYear.length && validRanks.length > 0) {
        const chumpion = validRanks.reduce((worst, current) =>
          current.regular_season_rank > worst.regular_season_rank ? current : worst
        );
        chumpionsByYear[year] = chumpion.name_id;
      }
    });

    const mostRecentYear = teamSeasons.length > 0
      ? Math.max(...teamSeasons.map(s => s.year))
      : null;
    const currentYearSeasons = seasonsByYear[mostRecentYear] || [];
    // Season is considered incomplete until a champion is crowned
    // (no team has a playoff_finish of 1 yet).
    const currentSeasonInProgress = !currentYearSeasons.some(
      s => s.playoff_finish === 1
    );

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
        
        // Check if this manager was the chumpion this year
        if (chumpionsByYear[season.year] === season.name_id) {
          record.chumpionships += 1;
          record.chumpionYears.push(season.year); // Track the year
        }
        
        // Only count seasons with a valid regular season rank
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

    Object.values(records).forEach(record => {
      record.winPct = record.gamesPlayed > 0 ? record.totalWins / (record.totalWins + record.totalLosses) : 0;
      record.pointsPerGame = record.gamesPlayed > 0 ? record.totalPointsFor / record.gamesPlayed : 0;
      record.netEarnings = record.totalPayout - record.totalDues - record.totalDuesChumpion;
      record.totalMedals = record.championships + record.secondPlace + record.thirdPlace;
      
      // Sort chumpion years in ascending order
      record.chumpionYears.sort((a, b) => a - b);
    });

    return records;
  };

  const getCurrentYearChumpionDues = () => {
    const mostRecentYearLocal =
      teamSeasons.length > 0 ? Math.max(...teamSeasons.map(s => s.year)) : null;
    if (!mostRecentYearLocal || !isRegularSeasonComplete(mostRecentYearLocal)) return 0;

    const seasons = teamSeasons.filter(s => s.year === mostRecentYearLocal);
    // Find the chumpion for the current year (highest regular_season_rank)
    const currentChumpionSeason = seasons.reduce(
      (worst, current) =>
        !worst || current.regular_season_rank > worst.regular_season_rank
          ? current
          : worst,
      null
    );
    return currentChumpionSeason?.dues_chumpion || 0;
  };

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
    const matchupHasRecordedScore = matchup => {
      if (!matchup) {
        return false;
      }
      const homePoints = normalizePoints(matchup.home?.points);
      const awayPoints = normalizePoints(matchup.away?.points);
      return homePoints !== null || awayPoints !== null;
    };
    const matchupIsComplete = matchup => {
      if (!matchup) {
        return false;
      }

      const homeState = getLineupActivityState(matchup.home);
      const awayState = getLineupActivityState(matchup.away);
      if (homeState.hasMetadata || awayState.hasMetadata) {
        return !homeState.hasActiveStarters && !awayState.hasActiveStarters;
      }

      return matchupHasRecordedScore(matchup);
    };
    const weekIsComplete = week => {
      if (!Array.isArray(week.matchups) || week.matchups.length === 0) {
        return false;
      }
      return week.matchups.every(matchupIsComplete);
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
  }, [seasonMatchups, lastCompletedWeek, activeWeekNumber]);

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
        rawStatus.includes('in_progress') ||
        rawStatus.includes('live') ||
        rawStatus.includes('playing') ||
        liveRegex.test(rawStatus) ||
        rawStatus.includes('half') ||
        rawStatus.includes('quarter')
      ) {
        rawStatusKey = 'live';
      } else if (
        rawStatus.includes('final') ||
        rawStatus.includes('post') ||
        rawStatus.includes('complete') ||
        rawStatus.includes('finished') ||
        rawStatus.includes('closed')
      ) {
        rawStatusKey = 'finished';
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
        (kickoffLikelyFinished && (statsAvailable || pointsValue !== null))
    );

    const hasGameStartedSignal = Boolean(
      hasGameFinishedSignal ||
        resolvedKey === 'live' ||
        backendKey === 'live' ||
        scoreboardHasLive ||
        hasLiveDetail ||
        statsAvailable ||
        kickoffHasPassed ||
        (pointsValue !== null && pointsValue !== 0)
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
    const { includeFinished = false } = options;
    const entries = Object.entries(statusCounts || {})
      .filter(([key, count]) => {
        const statusMeta = playerActivityStyles[key];
        if (!statusMeta || count <= 0) {
          return false;
        }
        if (!includeFinished && key === 'finished') {
          return false;
        }
        return true;
      })
      .sort((a, b) => playerActivityOrder[a[0]] - playerActivityOrder[b[0]]);

    if (entries.length === 0) {
      return null;
    }

    const baseClass =
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';
    const dotSize = size === 'xs' ? 'w-1 h-1' : 'w-1.5 h-1.5';

    return (
      <div className="flex flex-wrap gap-1">
        {entries.map(([key, count]) => {
          const statusMeta = playerActivityStyles[key];
          const label = statusMeta.summaryLabel ?? statusMeta.label;
          return (
            <span
              key={key}
              title={statusMeta.description}
              className={`inline-flex items-center gap-1 rounded-full border font-medium ${statusMeta.badgeClasses} ${baseClass}`}
            >
              <span className={`${dotSize} rounded-full ${statusMeta.dotClasses}`} />
              {label ? `${count} ${label}` : count}
            </span>
          );
        })}
      </div>
    );
  };

  const getStarterSecondaryInfo = (starter, statusMeta) => {
    const info = [];

    const addInfo = value => {
      if (value === null || value === undefined) {
        return;
      }
      const text = value.toString().trim();
      if (!text) {
        return;
      }
      const exists = info.some(item => item.toLowerCase() === text.toLowerCase());
      if (!exists) {
        info.push(text);
      }
    };

    if (starter?.is_bye) {
      addInfo(
        starter?.bye_week != null && starter.bye_week !== ''
          ? `Bye Week ${starter.bye_week}`
          : 'Bye Week'
      );
      return info;
    }

    const opponentLabel = getOpponentLabel(starter);
    if (opponentLabel) {
      addInfo(opponentLabel);
    }

    if (statusMeta?.key === 'upcoming') {
      const kickoffLabel = formatKickoffTime(
        starter?.scoreboard_start ?? starter?.game_start
      );
      if (kickoffLabel) {
        addInfo(kickoffLabel);
      }
    }

    if (statusMeta?.key === 'live') {
      const detail =
        (typeof starter?.scoreboard_detail === 'string' && starter.scoreboard_detail) ||
        (typeof starter?.raw_game_status === 'string' && starter.raw_game_status) ||
        (typeof starter?.game_status === 'string' && starter.game_status);
      if (detail) {
        addInfo(detail.toUpperCase());
      }
    }

    if (statusMeta?.key === 'finished') {
      const detail =
        (typeof starter?.scoreboard_detail === 'string' && starter.scoreboard_detail) ||
        (typeof starter?.raw_game_status === 'string' && starter.raw_game_status) ||
        (typeof starter?.game_status === 'string' && starter.game_status);
      if (detail) {
        addInfo(detail.toUpperCase());
      } else if (starter?.scoreboard_status) {
        addInfo(starter.scoreboard_status.toString().toUpperCase());
      } else {
        addInfo('FINAL');
      }
    }

    const injury = starter?.injury_status;
    if (injury && typeof injury === 'string') {
      const trimmed = injury.trim();
      if (trimmed && trimmed.toLowerCase() !== 'n/a' && trimmed.toLowerCase() !== 'healthy') {
        addInfo(trimmed.toUpperCase());
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
          addInfo(trimmedPractice.toUpperCase());
        }
      }
    }

    return info;
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
    const { startersWithStatus, statusCounts } = lineupData;
    const statusPills = renderStatusPills(statusCounts);

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
          {statusPills && <div className="mt-2">{statusPills}</div>}
        </div>
        <ul className="divide-y divide-gray-200">
          {startersWithStatus.length > 0 ? (
            startersWithStatus.map(({ starter, statusMeta }) => {
              const secondaryInfo = getStarterSecondaryInfo(starter, statusMeta);
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
                      <p className="font-medium text-gray-800">{starter.name}</p>
                      {starter.team && (
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">
                          {starter.team}
                        </p>
                      )}
                      {secondaryInfo.length > 0 && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {secondaryInfo.join(' • ')}
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
    const homeWin =
      homePointsValue !== null &&
      awayPointsValue !== null &&
      homePointsValue > awayPointsValue;
    const awayWin =
      homePointsValue !== null &&
      awayPointsValue !== null &&
      awayPointsValue > homePointsValue;
    const isExpanded = !!expandedMatchups[matchupKey];

    return (
      <div key={matchupKey} className="bg-white rounded-lg shadow">
        <button
          type="button"
          onClick={() => toggleMatchupExpansion(matchupKey)}
          className="w-full px-3 py-3 sm:px-4 sm:py-4 flex items-center justify-between text-left"
        >
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-sm sm:text-base font-semibold ${
                    homeWin ? 'text-green-700' : 'text-gray-900'
                  }`}
                >
                  {home?.manager_name || 'TBD'}
                </p>
                {home?.team_name && (
                  <p className="text-xs text-gray-500">{home.team_name}</p>
                )}
                {homeSummary && <div className="mt-1">{homeSummary}</div>}
              </div>
              <span
                className={`text-sm sm:text-base font-bold ${
                  homeWin ? 'text-green-700' : 'text-gray-700'
                }`}
              >
                {formatPoints(home?.points)}
              </span>
            </div>
            <div className="text-center text-xs uppercase tracking-wide text-gray-400">vs</div>
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-sm sm:text-base font-semibold ${
                    awayWin ? 'text-green-700' : 'text-gray-900'
                  }`}
                >
                  {away?.manager_name || 'TBD'}
                </p>
                {away?.team_name && (
                  <p className="text-xs text-gray-500">{away.team_name}</p>
                )}
                {awaySummary && <div className="mt-1">{awaySummary}</div>}
              </div>
              <span
                className={`text-sm sm:text-base font-bold ${
                  awayWin ? 'text-green-700' : 'text-gray-700'
                }`}
              >
                {formatPoints(away?.points)}
              </span>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-500 transition-transform ${
              isExpanded ? 'transform rotate-180' : ''
            }`}
          />
        </button>
          {isExpanded && (
            <div className="border-t px-3 py-3 sm:px-4 sm:py-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderTeamLineup(home, null, homeLineup)}
                {renderTeamLineup(away, null, awayLineup)}
              </div>
            </div>
          )}
        </div>
      );
  };

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
      <div key={week.week} className="bg-gray-50 rounded-lg">
        <button
          type="button"
          onClick={() => toggleWeekExpansion(week.week)}
          className="w-full flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4 text-left"
          aria-expanded={isExpanded}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-1 gap-2">
            <h4 className="font-semibold">Week {week.week}</h4>
            {isActiveWeek && <span className={headerMessageClass}>{headerMessage}</span>}
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-500 transition-transform ${
              isExpanded ? 'transform rotate-180' : ''
            }`}
          />
        </button>

        {isExpanded && (
          <div className="border-t border-gray-200 px-3 pb-3 sm:px-4 sm:pb-4 pt-3 sm:pt-4">
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
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs sm:text-sm table-fixed">
                    <tbody className="divide-y divide-gray-200">
                      {week.matchups.map((m, idx) => {
                        const homePoints = normalizePoints(m.home?.points);
                        const awayPoints = normalizePoints(m.away?.points);
                        const homeWin =
                          homePoints !== null &&
                          awayPoints !== null &&
                          homePoints > awayPoints;
                        const awayWin =
                          homePoints !== null &&
                          awayPoints !== null &&
                          awayPoints > homePoints;
                        return (
                          <tr key={idx} className="text-left">
                            <td className={`px-2 py-1 w-1/5 ${homeWin ? 'bg-green-50 text-green-700 font-semibold rounded-l' : ''}`}>
                              {m.home?.manager_name || 'TBD'}
                            </td>
                            <td className={`px-2 py-1 w-1/5 text-right ${homeWin ? 'bg-green-50 text-green-700 font-semibold' : ''}`}>
                              {formatPoints(m.home?.points)}
                            </td>
                            <td className="px-2 py-1 w-1/5 text-center">vs</td>
                            <td className={`px-2 py-1 w-1/5 ${awayWin ? 'bg-green-50 text-green-700 font-semibold' : ''}`}>
                              {m.away?.manager_name || 'TBD'}
                            </td>
                            <td className={`px-2 py-1 w-1/5 text-right ${awayWin ? 'bg-green-50 text-green-700 font-semibold rounded-r' : ''}`}>
                              {formatPoints(m.away?.points)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const allRecords = calculateAllRecords();
  const activeRecords = Object.values(allRecords).filter(r => r.active);
  const inactiveRecords = Object.values(allRecords).filter(r => !r.active);

  const mostRecentYear = teamSeasons.length > 0 ? Math.max(...teamSeasons.map(s => s.year)) : new Date().getFullYear();
  const currentYearSeasons = teamSeasons.filter(s => s.year === mostRecentYear);
  const currentChampion = currentYearSeasons.find(s => s.playoff_finish === 1);
  const currentSeasonComplete = isRegularSeasonComplete(mostRecentYear);
  
  // Find current chumpion (highest regular_season_rank number)
  const currentYearSeasonsWithRank = currentYearSeasons.filter(
    s => s.regular_season_rank && s.regular_season_rank > 0
  );
  const currentChumpion =
    currentSeasonComplete &&
    currentYearSeasonsWithRank.length === currentYearSeasons.length &&
    currentYearSeasonsWithRank.length > 0
      ? currentYearSeasonsWithRank.reduce((worst, current) =>
          current.regular_season_rank > worst.regular_season_rank ? current : worst
        )
      : null;

  // Medal Rankings: Sort by medals only, don't separate active/inactive
  const medalRankings = Object.values(allRecords)
    .filter(record => record.totalMedals > 0)
    .sort((a, b) => {
      if (b.championships !== a.championships) return b.championships - a.championships;
      if (b.secondPlace !== a.secondPlace) return b.secondPlace - a.secondPlace;
      return b.thirdPlace - a.thirdPlace;
    });

  // Chumpion Rankings: only include managers with chumpionships and sort by count, then by seasons (fewer seasons = worse ranking)
  const chumpionRankings = Object.values(allRecords)
    .filter(r => r.chumpionships > 0)
    .sort((a, b) => {
      if (b.chumpionships !== a.chumpionships) return b.chumpionships - a.chumpionships;
      return a.seasons - b.seasons; // Fewer seasons = worse ranking when tied
    });

  const availableYears = [...new Set(teamSeasons.map(s => s.year))].sort((a, b) => b - a);
  const champion = teamSeasons.find(s => s.year === selectedSeasonYear && s.playoff_finish === 1);
  const runnerUp = teamSeasons.find(s => s.year === selectedSeasonYear && s.playoff_finish === 2);
  const thirdPlace = teamSeasons.find(s => s.year === selectedSeasonYear && s.playoff_finish === 3);


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

  const winPctRankings = [
    ...activeRecords.sort((a, b) => b.winPct - a.winPct),
    ...inactiveRecords.sort((a, b) => b.winPct - a.winPct)
  ];

  const ppgRankings = [
    ...activeRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame),
    ...inactiveRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame)
  ];

  const renderSeasonsSection = () => (
    <div className="space-y-4 sm:space-y-6">
      {selectedSeasonYear === mostRecentYear && lastCompletedWeek > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
              Week {lastCompletedWeek} In Review
            </h2>
            <AISummary />
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
              Week {lastCompletedWeek + 1} Preview
            </h2>
            <AIPreview />
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-0">Season {selectedSeasonYear}</h2>
          <select
            value={selectedSeasonYear || ''}
            onChange={e => setSelectedSeasonYear(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-center">
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Champion</p>
            <p className="font-semibold">{champion ? champion.manager_name : 'TBD'}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Runner-Up</p>
            <p className="font-semibold">{runnerUp ? runnerUp.manager_name : 'TBD'}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Third Place</p>
            <p className="font-semibold">{thirdPlace ? thirdPlace.manager_name : 'TBD'}</p>
          </div>
        </div>
        {isRegularSeasonComplete(selectedSeasonYear) && playoffBracket.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Playoff Bracket</h3>
            <PlayoffBracket rounds={playoffBracket} />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1 text-left font-medium text-gray-500">Rank</th>
                <th className="px-2 py-1 text-left font-medium text-gray-500">Manager</th>
                <th className="px-2 py-1 text-left font-medium text-gray-500">Record</th>
                <th className="px-2 py-1 text-left font-medium text-gray-500">PF</th>
                <th className="px-2 py-1 text-left font-medium text-gray-500">PA</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teamSeasons
                .filter(s => s.year === selectedSeasonYear)
                .sort((a, b) => a.regular_season_rank - b.regular_season_rank)
                .map(season => (
                  <tr key={season.name_id} className={season.playoff_finish === 1 ? 'bg-yellow-50' : ''}>
                    <td className="px-2 py-1">{season.regular_season_rank}</td>
                    <td className="px-2 py-1">{season.manager_name}</td>
                    <td className="px-2 py-1">
                      {season.wins}-{season.losses}
                      {season.ties ? `-${season.ties}` : ''}
                    </td>
                    <td className="px-2 py-1">{season.points_for.toFixed(1)}</td>
                    <td className="px-2 py-1">{season.points_against.toFixed(1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {topWeeklyScores.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-green-50 rounded-lg p-4 shadow">
              <h4 className="font-semibold mb-2">Top 5 Weekly Scores</h4>
              <ul className="space-y-1 text-sm">
                {topWeeklyScores.map((w, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{`Week ${w.week} - ${w.manager}`}</span>
                    <span className="font-medium">{w.points}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-red-50 rounded-lg p-4 shadow">
              <h4 className="font-semibold mb-2">Bottom 5 Weekly Scores</h4>
              <ul className="space-y-1 text-sm">
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
      {!seasonsWithoutMatchups.includes(selectedSeasonYear) && (
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Matchups</h3>
          <div className="space-y-4">
            {currentWeek && (
              <div className="border border-gray-200 rounded-lg">
                <div className="px-3 py-3 sm:px-4 sm:py-4">
                  <span className="font-semibold">Current Week</span>
                </div>
                <div className="border-t border-gray-200 px-3 py-3 sm:px-4 sm:py-4 space-y-4">
                  {renderWeekCard(currentWeek)}
                </div>
              </div>
            )}
            <div className="border border-gray-200 rounded-lg">
              <button
                type="button"
                onClick={() => setShowPreviousResults(prev => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4 text-left"
                aria-expanded={showPreviousResults}
              >
                <span className="font-semibold">Previous Results</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    showPreviousResults ? 'transform rotate-180' : ''
                  }`}
                />
              </button>
              {showPreviousResults && (
                <div className="border-t border-gray-200 px-3 py-3 sm:px-4 sm:py-4 space-y-4">
                  {previousWeeks.length > 0 ? (
                    previousWeeks.map(renderWeekCard)
                  ) : (
                    <p className="text-sm text-gray-500">
                      No completed matchups yet.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg">
              <button
                type="button"
                onClick={() => setShowUpcomingMatchups(prev => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4 text-left"
                aria-expanded={showUpcomingMatchups}
              >
                <span className="font-semibold">Upcoming Matchups</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    showUpcomingMatchups ? 'transform rotate-180' : ''
                  }`}
                />
              </button>
              {showUpcomingMatchups && (
                <div className="border-t border-gray-200 px-3 py-3 sm:px-4 sm:py-4 space-y-4">
                  {upcomingWeeks.length > 0 ? (
                    upcomingWeeks.map(renderWeekCard)
                  ) : (
                    <p className="text-sm text-gray-500">
                      No upcoming matchups remaining.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPreseasonSection = () => (
    <KeeperTools availableYears={availableYears} managerOptions={managerOptions} />
  );

  const renderRecordsSection = () => (
    <RecordsView
      allRecords={allRecords}
      mostRecentYear={mostRecentYear}
      currentChampion={currentChampion}
      currentChumpion={currentChumpion}
      currentYearSeasons={currentYearSeasons}
      selectedManager={selectedManager}
      onSelectManager={setSelectedManager}
      medalRankings={medalRankings}
      chumpionRankings={chumpionRankings}
      winPctRankings={winPctRankings}
      ppgRankings={ppgRankings}
      getCurrentYearChumpionDues={getCurrentYearChumpionDues}
    />
  );

  const renderAdminSection = () => (
    <AdminTools
      apiBaseUrl={API_BASE_URL}
      availableYears={availableYears}
      managers={managers}
      rulesContent={rulesContent}
      setRulesContent={setRulesContent}
      onSaveRules={saveRules}
      onAnalyticsClick={() => updateActiveTab('analytics')}
      onSignOut={() => setActiveTab('admin')}
      onDataUpdate={fetchData}
    />
  );

  const renderRulesSection = () => <RulesSection rulesContent={rulesContent} />;

  const renderAnalyticsSection = () => (
    <Analytics onBack={() => updateActiveTab('admin')} />
  );

  const tabSections = {
    seasons: renderSeasonsSection,
    preseason: renderPreseasonSection,
    records: renderRecordsSection,
    admin: renderAdminSection,
    rules: renderRulesSection,
    analytics: renderAnalyticsSection
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <DashboardHeader
        tabs={DASHBOARD_TABS}
        activeTab={activeTab}
        onTabChange={updateActiveTab}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <ActiveTabSection activeTab={activeTab} sections={tabSections} />
      </div>
    </div>
  );
};

export default FantasyFootballApp;
