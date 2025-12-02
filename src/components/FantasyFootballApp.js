import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardHeader from './DashboardHeader';
import ActiveTabSection from './ActiveTabSection';
import { LoadingSpinner } from '../shared/components';
import { useAdminSession } from '../state/AdminSessionContext';
import { useKeeperTools } from '../state/KeeperToolsContext';

// Sprint 4: Feature-based architecture with lazy loading
const RecordsView = lazy(() => import('../features/records'));
const SeasonsView = lazy(() => import('../features/seasons'));
const WeekView = lazy(() => import('../features/week'));
const KeeperTools = lazy(() => import('../features/keepers'));
const RulesSection = lazy(() => import('../features/rules'));
const AdminTools = lazy(() => import('../features/admin'));
const Analytics = lazy(() => import('../features/analytics'));

// Detect if env var is set to wrong value (without /api) and use fallback instead
const envUrl = process.env.REACT_APP_API_BASE_URL;
const hasCorrectApiPath = envUrl && envUrl.includes('/api');
const API_BASE_URL = hasCorrectApiPath
  ? envUrl
  : (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api');

const VALID_TABS = new Set(['records', 'week', 'seasons', 'preseason', 'rules', 'admin', 'analytics']);
const DASHBOARD_TABS = [
  { id: 'records', label: 'Hall of Records' },
  { id: 'week', label: 'Week', isDynamic: true },
  { id: 'seasons', label: 'Seasons' },
  { id: 'preseason', label: 'Preseason' },
  { id: 'rules', label: 'Rules' },
  {
    id: 'admin',
    label: 'Admin',
    isActive: (currentTab) => currentTab === 'admin' || currentTab === 'analytics'
  }
];

const FantasyFootballApp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminSession, enforceAdminTabAccess } = useAdminSession();

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') {
      return 'records';
    }

    const path = location.pathname.replace(/^\//, '') || 'records';
    const urlTab = VALID_TABS.has(path) ? path : 'records';
    const storedAdminAuthorized = Boolean(adminSession?.token);

    // Check if URL tab requires admin access
    if (!storedAdminAuthorized && (urlTab === 'admin' || urlTab === 'analytics')) {
      return 'records';
    }

    return urlTab;
  });

  const [selectedManager, setSelectedManager] = useState('');
  const [managers, setManagers] = useState([]);
  const [teamSeasons, setTeamSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rulesContent, setRulesContent] = useState('');

  const { selectedKeeperYear, setSelectedKeeperYear } = useKeeperTools();

  const updateActiveTab = tab => {
    const nextTab = VALID_TABS.has(tab) ? tab : 'records';
    const enforcedTab = enforceAdminTabAccess(nextTab);
    setActiveTab(enforcedTab);
    navigate(`/${enforcedTab}`, { replace: true });
  };

  const mostRecentYear = useMemo(() => (
    teamSeasons.length > 0
      ? Math.max(...teamSeasons.map(s => s.year))
      : new Date().getFullYear()
  ), [teamSeasons]);

  const currentYearSeasons = useMemo(
    () => teamSeasons.filter(s => s.year === mostRecentYear),
    [teamSeasons, mostRecentYear]
  );

  const currentWeekNumber = useMemo(() => {
    const seasons = teamSeasons.filter(s => s.year === mostRecentYear);
    if (seasons.length === 0) return 1;
    const lastCompletedWeek = Math.max(
      ...seasons.map(s => s.wins + s.losses + (s.ties || 0))
    );
    return lastCompletedWeek + 1;
  }, [teamSeasons, mostRecentYear]);

  const currentChampion = useMemo(
    () => currentYearSeasons.find(s => s.playoff_finish === 1),
    [currentYearSeasons]
  );

  // Determine if a season's regular season is complete (all teams have 14 games)
  const isRegularSeasonComplete = year => {
    const seasons = teamSeasons.filter(s => s.year === year);
    return (
      seasons.length > 0 &&
      seasons.every(s => (s.wins + s.losses + (s.ties || 0)) === 14)
    );
  };

  const currentSeasonComplete = isRegularSeasonComplete(mostRecentYear);

  const currentYearSeasonsWithRank = useMemo(
    () =>
      currentYearSeasons.filter(
        s => s.regular_season_rank && s.regular_season_rank > 0
      ),
    [currentYearSeasons]
  );

  const currentChumpion =
    currentSeasonComplete &&
    currentYearSeasonsWithRank.length === currentYearSeasons.length &&
    currentYearSeasonsWithRank.length > 0
      ? currentYearSeasonsWithRank.reduce((worst, current) =>
          current.regular_season_rank > worst.regular_season_rank ? current : worst
        )
      : null;

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

  // Sync active tab when URL changes (browser back/forward)
  useEffect(() => {
    const path = location.pathname.replace(/^\//, '') || 'records';
    const urlTab = VALID_TABS.has(path) ? path : 'records';
    if (urlTab !== activeTab) {
      const enforcedTab = enforceAdminTabAccess(urlTab);
      setActiveTab(enforcedTab);
      // If enforced tab is different from URL, update URL
      if (enforcedTab !== urlTab) {
        navigate(`/${enforcedTab}`, { replace: true });
      }
    }
  }, [location.pathname, activeTab, enforceAdminTabAccess, navigate]);

  useEffect(() => {
    fetchData();
    fetchRules();
    document.title = 'The League Dashboard';
  }, []);

  useEffect(() => {
    if (teamSeasons.length > 0 && !selectedKeeperYear) {
      const maxYear = Math.max(...teamSeasons.map(s => s.year));
      setSelectedKeeperYear(maxYear);
    }
  }, [teamSeasons, selectedKeeperYear]);

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

    const seasonsByYear = {};
    teamSeasons.forEach(season => {
      if (!seasonsByYear[season.year]) {
        seasonsByYear[season.year] = [];
      }
      seasonsByYear[season.year].push(season);
    });

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

    const currentYearSeasonsLocal = seasonsByYear[mostRecentYear] || [];
    const currentSeasonInProgress = !currentYearSeasonsLocal.some(
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

    Object.values(records).forEach(record => {
      record.winPct = record.gamesPlayed > 0 ? record.totalWins / (record.totalWins + record.totalLosses) : 0;
      record.pointsPerGame = record.gamesPlayed > 0 ? record.totalPointsFor / record.gamesPlayed : 0;
      record.netEarnings = record.totalPayout - record.totalDues - record.totalDuesChumpion;
      record.totalMedals = record.championships + record.secondPlace + record.thirdPlace;
      record.chumpionYears.sort((a, b) => a - b);
    });

    return records;
  };

  const getCurrentYearChumpionDues = () => {
    if (!mostRecentYear || !isRegularSeasonComplete(mostRecentYear)) return 0;

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

  const allRecords = calculateAllRecords();
  const activeRecords = Object.values(allRecords).filter(r => r.active);
  const inactiveRecords = Object.values(allRecords).filter(r => !r.active);

  const medalRankings = Object.values(allRecords)
    .filter(record => record.totalMedals > 0)
    .sort((a, b) => {
      if (b.championships !== a.championships) return b.championships - a.championships;
      if (b.secondPlace !== a.secondPlace) return b.secondPlace - a.secondPlace;
      return b.thirdPlace - a.thirdPlace;
    });

  const chumpionRankings = Object.values(allRecords)
    .filter(r => r.chumpionships > 0)
    .sort((a, b) => {
      if (b.chumpionships !== a.chumpionships) return b.chumpionships - a.chumpionships;
      return a.seasons - b.seasons;
    });

  const availableYears = [...new Set(teamSeasons.map(s => s.year))].sort((a, b) => b - a);

  const winPctRankings = [
    ...activeRecords.sort((a, b) => b.winPct - a.winPct),
    ...inactiveRecords.sort((a, b) => b.winPct - a.winPct)
  ];

  const ppgRankings = [
    ...activeRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame),
    ...inactiveRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame)
  ];

  // Create dynamic tabs with current week number
  const dynamicTabs = useMemo(() => {
    return DASHBOARD_TABS.map(tab => {
      if (tab.isDynamic && tab.id === 'week') {
        return { ...tab, label: `Week ${currentWeekNumber}` };
      }
      return tab;
    });
  }, [currentWeekNumber]);

  const renderRecordsSection = () => (
    <Suspense fallback={<LoadingSpinner message="Loading Records..." />}>
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
    </Suspense>
  );

  const renderSeasonsSection = () => (
    <Suspense fallback={<LoadingSpinner message="Loading Seasons..." />}>
      <SeasonsView
        teamSeasons={teamSeasons}
        loading={false}
        error={null}
      />
    </Suspense>
  );

  const renderWeekSection = () => (
    <Suspense fallback={<LoadingSpinner message="Loading Week..." />}>
      <WeekView teamSeasons={teamSeasons} />
    </Suspense>
  );

  const renderPreseasonSection = () => (
    <Suspense fallback={<LoadingSpinner message="Loading Preseason Tools..." />}>
      <KeeperTools availableYears={availableYears} managerOptions={managerOptions} />
    </Suspense>
  );

  const renderRulesSection = () => (
    <Suspense fallback={<LoadingSpinner message="Loading Rules..." />}>
      <RulesSection rulesContent={rulesContent} />
    </Suspense>
  );

  const renderAdminSection = () => (
    <Suspense fallback={<LoadingSpinner message="Loading Admin..." />}>
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
    </Suspense>
  );

  const renderAnalyticsSection = () => (
    <Suspense fallback={<LoadingSpinner message="Loading Analytics..." />}>
      <Analytics onBack={() => updateActiveTab('admin')} />
    </Suspense>
  );

  const tabSections = {
    records: renderRecordsSection,
    week: renderWeekSection,
    seasons: renderSeasonsSection,
    preseason: renderPreseasonSection,
    rules: renderRulesSection,
    admin: renderAdminSection,
    analytics: renderAnalyticsSection
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

  return (
    <div className="ff-dashboard section-stack">
      <header className="layout-section">
        <DashboardHeader
          tabs={dynamicTabs}
          activeTab={activeTab}
          onTabChange={updateActiveTab}
        />
      </header>
      <main className="layout-section section-surface section-padding">
        <ActiveTabSection activeTab={activeTab} sections={tabSections} />
      </main>
    </div>
  );
};

export default FantasyFootballApp;
