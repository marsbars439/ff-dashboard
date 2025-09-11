import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, ArrowLeft } from 'lucide-react';

const Analytics = ({ onBack }) => {
  const [authorized, setAuthorized] = useState(false);
  const [input, setInput] = useState('');
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
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
        const [playerRes, rosterRes] = await Promise.all([
          fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json()),
          fetch(`${API_BASE_URL}/seasons/${year}/keepers`).then(r => r.json())
        ]);

        const rosterMap = {};
        (rosterRes.rosters || []).forEach(r => {
          r.players.forEach(p => {
            rosterMap[p.id] = r.manager_name;
          });
        });

        const allPlayers = Object.entries(playerRes).map(([id, p]) => {
          const name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
          return {
            id,
            name: name || id,
            team: p.team || '',
            position: p.position || '',
            manager: rosterMap[id] || ''
          };
        });

        setPlayers(allPlayers);
      } catch (e) {
        console.error('Failed to load players:', e);
      }
    };

    if (authorized) {
      fetchData();
    }
  }, [authorized, API_BASE_URL]);

  const sortedPlayers = useMemo(() => {
    const filtered = players.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.manager.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.sort((a, b) => {
      const valA = (a[sortField] || '').toLowerCase();
      const valB = (b[sortField] || '').toLowerCase();
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [players, search, sortField, sortDir]);

  const handleSort = field => {
    if (field === sortField) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedPlayers.map(p => (
                <tr key={p.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{p.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.team}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.position}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.manager || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

