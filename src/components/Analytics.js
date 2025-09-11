import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, ArrowLeft } from 'lucide-react';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === password) {
      setAuthorized(true);
    } else {
      alert('Incorrect password');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
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

        const rosterMap = {};
        const draftCostMap = {};
        rosters.forEach(r => {
          (r.players || []).forEach(p => {
            const nameLower = (p.name || '').toLowerCase();
            rosterMap[nameLower] = r.manager_name;
            if (p.draft_cost) {
              draftCostMap[nameLower] = Number(p.draft_cost);
            }
          });
        });

        const allPlayers = rankings.map(p => {
          const nameLower = (p.player_name || '').toLowerCase();
          const teamVal = p.team || '';
          const positionVal = p.position || '';
          const managerVal = rosterMap[nameLower] || '';
          const draftCost = draftCostMap[nameLower] || 0;
          return {
            id: `${nameLower}-${teamVal}-${positionVal}`,
            name: p.player_name,
            team: teamVal,
            position: positionVal,
            manager: managerVal,
            draftCost,
            projPts: p.proj_pts || 0,
            sosSeason: p.sos_season || 0,
            sosPlayoffs: p.sos_playoffs || 0,
            nameLower,
            teamLower: teamVal.toLowerCase(),
            positionLower: positionVal.toLowerCase(),
            managerLower: managerVal.toLowerCase()
          };
        });

        setPlayers(allPlayers);
      } catch (e) {
        console.error('Failed to load rankings:', e);
      }
    };

    if (authorized) {
      fetchData();
    }
  }, [authorized, API_BASE_URL]);

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

