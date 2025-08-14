import React, { useState, useEffect } from 'react';
import { Trophy, Users, TrendingUp, BookOpen, BarChart3, Award, Zap, Crown, Target, ChevronDown, Upload } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const FantasyFootballApp = () => {
  const [activeTab, setActiveTab] = useState('records');
  const [selectedManager, setSelectedManager] = useState('');
  const [managers, setManagers] = useState([]);
  const [teamSeasons, setTeamSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
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
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/upload-excel`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      await fetchData();
      alert('Data uploaded successfully!');
    } catch (err) {
      alert('Error uploading file: ' + err.message);
    } finally {
      setLoading(false);
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
        totalWins: 0,
        totalLosses: 0,
        totalPointsFor: 0,
        totalPointsAgainst: 0,
        totalPayout: 0,
        totalDues: 0,
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

    teamSeasons.forEach(season => {
      if (records[season.name_id]) {
        const record = records[season.name_id];
        record.totalWins += season.wins;
        record.totalLosses += season.losses;
        record.totalPointsFor += season.points_for;
        record.totalPointsAgainst += season.points_against;
        record.totalPayout += season.payout || 0;
        record.totalDues += season.dues || 200;
        record.seasons += 1;
        record.gamesPlayed += (season.wins + season.losses);
        
        if (season.playoff_finish === 1) record.championships += 1;
        if (season.playoff_finish === 2) record.secondPlace += 1;
        if (season.playoff_finish === 3) record.thirdPlace += 1;
        
        if (season.regular_season_rank === 10) record.chumpionships += 1;
        if (season.regular_season_rank <= 6) record.playoffAppearances += 1;
        
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
      record.netEarnings = record.totalPayout - record.totalDues;
      record.totalMedals = record.championships + record.secondPlace + record.thirdPlace;
    });

    return records;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading FF Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{error}</p>
            <button 
              onClick={fetchData}
              className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allRecords = calculateAllRecords();
  const activeRecords = Object.values(allRecords).filter(r => r.active);
  const inactiveRecords = Object.values(allRecords).filter(r => !r.active);

  const mostRecentYear = teamSeasons.length > 0 ? Math.max(...teamSeasons.map(s => s.year)) : new Date().getFullYear();
  const currentYearSeasons = teamSeasons.filter(s => s.year === mostRecentYear);
  const currentChampion = currentYearSeasons.find(s => s.playoff_finish === 1);
  const currentChumpion = currentYearSeasons.find(s => s.regular_season_rank === 10);

  const medalRankings = [...activeRecords, ...inactiveRecords].sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    if (b.secondPlace !== a.secondPlace) return b.secondPlace - a.secondPlace;
    return b.thirdPlace - a.thirdPlace;
  });

  const chumpionRankings = [...activeRecords, ...inactiveRecords].sort((a, b) => b.chumpionships - a.chumpionships);
  
  const winPctRankings = [
    ...activeRecords.sort((a, b) => b.winPct - a.winPct),
    ...inactiveRecords.sort((a, b) => b.winPct - a.winPct)
  ];

  const ppgRankings = [
    ...activeRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame),
    ...inactiveRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame)
  ];

  const rulesContent = `# League Rules

## Keeper Rules
- Each manager may keep **up to 2 players** from year to year.
- A player **cannot be kept more than two consecutive years**, regardless of which manager keeps the player.

## Draft Rules
- **Base draft salary:** **$200** per team.
- **Nomination order:** reverse of the previous season's final **regular season** standings.

## 2025 League Dues & Payouts
- **2025 League Dues:** **$250** per team.

### 2025 Payouts
- **$1,250** to **1st place**
- **$650** to **2nd place**
- **$300** for **best regular season record**
- **$300** for **most regular season points**

## Playoffs
- **6 teams** qualify.
- Weeks **15, 16, 17**.
- **Seeds 1 & 2** receive **byes in Week 15**.`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <h1 className="text-3xl font-bold text-gray-900">FF Dashboard</h1>
            </div>
            <nav className="flex space-x-6">
              <button
                onClick={() => setActiveTab('records')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'records' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Hall of Records
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'admin' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Admin
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'rules' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Rules
              </button>
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'records' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Crown className="w-6 h-6" />
                      <span className="text-sm font-medium opacity-90">{mostRecentYear} CHAMPION</span>
                    </div>
                    <h2 className="text-2xl font-bold">
                      {currentChampion ? allRecords[currentChampion.name_id]?.name : 'TBD'}
                    </h2>
                    <p className="text-yellow-100">
                      {currentChampion ? `${currentChampion.team_name} • ${currentChampion.wins}-${currentChampion.losses} Record` : 'Season in progress'}
                    </p>
                    <p className="text-yellow-100 font-semibold">
                      {currentChampion ? `$${currentChampion.payout} Prize Money` : ''}
                    </p>
                  </div>
                  <Trophy className="w-12 h-12 text-yellow-200" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-red-400 to-red-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Target className="w-6 h-6" />
                      <span className="text-sm font-medium opacity-90">{mostRecentYear} CHUMPION</span>
                    </div>
                    <h2 className="text-2xl font-bold">
                      {currentChumpion ? allRecords[currentChumpion.name_id]?.name : 'TBD'}
                    </h2>
                    <p className="text-red-100">
                      {currentChumpion ? `${currentChumpion.team_name} • ${currentChumpion.wins}-${currentChumpion.losses} Record` : 'Season in progress'}
                    </p>
                    <p className="text-red-100 font-semibold">Paid $50 Extra to Champion</p>
                  </div>
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-2xl">
                    🏮
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Award className="w-5 h-5 text-yellow-500" />
                <span>Medal Count Rankings</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {medalRankings.map((manager, index) => (
                  <div key={manager.name} className={`p-4 rounded-lg border ${
                    manager.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-75'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-lg">#{index + 1}</span>
                        <span className={`font-semibold ${manager.active ? 'text-gray-900' : 'text-gray-600'}`}>
                          {manager.name}
                        </span>
                        {!manager.active && <span className="text-xs text-gray-500">INACTIVE</span>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      {manager.championships > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                          <span>{manager.championships}</span>
                        </div>
                      )}
                      {manager.secondPlace > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                          <span>{manager.secondPlace}</span>
                        </div>
                      )}
                      {manager.thirdPlace > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-amber-600 rounded-full"></div>
                          <span>{manager.thirdPlace}</span>
                        </div>
                      )}
                      {manager.totalMedals === 0 && (
                        <span className="text-gray-500 italic">No medals</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-green-500" />
                <span>Franchise Win/Loss Records</span>
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Rank</th>
                      <th className="text-left p-2">Manager</th>
                      <th className="text-left p-2">Record</th>
                      <th className="text-left p-2">Win %</th>
                      <th className="text-left p-2">Seasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winPctRankings.map((manager, index) => (
                      <tr key={manager.name} className={`border-b ${
                        manager.active ? '' : 'bg-gray-50 opacity-75'
                      }`}>
                        <td className="p-2 font-bold">#{index + 1}</td>
                        <td className={`p-2 font-semibold ${manager.active ? 'text-gray-900' : 'text-gray-600'}`}>
                          {manager.name}
                          {!manager.active && <span className="ml-2 text-xs text-gray-500">INACTIVE</span>}
                        </td>
                        <td className="p-2">{manager.totalWins}-{manager.totalLosses}</td>
                        <td className="p-2 font-bold">{(manager.winPct * 100).toFixed(1)}%</td>
                        <td className="p-2">{manager.seasons}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <span>Manager Lookup</span>
              </h3>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select a Manager
                </label>
                <div className="relative">
                  <select
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                  >
                    <option value="">Choose a manager...</option>
                    {managers.map(manager => (
                      <option key={manager.name_id} value={manager.name_id}>
                        {manager.full_name} {!manager.active ? '(Inactive)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {selectedManager && allRecords[selectedManager] && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-2xl font-bold text-gray-900">
                      {allRecords[selectedManager].name}
                    </h4>
                    {!allRecords[selectedManager].active && (
                      <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 mb-1">Franchise Record</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {allRecords[selectedManager].totalWins}-{allRecords[selectedManager].totalLosses}
                      </p>
                      <p className="text-sm text-gray-500">
                        {(allRecords[selectedManager].winPct * 100).toFixed(1)}% win rate
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 mb-1">Championships</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {allRecords[selectedManager].championships}
                      </p>
                      <p className="text-sm text-gray-500">
                        {allRecords[selectedManager].totalMedals} total medals
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 mb-1">Net Earnings</p>
                      <p className={`text-2xl font-bold ${
                        allRecords[selectedManager].netEarnings >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {allRecords[selectedManager].netEarnings >= 0 ? '+' : '-'}${Math.abs(allRecords[selectedManager].netEarnings)}
                      </p>
                      <p className="text-sm text-gray-500">
                        ${allRecords[selectedManager].totalPayout} won - ${allRecords[selectedManager].totalDues} dues
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 mb-1">Points Per Game</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {allRecords[selectedManager].pointsPerGame.toFixed(1)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {allRecords[selectedManager].gamesPlayed} games played
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-blue-500" />
                <span>Data Management</span>
              </h3>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          Upload Excel file to update data
                        </span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          accept=".xlsx,.xls"
                          className="sr-only"
                          onChange={handleFileUpload}
                        />
                        <span className="mt-1 block text-sm text-gray-500">
                          Excel files (.xlsx, .xls) up to 10MB
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Total Managers</p>
                    <p className="text-2xl font-bold text-blue-600">{managers.length}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Season Records</p>
                    <p className="text-2xl font-bold text-green-600">{teamSeasons.length}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Years Covered</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {teamSeasons.length > 0 ? new Set(teamSeasons.map(s => s.year)).size : 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-8">
              <BookOpen className="w-8 h-8 text-blue-500" />
              <h2 className="text-3xl font-bold text-gray-900">League Rules</h2>
            </div>
            <div className="prose prose-lg max-w-none">
              {rulesContent.split('\n').map((line, index) => {
                if (line.startsWith('# ')) {
                  return <h1 key={index} className="text-3xl font-bold text-gray-900 mt-8 mb-4">{line.slice(2)}</h1>;
                } else if (line.startsWith('## ')) {
                  return <h2 key={index} className="text-2xl font-bold text-gray-800 mt-6 mb-3">{line.slice(3)}</h2>;
                } else if (line.startsWith('### ')) {
                  return <h3 key={index} className="text-xl font-bold text-gray-700 mt-4 mb-2">{line.slice(4)}</h3>;
                } else if (line.startsWith('- ')) {
                  return <li key={index} className="ml-4 text-gray-700 mb-1">{line.slice(2)}</li>;
                } else if (line.includes('**') && line.includes('**')) {
                  const parts = line.split('**');
                  return (
                    <p key={index} className="text-gray-700 mb-2">
                      {parts.map((part, i) => 
                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                      )}
                    </p>
                  );
                } else if (line.trim() === '' || line.trim() === '---') {
                  return <br key={index} />;
                } else {
                  return <p key={index} className="text-gray-700 mb-2">{line}</p>;
                }
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FantasyFootballApp;