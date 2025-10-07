import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart3, ArrowLeft, RefreshCw } from 'lucide-react';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

const NUMERIC_OPERATORS = ['>', '>=', '<', '<=', '='];

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
  const password = process.env.REACT_APP_ANALYTICS_PASSWORD || 'admin';
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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

  const handleSort = field => {
    const strFields = ['name', 'team', 'position', 'manager'];
    const actualField = strFields.includes(field) ? `${field}Lower` : field;
    if (actualField === sortField) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(actualField);
      setSortDir('asc');
    }
  };

  const handleMultiSelectChange = (field) => (event) => {
    const selected = Array.from(event.target.selectedOptions || [], option => option.value);
    setFilters(prev => ({
      ...prev,
      [field]: selected
    }));
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
    setFilters(prev => ({
      ...prev,
      position: prev.position.includes(position)
        ? prev.position.filter(p => p !== position)
        : [...prev.position, position]
    }));
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
                <th className="px-3 py-2 text-left cursor-pointer" onClick={() => handleSort('name')}>Player</th>
                <th className="px-3 py-2 text-left cursor-pointer" onClick={() => handleSort('team')}>Team</th>
                <th className="px-3 py-2 text-left cursor-pointer" onClick={() => handleSort('position')}>Pos</th>
                <th className="px-3 py-2 text-left cursor-pointer" onClick={() => handleSort('manager')}>Manager</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('draftCost')}>Draft $</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('projPts')}>Proj. Pts</th>
              </tr>
              <tr>
                <th className="px-3 py-1">
                  <input
                    className="w-full px-1 py-1 border border-gray-300 rounded"
                    value={filters.name}
                    onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
                  />
                </th>
                <th className="px-3 py-1">
                  <select
                    multiple
                    className="w-full px-1 py-1 border border-gray-300 rounded h-24"
                    value={filters.team}
                    onChange={handleMultiSelectChange('team')}
                  >
                    {availableTeams.map(team => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-3 py-1">
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {availablePositions.map(position => {
                        const included = filters.position.includes(position);
                        const excluded = excludedPositions.includes(position);
                        return (
                          <div
                            key={position}
                            className="flex flex-col items-start gap-1 border border-gray-200 rounded px-2 py-1 text-xs"
                          >
                            <label className="inline-flex items-center gap-1">
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
                              className={`px-2 py-0.5 rounded transition-colors ${
                                excluded
                                  ? 'bg-red-500 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                              onClick={() => toggleExcludedPosition(position)}
                            >
                              {excluded ? 'Excluded' : 'Exclude'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </th>
                <th className="px-3 py-1">
                  <select
                    multiple
                    className="w-full px-1 py-1 border border-gray-300 rounded h-24"
                    value={filters.manager}
                    onChange={handleMultiSelectChange('manager')}
                  >
                    {availableManagers.map(manager => (
                      <option key={manager} value={manager}>
                        {manager}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-3 py-1">
                  <div className="flex items-center gap-1">
                    <select
                      className="px-1 py-1 border border-gray-300 rounded"
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
                      className="w-full px-1 py-1 border border-gray-300 rounded"
                      placeholder="Value"
                      value={filters.draftCost.value}
                      onChange={handleNumericFilterChange('draftCost', 'value')}
                    />
                  </div>
                </th>
                <th className="px-3 py-1">
                  <div className="flex items-center gap-1">
                    <select
                      className="px-1 py-1 border border-gray-300 rounded"
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
                      className="w-full px-1 py-1 border border-gray-300 rounded"
                      placeholder="Value"
                      value={filters.projPts.value}
                      onChange={handleNumericFilterChange('projPts', 'value')}
                    />
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

