import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, ArrowLeft } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';

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
        const [playerRes, rosterRes, statsRes] = await Promise.all([
          fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json()),
          fetch(`${API_BASE_URL}/seasons/${year}/keepers`).then(r => r.json()),
          fetch(`https://api.sleeper.app/v1/stats/nfl/players/${year}?season_type=regular`).then(r => r.json()).catch(() => ({}))
        ]);

        const rosterMap = {};
        const draftCostMap = {};
        (rosterRes.rosters || []).forEach(r => {
          r.players.forEach(p => {
            rosterMap[p.id] = r.manager_name;
            if (p.draft_cost) {
              draftCostMap[p.id] = Number(p.draft_cost);
            }
          });
        });

        const allowedPositions = ['QB', 'WR', 'RB', 'TE', 'DEF'];
        const allPlayers = Object.entries(playerRes)
          .filter(([_, p]) => {
            const pos = p.position || '';
            return pos
              .split(',')
              .some(position => allowedPositions.includes(position.trim()));
          })
          .map(([id, p]) => {
            const name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
            const nameVal = name || id;
            const teamVal = p.team || '';
            const positionVal = p.position || '';
            const managerVal = rosterMap[id] || '';
            const stats = statsRes[id] || {};
            const pts = stats.pts_ppr || stats.pts_half_ppr || stats.pts_std || 0;
            const passYds = stats.pass_yd || 0;
            const passTds = stats.pass_td || 0;
            const rushYds = stats.rush_yd || 0;
            const rushTds = stats.rush_td || 0;
            const recYds = stats.rec_yd || 0;
            const recTds = stats.rec_td || 0;
            const draftCost = draftCostMap[id] || 0;
            return {
              id,
              name: nameVal,
              team: teamVal,
              position: positionVal,
              manager: managerVal,
              draftCost,
              points: pts,
              passYds,
              passTds,
              rushYds,
              rushTds,
              recYds,
              recTds,
              nameLower: nameVal.toLowerCase(),
              teamLower: teamVal.toLowerCase(),
              positionLower: positionVal.toLowerCase(),
              managerLower: managerVal.toLowerCase()
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

  const Row = ({ index, style, data }) => {
    const p = data[index];
    return (
      <tr
        style={{ ...style, display: 'table', tableLayout: 'fixed', width: '100%' }}
        className="divide-y divide-gray-200"
      >
        <td className="px-3 py-2 whitespace-nowrap">{p.name}</td>
        <td className="px-3 py-2 whitespace-nowrap">{p.team}</td>
        <td className="px-3 py-2 whitespace-nowrap">{p.position}</td>
        <td className="px-3 py-2 whitespace-nowrap">{p.manager || ''}</td>
        <td className="px-3 py-2 whitespace-nowrap text-right">{p.draftCost ? `$${p.draftCost}` : ''}</td>
        <td className="px-3 py-2 whitespace-nowrap text-right">{p.points}</td>
        <td className="px-3 py-2 whitespace-nowrap text-right">{p.passYds}</td>
        <td className="px-3 py-2 whitespace-nowrap text-right">{p.passTds}</td>
        <td className="px-3 py-2 whitespace-nowrap text-right">{p.rushYds}</td>
        <td className="px-3 py-2 whitespace-nowrap text-right">{p.rushTds}</td>
        <td className="px-3 py-2 whitespace-nowrap text-right">{p.recYds}</td>
        <td className="px-3 py-2 whitespace-nowrap text-right">{p.recTds}</td>
      </tr>
    );
  };

  const TBody = React.forwardRef(({ style, ...rest }, ref) => (
    <tbody
      ref={ref}
      className="divide-y divide-gray-200"
      style={{ ...style, display: 'block' }}
      {...rest}
    />
  ));

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
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('points')}>Pts</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('passYds')}>Pass Yds</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('passTds')}>Pass TDs</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('rushYds')}>Rush Yds</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('rushTds')}>Rush TDs</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('recYds')}>Rec Yds</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('recTds')}>Rec TDs</th>
              </tr>
            </thead>
            <List
              height={400}
              itemCount={sortedPlayers.length}
              itemSize={40}
              width={"100%"}
              itemData={sortedPlayers}
              outerElementType={TBody}
            >
              {Row}
            </List>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

