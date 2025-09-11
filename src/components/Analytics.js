import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart3, ArrowLeft, RefreshCw } from 'lucide-react';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function normalizeName(name = '') {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function createKey(name, team, position) {
  return `${normalizeName(name)}|${(team || '').toLowerCase()}|${(position || '').toLowerCase()}`;
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
    try {
      const [rankingRes, rosterRes] = await Promise.all([
        fetch(`${API_BASE_URL}/ros-rankings`).then(r => r.json()),
        fetch(`${API_BASE_URL}/seasons/${year}/keepers`).then(r => r.json())
      ]);

      // Support both array and object API responses
      const rankings = Array.isArray(rankingRes)
        ? rankingRes
        : rankingRes.rankings || [];
      const rosters = Array.isArray(rosterRes)
        ? rosterRes
        : rosterRes.rosters || [];

      const playerMap = {};

      // Seed player map with roster data so players show even if rankings fail
      rosters.forEach(r => {
        (r.players || []).forEach(p => {
          const teamVal = p.team || '';
          const positionVal = p.position || '';
          const key = createKey(p.name, teamVal, positionVal);
          playerMap[key] = {
            id: key,
            name: p.name,
            team: teamVal,
            position: positionVal,
            manager: r.manager_name,
            draftCost: p.draft_cost ? Number(p.draft_cost) : 0,
            projPts: 0,
            sosSeason: 0,
            sosPlayoffs: 0,
            nameLower: normalizeName(p.name),
            teamLower: teamVal.toLowerCase(),
            positionLower: positionVal.toLowerCase(),
            managerLower: (r.manager_name || '').toLowerCase()
          };
        });
      });

      // Merge in rankings data
      rankings.forEach(p => {
        const teamVal = p.team || '';
        const positionVal = p.position || '';
        const key = createKey(p.player_name, teamVal, positionVal);
        const existing = playerMap[key] || {
          id: key,
          name: p.player_name,
          team: teamVal,
          position: positionVal,
          manager: '',
          draftCost: 0,
          projPts: 0,
          sosSeason: 0,
          sosPlayoffs: 0,
          nameLower: normalizeName(p.player_name),
          teamLower: teamVal.toLowerCase(),
          positionLower: positionVal.toLowerCase(),
          managerLower: ''
        };
        existing.projPts = p.proj_pts || 0;
        existing.sosSeason = p.sos_season || 0;
        existing.sosPlayoffs = p.sos_playoffs || 0;
        playerMap[key] = existing;
      });

      setPlayers(Object.values(playerMap));
    } catch (e) {
      console.error('Failed to load rankings:', e);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    if (authorized) {
      loadData();
    }
  }, [authorized, loadData]);

  const refreshRankings = async () => {
    setRefreshing(true);
    setRefreshMessage('Requesting ROS rankings refresh...');
    try {
      const res = await fetch(`${API_BASE_URL}/ros-rankings/refresh`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('Refresh request failed');
      }
      setRefreshMessage('Loading updated rankings...');
      await loadData();
      setRefreshMessage('ROS rankings refreshed successfully.');
    } catch (e) {
      console.error('Failed to refresh ROS rankings:', e);
      setRefreshMessage('Failed to refresh ROS rankings.');
    } finally {
      setRefreshing(false);
    }
  };

  const sortedPlayers = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    const filtered = players.filter(p =>
      p.nameLower.includes(searchLower) || p.managerLower.includes(searchLower)
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
  }, [players, debouncedSearch, sortField, sortDir]);

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

  const renderRow = p => (
    <tr key={p.id} className="divide-y divide-gray-200">
      <td className="px-3 py-2 whitespace-nowrap">{p.name}</td>
      <td className="px-3 py-2 whitespace-nowrap">{p.team}</td>
      <td className="px-3 py-2 whitespace-nowrap">{p.position}</td>
      <td className="px-3 py-2 whitespace-nowrap">{p.manager || ''}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right">{p.draftCost ? `$${p.draftCost}` : ''}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right">{p.projPts}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right">{p.sosSeason}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right">{p.sosPlayoffs}</td>
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
          onClick={refreshRankings}
          disabled={refreshing}
          className="mb-2 flex items-center bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Pull ROS Rankings from FantasyPros
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
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('sosSeason')}>SOS Season</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('sosPlayoffs')}>SOS Playoffs</th>
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

