import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart3, ArrowLeft, RefreshCw, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

const NUMERIC_OPERATORS = ['>', '>=', '<', '<=', '='];
const STRING_SORT_FIELDS = ['name', 'team', 'position', 'manager'];
const POSITION_DISPLAY_ORDER = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SF', 'SUPERFLEX', 'OP', 'WR/RB', 'WR/RB/TE', 'RB/WR', 'RB/WR/TE', 'WR/TE', 'RB/TE', 'QB/RB/WR/TE', 'K', 'DEF', 'DST', 'IDP', 'DL', 'LB', 'DB', 'BN', 'BENCH'];

const STARTER_SLOT_COUNT = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 1
};

const EXCLUDED_POSITIONS = new Set(['DEF', 'DST']);

function getRankVisuals(rank, total) {
  if (!rank || !total) {
    return {
      percent: 0,
      trackColor: '#e5e7eb',
      fillColor: '#9ca3af',
      beadPercent: null,
      beadColor: null
    };
  }

  if (total > 1 && rank === total) {
    return {
      percent: 0,
      trackColor: '#fee2e2',
      fillColor: '#7f1d1d',
      beadPercent: 6,
      beadColor: '#7f1d1d'
    };
  }

  const normalized = total === 1 ? 1 : Math.max(0, Math.min(1, (total - rank) / (total - 1)));
  const percent = Math.round(normalized * 100);
  const hue = 120 * normalized; // 0 = red, 120 = green

  return {
    percent,
    trackColor: `hsl(${hue}, 75%, 88%)`,
    fillColor: `hsl(${hue}, 70%, 45%)`,
    beadPercent: null,
    beadColor: null
  };
}

const formatPoints = (value) => Number(value || 0).toLocaleString(undefined, {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0
});

function parseNumericFilterInput(filter) {
  if (!filter) return null;
  const { operator = '', value = '' } = filter;
  const trimmedOperator = operator.trim();
  if (!trimmedOperator || !NUMERIC_OPERATORS.includes(trimmedOperator)) {
    return null;
  }
  const trimmedValue = typeof value === 'string' ? value.trim() : value;
  if (trimmedValue === '') {
    return null;
  }
  const numericValue = Number(trimmedValue);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return { operator: trimmedOperator, value: numericValue };
}

function matchesNumericFilter(value, parsedFilter) {
  if (!parsedFilter) return true;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return false;
  }
  switch (parsedFilter.operator) {
    case '>':
      return numericValue > parsedFilter.value;
    case '>=':
      return numericValue >= parsedFilter.value;
    case '<':
      return numericValue < parsedFilter.value;
    case '<=':
      return numericValue <= parsedFilter.value;
    case '=':
      return numericValue === parsedFilter.value;
    default:
      return true;
  }
}

function normalizeName(name = '') {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTeam(team = '') {
  const upper = team.toUpperCase();
  if (upper === 'JAC') return 'JAX';
  return upper;
}

function normalizePosition(position = '') {
  const upper = position.toUpperCase();
  if (upper === 'DST') return 'DEF';
  return upper;
}

function createKey(name, team, position) {
  return `${normalizeName(name)}|${normalizeTeam(team).toLowerCase()}|${normalizePosition(position).toLowerCase()}`;
}

function getSortFieldKey(field) {
  return STRING_SORT_FIELDS.includes(field) ? `${field}Lower` : field;
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const Analytics = ({ onBack }) => {
  const [authorized, setAuthorized] = useState(false);
  const [input, setInput] = useState('');
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [sortField, setSortField] = useState('nameLower');
  const [sortDir, setSortDir] = useState('asc');
  const [filters, setFilters] = useState({
    name: '',
    team: [],
    position: [],
    manager: [],
    draftCost: { operator: '', value: '' },
    projPts: { operator: '', value: '' }
  });
  const [excludedPositions, setExcludedPositions] = useState([]);
  const [activeFilterKey, setActiveFilterKey] = useState(null);
  const password = process.env.REACT_APP_ANALYTICS_PASSWORD || 'admin';
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!activeFilterKey) return undefined;

    const handleClickOutside = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(`[data-filter-key="${activeFilterKey}"]`)) {
        setActiveFilterKey(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveFilterKey(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeFilterKey]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === password) {
      setAuthorized(true);
    } else {
      alert('Incorrect password');
    }
  };

  const loadData = useCallback(async () => {
    const year = new Date().getFullYear();
    const cacheBuster = Date.now();
    const fetchJson = (url) =>
      fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      }).then(r => r.json());

    const withCacheBust = (url) => `${url}${url.includes('?') ? '&' : '?'}_=${cacheBuster}`;
    try {
      const [dataRes, rosterRes] = await Promise.all([
        fetchJson(withCacheBust(`${API_BASE_URL}/ros-rankings`)),
        fetchJson(withCacheBust(`${API_BASE_URL}/seasons/${year}/keepers`))
      ]);

      // Support both array and object API responses
      const rosData = Array.isArray(dataRes)
        ? dataRes
        : dataRes.rankings || [];
      const rosters = Array.isArray(rosterRes)
        ? rosterRes
        : rosterRes.rosters || [];
      const draftedPlayers = rosterRes.draftedPlayers || [];

      const playerMap = {};

      // Seed player map with roster data so players show even if ROS data fails
      rosters.forEach(r => {
        (r.players || []).forEach(p => {
          const teamVal = normalizeTeam(p.team || '');
          const positionVal = normalizePosition(p.position || '');
          const key = createKey(p.name, teamVal, positionVal);
          playerMap[key] = {
            id: key,
            name: p.name,
            team: teamVal,
            position: positionVal,
            manager: r.manager_name,
            draftCost: p.draft_cost ? Number(p.draft_cost) : 0,
            projPts: 0,
            nameLower: normalizeName(p.name),
            teamLower: teamVal.toLowerCase(),
            positionLower: positionVal.toLowerCase(),
            managerLower: (r.manager_name || '').toLowerCase()
          };
        });
      });

      // Include drafted players not on rosters
      draftedPlayers.forEach(p => {
        const teamVal = normalizeTeam(p.team || '');
        const positionVal = normalizePosition(p.position || '');
        const key = createKey(p.name, teamVal, positionVal);
        const existing = playerMap[key];
        const cost = p.draft_cost ? Number(p.draft_cost) : 0;
        if (existing) {
          if (!existing.draftCost) existing.draftCost = cost;
        } else {
          playerMap[key] = {
            id: key,
            name: p.name,
            team: teamVal,
            position: positionVal,
            manager: '',
            draftCost: cost,
            projPts: 0,
            nameLower: normalizeName(p.name),
            teamLower: teamVal.toLowerCase(),
            positionLower: positionVal.toLowerCase(),
            managerLower: ''
          };
        }
      });

      // Merge in ROS data
      rosData.forEach(p => {
        const teamVal = normalizeTeam(p.team || '');
        const positionVal = normalizePosition(p.position || '');
        const key = createKey(p.player_name, teamVal, positionVal);
        const existing = playerMap[key] || {
          id: key,
          name: p.player_name,
          team: teamVal,
          position: positionVal,
          manager: '',
          draftCost: 0,
          projPts: 0,
          nameLower: normalizeName(p.player_name),
          teamLower: teamVal.toLowerCase(),
          positionLower: positionVal.toLowerCase(),
          managerLower: ''
        };
        existing.projPts = Number(p.proj_pts) || 0;
        playerMap[key] = existing;
      });

      const playersArr = Object.values(playerMap);
      setPlayers(playersArr);
      return playersArr.some(p => p.projPts);
    } catch (e) {
      console.error('Failed to load player data:', e);
      return false;
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    if (authorized) {
      loadData();
    }
  }, [authorized, loadData]);

  const refreshRosData = async () => {
    setRefreshing(true);
    setRefreshMessage('Requesting ROS data refresh...');
    try {
      const res = await fetch(`${API_BASE_URL}/ros-rankings/refresh`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('Refresh request failed');
      }
      setRefreshMessage('Loading updated data...');
      const success = await loadData();
      setRefreshMessage(success ? 'ROS data refreshed successfully.' : 'Failed to load ROS data.');
    } catch (e) {
      console.error('Failed to refresh ROS data:', e);
      setRefreshMessage('Failed to refresh ROS data.');
    } finally {
      setRefreshing(false);
    }
  };

  const availableTeams = useMemo(() => {
    const teams = new Set();
    players.forEach(p => {
      if (p.team) teams.add(p.team);
    });
    return Array.from(teams).sort(collator.compare);
  }, [players]);

  const availablePositions = useMemo(() => {
    const positions = new Set();
    players.forEach(p => {
      if (p.position) positions.add(p.position);
    });
    return Array.from(positions).sort(collator.compare);
  }, [players]);

  const availableManagers = useMemo(() => {
    const managers = new Set();
    players.forEach(p => {
      if (p.manager) managers.add(p.manager);
    });
    return Array.from(managers).sort(collator.compare);
  }, [players]);

  const managerPositionStats = useMemo(() => {
    const managerMap = new Map();

    players.forEach(p => {
      if (!p.manager) return;
      const managerKey = p.manager;
      if (!managerMap.has(managerKey)) {
        managerMap.set(managerKey, {
          manager: managerKey,
          totalRos: 0,
          totalPlayers: 0,
          positions: {}
        });
      }
      const managerEntry = managerMap.get(managerKey);
      const positionKey = p.position || 'N/A';
      const projectedPoints = Number(p.projPts) || 0;
      managerEntry.totalRos += projectedPoints;
      managerEntry.totalPlayers += 1;

      if (EXCLUDED_POSITIONS.has(positionKey)) {
        return;
      }

      if (!managerEntry.positions[positionKey]) {
        managerEntry.positions[positionKey] = [];
      }

      managerEntry.positions[positionKey].push({
        id: p.id,
        name: p.name,
        team: p.team,
        projPts: projectedPoints
      });
    });

    const results = Array.from(managerMap.values()).map(entry => {
      const positionData = {};
      const flexEligiblePositions = ['RB', 'WR', 'TE'];

      Object.entries(entry.positions).forEach(([position, data]) => {
        positionData[position] = {
          sortedPlayers: data.slice().sort((a, b) => b.projPts - a.projPts),
          starterSlots: STARTER_SLOT_COUNT[position] ?? 1,
          extraSlots: 0
        };
      });

      let flexCandidate = null;

      flexEligiblePositions.forEach(position => {
        const data = positionData[position];
        if (!data) return;
        const baseSlots = Math.max(0, data.starterSlots);
        if (data.sortedPlayers.length <= baseSlots) return;
        const candidate = data.sortedPlayers[baseSlots];
        if (!candidate) return;
        if (!flexCandidate || candidate.projPts > flexCandidate.player.projPts) {
          flexCandidate = { position, player: candidate };
        }
      });

      if (flexCandidate) {
        positionData[flexCandidate.position].extraSlots = 1;
      }

      const positions = {};
      let totalStarterRos = 0;
      let totalStarterPlayers = 0;
      let totalBenchRos = 0;
      let totalBenchPlayers = 0;

      Object.entries(positionData).forEach(([position, data]) => {
        const starterLimit = Math.max(0, data.starterSlots + (data.extraSlots || 0));
        const starters = starterLimit > 0 ? data.sortedPlayers.slice(0, starterLimit) : [];
        const bench = starterLimit > 0 ? data.sortedPlayers.slice(starterLimit) : data.sortedPlayers.slice();
        const starterTotal = starters.reduce((sum, player) => sum + player.projPts, 0);
        const benchTotal = bench.reduce((sum, player) => sum + player.projPts, 0);
        const starterAvg = starters.length ? starterTotal / starters.length : null;
        const benchAvg = bench.length ? benchTotal / bench.length : null;
        positions[position] = {
          starters,
          bench,
          starterAvg,
          benchAvg,
          starterTotal,
          benchTotal,
          benchCount: bench.length,
          totalCount: data.sortedPlayers.length
        };

        totalStarterRos += starterTotal;
        totalStarterPlayers += starters.length;
        totalBenchRos += benchTotal;
        totalBenchPlayers += bench.length;
      });

      const benchFromExcluded = entry.totalRos - totalStarterRos - totalBenchRos;
      const benchPlayersFromExcluded = entry.totalPlayers - totalStarterPlayers - totalBenchPlayers;
      const benchRosWithExcluded = totalBenchRos + Math.max(0, benchFromExcluded);
      const benchPlayersWithExcluded = totalBenchPlayers + Math.max(0, benchPlayersFromExcluded);

      return {
        manager: entry.manager,
        totalRos: entry.totalRos,
        totalPlayers: entry.totalPlayers,
        pointsPerPlayer: entry.totalPlayers ? entry.totalRos / entry.totalPlayers : null,
        positions,
        totalStarterRos,
        totalStarterPlayers,
        totalBenchRos: benchRosWithExcluded,
        totalBenchPlayers: benchPlayersWithExcluded
      };
    });

    return results.sort((a, b) => {
      if (b.totalRos !== a.totalRos) {
        return b.totalRos - a.totalRos;
      }
      return collator.compare(a.manager, b.manager);
    });
  }, [players]);

  const positionColumns = useMemo(() => {
    const positions = new Set();
    managerPositionStats.forEach(manager => {
      Object.keys(manager.positions).forEach(position => {
        positions.add(position);
      });
    });
    return Array.from(positions).sort((a, b) => {
      const aIndex = POSITION_DISPLAY_ORDER.indexOf(a);
      const bIndex = POSITION_DISPLAY_ORDER.indexOf(b);
      if (aIndex === -1 && bIndex === -1) {
        return collator.compare(a, b);
      }
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [managerPositionStats]);

  const positionRankings = useMemo(() => {
    const collected = {};
    const metrics = ['starterAvg', 'benchAvg'];

    managerPositionStats.forEach(manager => {
      Object.entries(manager.positions).forEach(([position, data]) => {
        metrics.forEach(metric => {
          const value = data[metric];
          if (typeof value !== 'number') return;
          if (!collected[position]) {
            collected[position] = {};
          }
          if (!collected[position][metric]) {
            collected[position][metric] = [];
          }
          collected[position][metric].push({ manager: manager.manager, value });
        });
      });
    });

    const rankings = {};

    Object.entries(collected).forEach(([position, metricsData]) => {
      rankings[position] = {};
      Object.entries(metricsData).forEach(([metric, entries]) => {
        if (!entries.length) return;
        const sortedEntries = entries.slice().sort((a, b) => b.value - a.value);
        const ranks = {};
        let lastValue = null;
        let rank = 0;
        let index = 0;
        sortedEntries.forEach(entry => {
          index += 1;
          if (lastValue === null || entry.value !== lastValue) {
            rank = index;
            lastValue = entry.value;
          }
          ranks[entry.manager] = rank;
        });
        rankings[position][metric] = { total: sortedEntries.length, ranks };
      });
    });

    return rankings;
  }, [managerPositionStats]);

  const sortedPlayers = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    const teamFilter = new Set(filters.team.map(t => t.toLowerCase()));
    const positionFilter = new Set(filters.position.map(p => p.toLowerCase()));
    const managerFilter = new Set(filters.manager.map(m => m.toLowerCase()));
    const excludedPositionFilter = new Set(excludedPositions.map(pos => pos.toLowerCase()));
    const draftCostFilter = parseNumericFilterInput(filters.draftCost);
    const projPtsFilter = parseNumericFilterInput(filters.projPts);
    const filtered = players.filter(p =>
      (p.nameLower.includes(searchLower) || p.managerLower.includes(searchLower)) &&
      (!filters.name || p.nameLower.includes(filters.name.toLowerCase())) &&
      (teamFilter.size === 0 || teamFilter.has(p.teamLower)) &&
      (positionFilter.size === 0 || positionFilter.has(p.positionLower)) &&
      (managerFilter.size === 0 || managerFilter.has(p.managerLower)) &&
      (excludedPositionFilter.size === 0 || !excludedPositionFilter.has(p.positionLower)) &&
      matchesNumericFilter(p.draftCost, draftCostFilter) &&
      matchesNumericFilter(p.projPts, projPtsFilter)
    );
    return filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? collator.compare(aVal, bVal)
        : collator.compare(bVal, aVal);
    });
  }, [players, debouncedSearch, sortField, sortDir, filters, excludedPositions]);

  const toggleFilterPanel = useCallback((key) => {
    setActiveFilterKey(prev => (prev === key ? null : key));
  }, []);

  const closeFilterPanel = useCallback(() => {
    setActiveFilterKey(null);
  }, []);

  const isFilterApplied = useCallback((key) => {
    switch (key) {
      case 'name':
        return Boolean(filters.name.trim());
      case 'team':
        return filters.team.length > 0;
      case 'position':
        return filters.position.length > 0 || excludedPositions.length > 0;
      case 'manager':
        return filters.manager.length > 0;
      case 'draftCost':
      case 'projPts':
        return Boolean(filters[key].operator) || `${filters[key].value}`.trim() !== '';
      default:
        return false;
    }
  }, [filters, excludedPositions]);

  const toggleListFilter = useCallback((field, value) => {
    setFilters(prev => {
      const current = new Set(prev[field]);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      return {
        ...prev,
        [field]: Array.from(current)
      };
    });
  }, []);

  const clearListFilter = useCallback((field) => {
    setFilters(prev => ({
      ...prev,
      [field]: []
    }));
  }, []);

  const clearNumericFilter = useCallback((field) => {
    setFilters(prev => ({
      ...prev,
      [field]: { operator: '', value: '' }
    }));
  }, []);

  const clearPositionFilters = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      position: []
    }));
    setExcludedPositions([]);
  }, []);

  const handleSort = useCallback((field) => {
    const actualField = getSortFieldKey(field);
    if (actualField === sortField) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(actualField);
      setSortDir('asc');
    }
  }, [sortField, sortDir]);

  const getSortIcon = useCallback((field) => {
    const actualField = getSortFieldKey(field);
    if (sortField !== actualField) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDir === 'asc'
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  }, [sortField, sortDir]);

  const renderSortButton = useCallback((label, field, align = 'left') => {
    const actualField = getSortFieldKey(field);
    const isActive = sortField === actualField;
    const alignmentClass = align === 'right' ? 'ml-auto' : '';
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`flex items-center gap-1 text-sm font-semibold transition-colors ${alignmentClass} ${isActive ? 'text-blue-600 hover:text-blue-700' : 'text-gray-700 hover:text-gray-900'}`}
      >
        <span>{label}</span>
        {getSortIcon(field)}
      </button>
    );
  }, [getSortIcon, handleSort, sortField]);

  const FilterDropdown = ({ filterKey, align = 'left', widthClass = 'w-64', children }) => {
    const isOpen = activeFilterKey === filterKey;
    const applied = isFilterApplied(filterKey);
    const alignmentClass = align === 'right' ? 'right-0' : 'left-0';
    const buttonStateClass = isOpen || applied
      ? 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100'
      : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-blue-50';

    return (
      <div className="relative ml-2" data-filter-key={filterKey}>
        <button
          type="button"
          onClick={() => toggleFilterPanel(filterKey)}
          className={`rounded-md border p-1 transition-colors ${buttonStateClass}`}
          aria-label={`Filter ${filterKey}`}
        >
          <Filter className="w-4 h-4" />
        </button>
        {isOpen && (
          <div
            className={`absolute ${alignmentClass} z-20 mt-2 ${widthClass} rounded-lg border border-gray-200 bg-white p-4 shadow-xl`}
            role="dialog"
            aria-label={`${filterKey} filters`}
          >
            {children({ close: closeFilterPanel })}
          </div>
        )}
      </div>
    );
  };

  const handleNumericFilterChange = (field, key) => (event) => {
    const { value } = event.target;
    setFilters(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [key]: value
      }
    }));
  };

  const togglePosition = (position) => {
    toggleListFilter('position', position);
  };

  const toggleExcludedPosition = (position) => {
    setExcludedPositions(prev => (
      prev.includes(position)
        ? prev.filter(p => p !== position)
        : [...prev, position]
    ));
  };

  const renderRow = p => (
    <tr key={p.id} className="divide-y divide-gray-200">
      <td className="px-3 py-2 whitespace-nowrap">{p.name}</td>
      <td className="px-3 py-2 whitespace-nowrap">{p.team}</td>
      <td className="px-3 py-2 whitespace-nowrap">{p.position}</td>
      <td className="px-3 py-2 whitespace-nowrap">{p.manager || ''}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right">{p.draftCost ? `$${p.draftCost}` : ''}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right">{p.projPts}</td>
    </tr>
  );

  if (!authorized) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 max-w-md mx-auto">
        <div className="flex items-center space-x-3 mb-6 sm:mb-8">
          <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Analytics</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Enter password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <button
        onClick={onBack}
        className="flex items-center text-blue-600 hover:text-blue-800"
      >
        <ArrowLeft className="w-5 h-5 mr-1" /> Back to Admin
      </button>
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8">
        <div className="flex items-center space-x-3 mb-6 sm:mb-8">
          <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Analytics</h2>
        </div>
        <button
          onClick={refreshRosData}
          disabled={refreshing}
          className="mb-2 flex items-center bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Pull ROS Player Data from FantasyPros
        </button>
        {refreshMessage && (
          <div className="mb-4 text-sm text-gray-700">{refreshMessage}</div>
        )}
        {managerPositionStats.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Manager ROS Strength by Position</h3>
            <p className="mt-1 text-sm text-gray-600">
              Compare how each roster stacks up by position using FantasyPros rest-of-season projections. Totals show
              overall roster value, while starter and bench averages highlight top-end talent versus depth.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 manager-ros-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Manager</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Total ROS</th>
                    {positionColumns.map(position => (
                      <th
                        key={position}
                        className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                      >
                        {position}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {managerPositionStats.map(manager => (
                    <tr key={manager.manager} className="align-top">
                      <td className="px-3 py-3 text-sm font-semibold text-gray-900">
                        <div>{manager.manager}</div>
                        <div className="text-xs font-normal text-gray-500">{manager.totalPlayers} players</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-900">
                        <div className="font-semibold">{formatPoints(manager.totalRos)}</div>
                        <div className="mt-1 space-y-1 text-xs text-gray-600">
                          <div>Starters: {formatPoints(manager.totalStarterRos || 0)}</div>
                          <div>Bench: {formatPoints(manager.totalBenchRos || 0)}</div>
                          <div>
                            Points / Player:{' '}
                            {manager.pointsPerPlayer != null ? formatPoints(manager.pointsPerPlayer) : '—'}
                          </div>
                        </div>
                      </td>
                      {positionColumns.map(position => {
                        const positionData = manager.positions[position];
                        if (!positionData) {
                          return (
                            <td key={position} className="px-3 py-3 align-top text-center text-xs text-gray-400">
                              —
                            </td>
                          );
                        }
                        const {
                          starterAvg,
                          benchAvg,
                          benchCount,
                          starters,
                          bench
                        } = positionData;
                        const starterRanking = positionRankings[position]?.starterAvg;
                        const benchRanking = positionRankings[position]?.benchAvg;
                        const starterRank = starterRanking?.ranks?.[manager.manager];
                        const benchRank = benchRanking?.ranks?.[manager.manager];
                        const starterManagerTotal = starterRanking?.total;
                        const benchManagerTotal = benchRanking?.total;
                        const {
                          percent: starterPercent,
                          trackColor: starterTrackColor,
                          fillColor: starterFillColor,
                          beadPercent: starterBeadPercent,
                          beadColor: starterBeadColor
                        } = getRankVisuals(starterRank, starterManagerTotal);
                        const {
                          percent: benchPercent,
                          trackColor: benchTrackColor,
                          fillColor: benchFillColor,
                          beadPercent: benchBeadPercent,
                          beadColor: benchBeadColor
                        } = getRankVisuals(benchRank, benchManagerTotal);
                        const benchPreview = bench.slice(0, 3);
                        const extraBench = Math.max(0, benchCount - benchPreview.length);
                        return (
                          <td key={position} className="px-3 py-3 align-top">
                            <div className="rounded-lg border border-gray-200 p-2 space-y-3">
                              <div>
                                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                  <span>Starter Avg</span>
                                  <div className="text-[11px] text-gray-700">
                                    {starterAvg != null ? formatPoints(starterAvg) : '—'}
                                  </div>
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                  <div
                                    className="relative h-2 flex-1 overflow-hidden rounded-full"
                                    style={{ backgroundColor: starterTrackColor }}
                                  >
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${starterPercent}%`,
                                        backgroundColor: starterFillColor
                                      }}
                                    />
                                    {starterBeadPercent != null ? (
                                      <div
                                        className="absolute inset-y-0 left-0 rounded-full"
                                        style={{
                                          width: `${Math.max(starterBeadPercent, 4)}%`,
                                          maxWidth: '12px',
                                          minWidth: '6px',
                                          backgroundColor: starterBeadColor
                                        }}
                                      />
                                    ) : null}
                                  </div>
                                  {starterRank != null && starterManagerTotal ? (
                                    <span
                                      className="text-[10px] font-semibold"
                                      style={{ color: starterFillColor || starterBeadColor || starterTrackColor }}
                                    >
                                      #{starterRank}
                                    </span>
                                  ) : null}
                                </div>
                                {starters.length > 0 && (
                                  <div className="mt-2 space-y-0.5 text-[11px] text-gray-500">
                                    {starters.map(player => (
                                      <div key={`${manager.manager}-${position}-starter-${player.id}`} className="truncate">
                                        {player.name} ({formatPoints(player.projPts)})
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                  <span>Bench Avg</span>
                                  <div className="text-[11px] text-gray-700">
                                    {benchAvg != null ? formatPoints(benchAvg) : '—'}
                                  </div>
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                  <div
                                    className="relative h-2 flex-1 overflow-hidden rounded-full"
                                    style={{ backgroundColor: benchTrackColor }}
                                  >
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${benchPercent}%`,
                                        backgroundColor: benchFillColor
                                      }}
                                    />
                                    {benchBeadPercent != null ? (
                                      <div
                                        className="absolute inset-y-0 left-0 rounded-full"
                                        style={{
                                          width: `${Math.max(benchBeadPercent, 4)}%`,
                                          maxWidth: '12px',
                                          minWidth: '6px',
                                          backgroundColor: benchBeadColor
                                        }}
                                      />
                                    ) : null}
                                  </div>
                                  {benchRank != null && benchManagerTotal ? (
                                    <span
                                      className="text-[10px] font-semibold"
                                      style={{ color: benchFillColor || benchBeadColor || benchTrackColor }}
                                    >
                                      #{benchRank}
                                    </span>
                                  ) : null}
                                </div>
                                {benchPreview.length > 0 ? (
                                  <div className="mt-2 space-y-0.5 text-[11px] text-gray-500">
                                    {benchPreview.map(player => (
                                      <div key={`${manager.manager}-${position}-bench-${player.id}`} className="truncate">
                                        {player.name} ({formatPoints(player.projPts)})
                                      </div>
                                    ))}
                                    {extraBench > 0 && (
                                      <div className="text-[11px] text-gray-400">+{extraBench} more</div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="mt-2 text-[11px] text-gray-400">No bench players</div>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <input
          type="text"
          placeholder="Search players"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-4 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left align-top">
                  <div className="flex items-center">
                    {renderSortButton('Player', 'name')}
                    <FilterDropdown filterKey="name">
                      {({ close }) => (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Player name</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                              onClick={() => setFilters(prev => ({ ...prev, name: '' }))}
                            >
                              Clear
                            </button>
                          </div>
                          <input
                            className="w-full rounded-md border border-gray-300 px-2 py-1 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="Contains..."
                            value={filters.name}
                            onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                              onClick={close}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </FilterDropdown>
                  </div>
                </th>
                <th className="px-3 py-3 text-left align-top">
                  <div className="flex items-center">
                    {renderSortButton('Team', 'team')}
                    <FilterDropdown filterKey="team">
                      {({ close }) => (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Teams</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                              onClick={() => clearListFilter('team')}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                            {availableTeams.map(team => (
                              <label key={team} className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  className="rounded"
                                  checked={filters.team.includes(team)}
                                  onChange={() => toggleListFilter('team', team)}
                                />
                                <span>{team}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                              onClick={close}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </FilterDropdown>
                  </div>
                </th>
                <th className="px-3 py-3 text-left align-top">
                  <div className="flex items-center">
                    {renderSortButton('Pos', 'position')}
                    <FilterDropdown filterKey="position" widthClass="w-80">
                      {({ close }) => (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Positions</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                              onClick={clearPositionFilters}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                            {availablePositions.map(position => {
                              const included = filters.position.includes(position);
                              const excluded = excludedPositions.includes(position);
                              return (
                                <div
                                  key={position}
                                  className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-2 py-1 text-sm"
                                >
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      className="rounded"
                                      checked={included}
                                      onChange={() => togglePosition(position)}
                                    />
                                    <span>{position}</span>
                                  </label>
                                  <button
                                    type="button"
                                    className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${excluded ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                    onClick={() => toggleExcludedPosition(position)}
                                  >
                                    {excluded ? 'Excluded' : 'Exclude'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              className="text-sm text-gray-500 hover:text-gray-700"
                              onClick={clearPositionFilters}
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                              onClick={close}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </FilterDropdown>
                  </div>
                </th>
                <th className="px-3 py-3 text-left align-top">
                  <div className="flex items-center">
                    {renderSortButton('Manager', 'manager')}
                    <FilterDropdown filterKey="manager">
                      {({ close }) => (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Managers</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                              onClick={() => clearListFilter('manager')}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                            {availableManagers.map(manager => (
                              <label key={manager} className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  className="rounded"
                                  checked={filters.manager.includes(manager)}
                                  onChange={() => toggleListFilter('manager', manager)}
                                />
                                <span>{manager}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                              onClick={close}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </FilterDropdown>
                  </div>
                </th>
                <th className="px-3 py-3 text-right align-top">
                  <div className="flex items-center justify-end">
                    {renderSortButton('Draft $', 'draftCost', 'right')}
                    <FilterDropdown filterKey="draftCost" align="right">
                      {({ close }) => (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Draft cost</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                              onClick={() => clearNumericFilter('draftCost')}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                              value={filters.draftCost.operator}
                              onChange={handleNumericFilterChange('draftCost', 'operator')}
                            >
                              <option value="">Any</option>
                              {NUMERIC_OPERATORS.map(op => (
                                <option key={op} value={op}>{op}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="w-full rounded-md border border-gray-300 px-2 py-1 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              placeholder="Value"
                              value={filters.draftCost.value}
                              onChange={handleNumericFilterChange('draftCost', 'value')}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="text-sm text-gray-500 hover:text-gray-700"
                              onClick={() => { clearNumericFilter('draftCost'); close(); }}
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                              onClick={close}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </FilterDropdown>
                  </div>
                </th>
                <th className="px-3 py-3 text-right align-top">
                  <div className="flex items-center justify-end">
                    {renderSortButton('Proj. Pts', 'projPts', 'right')}
                    <FilterDropdown filterKey="projPts" align="right">
                      {({ close }) => (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Projected points</span>
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                              onClick={() => clearNumericFilter('projPts')}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                              value={filters.projPts.operator}
                              onChange={handleNumericFilterChange('projPts', 'operator')}
                            >
                              <option value="">Any</option>
                              {NUMERIC_OPERATORS.map(op => (
                                <option key={op} value={op}>{op}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="any"
                              className="w-full rounded-md border border-gray-300 px-2 py-1 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              placeholder="Value"
                              value={filters.projPts.value}
                              onChange={handleNumericFilterChange('projPts', 'value')}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="text-sm text-gray-500 hover:text-gray-700"
                              onClick={() => { clearNumericFilter('projPts'); close(); }}
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                              onClick={close}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </FilterDropdown>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedPlayers.map(renderRow)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

