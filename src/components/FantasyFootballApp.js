import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Crown, 
  Target, 
  Award, 
  BarChart3, 
  TrendingUp, 
  Upload, 
  Plus, 
  FileText,
  ChevronDown,
  BookOpen,
  Users,
  Zap,
  Edit3,
  Save,
  X,
  Trash2
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const FantasyFootballApp = () => {
  const [activeTab, setActiveTab] = useState('records');
  const [selectedManager, setSelectedManager] = useState('');
  const [managers, setManagers] = useState([]);
  const [teamSeasons, setTeamSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rulesContent, setRulesContent] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const [editedData, setEditedData] = useState({});

  useEffect(() => {
    fetchData();
    fetchRules();
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

  const startEdit = (season) => {
    setEditingRow(season.id);
    setEditedData({ ...season });
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditedData({});
  };

  const saveEdit = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/team-seasons/${editingRow}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedData),
      });
      
      if (response.ok) {
        await fetchData();
        setEditingRow(null);
        setEditedData({});
      } else {
        const error = await response.json();
        alert('Error: ' + error.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const deleteRow = async (id) => {
    if (!confirm('Are you sure you want to delete this season record?')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/team-seasons/${id}`, {
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

  const addNewRow = async () => {
    const newSeason = {
      year: new Date().getFullYear(),
      name_id: '',
      team_name: '',
      wins: 0,
      losses: 0,
      points_for: 0,
      points_against: 0,
      regular_season_rank: null,
      playoff_finish: null,
      dues: 250,
      payout: 0,
      dues_chumpion: 0,
      high_game: null
    };

    try {
      const response = await fetch(`${API_BASE_URL}/team-seasons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSeason),
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

  // Improved markdown rendering function
  const renderMarkdown = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    let listType = null;

    const processLine = (line, index) => {
      // Handle lists
      if (line.startsWith('- ')) {
        if (listType !== 'ul') {
          if (currentList.length > 0) {
            elements.push(createElement(listType, currentList, `list-${elements.length}`));
            currentList = [];
          }
          listType = 'ul';
        }
        currentList.push(processInlineFormatting(line.slice(2)));
        return;
      }

      // Flush any pending list
      if (currentList.length > 0) {
        elements.push(createElement(listType, currentList, `list-${elements.length}`));
        currentList = [];
        listType = null;
      }

      // Handle headers
      if (line.startsWith('# ')) {
        elements.push(<h1 key={index} className="text-2xl sm:text-3xl font-bold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4">{processInlineFormatting(line.slice(2))}</h1>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={index} className="text-xl sm:text-2xl font-bold text-gray-800 mt-4 sm:mt-6 mb-2 sm:mb-3">{processInlineFormatting(line.slice(3))}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={index} className="text-lg sm:text-xl font-bold text-gray-700 mt-3 sm:mt-4 mb-2">{processInlineFormatting(line.slice(4))}</h3>);
      } else if (line.trim() === '' || line.trim() === '---') {
        elements.push(<br key={index} />);
      } else if (line.trim() !== '') {
        elements.push(<p key={index} className="text-gray-700 mb-2 text-sm sm:text-base">{processInlineFormatting(line)}</p>);
      }
    };

    const processInlineFormatting = (text) => {
      const parts = text.split(/(\*\*.*?\*\*)/);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    const createElement = (type, items, key) => {
      if (type === 'ul') {
        return (
          <ul key={key} className="list-disc list-inside ml-4 mb-4 space-y-1">
            {items.map((item, i) => (
              <li key={i} className="text-gray-700 text-sm sm:text-base">{item}</li>
            ))}
          </ul>
        );
      }
      return null;
    };

    lines.forEach(processLine);

    // Flush any remaining list
    if (currentList.length > 0) {
      elements.push(createElement(listType, currentList, `list-${elements.length}`));
    }

    return elements;
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
      const validRanks = seasonsInYear.filter(s => s.regular_season_rank && s.regular_season_rank > 0);
      if (validRanks.length > 0) {
        const chumpion = validRanks.reduce((worst, current) => 
          current.regular_season_rank > worst.regular_season_rank ? current : worst
        );
        chumpionsByYear[year] = chumpion.name_id;
      }
    });

    teamSeasons.forEach(season => {
      if (records[season.name_id]) {
        const record = records[season.name_id];
        record.totalWins += season.wins;
        record.totalLosses += season.losses;
        record.totalPointsFor += season.points_for;
        record.totalPointsAgainst += season.points_against;
        record.totalPayout += season.payout || 0;
        record.totalDues += season.dues || 250;
        record.totalDuesChumpion += season.dues_chumpion || 0;
        record.seasons += 1;
        record.gamesPlayed += (season.wins + season.losses);
        
        if (season.playoff_finish === 1) record.championships += 1;
        if (season.playoff_finish === 2) record.secondPlace += 1;
        if (season.playoff_finish === 3) record.thirdPlace += 1;
        
        // Check if this manager was the chumpion this year
        if (chumpionsByYear[season.year] === season.name_id) {
          record.chumpionships += 1;
        }
        
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
      record.netEarnings = record.totalPayout - record.totalDues - record.totalDuesChumpion;
      record.totalMedals = record.championships + record.secondPlace + record.thirdPlace;
    });

    return records;
  };

  const getCurrentYearChumpionDues = () => {
    // Find the chumpion for the current year (highest regular_season_rank)
    const currentYearSeasonsWithRank = currentYearSeasons.filter(s => s.regular_season_rank && s.regular_season_rank > 0);
    if (currentYearSeasonsWithRank.length === 0) return 0;
    
    const currentChumpionSeason = currentYearSeasonsWithRank.reduce((worst, current) => 
      current.regular_season_rank > worst.regular_season_rank ? current : worst
    );
    return currentChumpionSeason?.dues_chumpion || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-24 w-24 sm:h-32 sm:w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-sm sm:text-base">Loading FF Dashboard...</p>
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
            <p className="text-sm">{error}</p>
            <button 
              onClick={fetchData}
              className="mt-2 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm"
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
  
  // Find current chumpion (highest regular_season_rank number)
  const currentYearSeasonsWithRank = currentYearSeasons.filter(s => s.regular_season_rank && s.regular_season_rank > 0);
  const currentChumpion = currentYearSeasonsWithRank.length > 0 
    ? currentYearSeasonsWithRank.reduce((worst, current) => 
        current.regular_season_rank > worst.regular_season_rank ? current : worst
      )
    : null;

  // FIXED SORTING: Active managers first, then inactive managers
  const medalRankings = [
    ...activeRecords.sort((a, b) => {
      if (b.championships !== a.championships) return b.championships - a.championships;
      if (b.secondPlace !== a.secondPlace) return b.secondPlace - a.secondPlace;
      return b.thirdPlace - a.thirdPlace;
    }),
    ...inactiveRecords.sort((a, b) => {
      if (b.championships !== a.championships) return b.championships - a.championships;
      if (b.secondPlace !== a.secondPlace) return b.secondPlace - a.secondPlace;
      return b.thirdPlace - a.thirdPlace;
    })
  ];

  const chumpionRankings = [
    ...activeRecords.sort((a, b) => b.chumpionships - a.chumpionships),
    ...inactiveRecords.sort((a, b) => b.chumpionships - a.chumpionships)
  ];
  
  const winPctRankings = [
    ...activeRecords.sort((a, b) => b.winPct - a.winPct),
    ...inactiveRecords.sort((a, b) => b.winPct - a.winPct)
  ];

  const ppgRankings = [
    ...activeRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame),
    ...inactiveRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame)
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">FF Dashboard</h1>
            </div>
            <nav className="flex flex-wrap justify-center sm:justify-end space-x-3 sm:space-x-6">
              <button
                onClick={() => setActiveTab('records')}
                className={`px-3 py-2 sm:px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                  activeTab === 'records' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Hall of Records
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-2 sm:px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                  activeTab === 'admin' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Admin
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-3 py-2 sm:px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {activeTab === 'records' && (
          <div className="space-y-6 sm:space-y-8">
            {/* Champion and Chumpion Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Champion Card */}
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl shadow-lg p-4 sm:p-6 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <Crown className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-medium opacity-90">{mostRecentYear} CHAMPION</span>
                    </div>
                    <h2 className="text-lg sm:text-2xl font-bold mb-1 truncate">
                      {currentChampion ? allRecords[currentChampion.name_id]?.name : 'TBD'}
                    </h2>
                    <p className="text-yellow-100 text-sm sm:text-base mb-2">
                      {currentChampion ? `${currentChampion.team_name} • ${currentChampion.wins}-${currentChampion.losses} Record` : 'Season in progress'}
                    </p>
                    <p className="text-yellow-100 font-semibold text-sm sm:text-base mb-3">
                      {currentChampion ? `$${currentChampion.payout} Prize Money` : ''}
                    </p>
                    {/* Show runner-up and 3rd place at bottom of champion card */}
                    {currentYearSeasons.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-yellow-300 text-xs sm:text-sm opacity-90">
                        {currentYearSeasons.find(s => s.playoff_finish === 2) && (
                          <div className="truncate">2nd: {allRecords[currentYearSeasons.find(s => s.playoff_finish === 2).name_id]?.name}</div>
                        )}
                        {currentYearSeasons.find(s => s.playoff_finish === 3) && (
                          <div className="truncate">3rd: {allRecords[currentYearSeasons.find(s => s.playoff_finish === 3).name_id]?.name}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-200 flex-shrink-0 ml-2" />
                </div>
              </div>

              {/* Chumpion Card */}
              <div className="bg-gradient-to-r from-red-400 to-red-600 rounded-xl shadow-lg p-4 sm:p-6 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <Target className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-medium opacity-90">{mostRecentYear} CHUMPION</span>
                    </div>
                    <h2 className="text-lg sm:text-2xl font-bold mb-1 truncate">
                      {currentChumpion ? allRecords[currentChumpion.name_id]?.name : 'TBD'}
                    </h2>
                    <p className="text-red-100 text-sm sm:text-base mb-2">
                      {currentChumpion ? `${currentChumpion.team_name} • ${currentChumpion.wins}-${currentChumpion.losses} Record` : 'Season in progress'}
                    </p>
                    <p className="text-red-100 font-semibold text-sm sm:text-base">
                      {getCurrentYearChumpionDues() > 0 ? `Paid $${getCurrentYearChumpionDues()} Extra to ${currentChampion ? allRecords[currentChampion.name_id]?.name : 'Champion'}` : 'Pays extra to Champion'}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500 rounded-full flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 ml-2">
                    💩
                  </div>
                </div>
              </div>
            </div>

            {/* Medal Count Rankings - MOBILE OPTIMIZED FULL WIDTH LAYOUT */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center space-x-2">
                <Award className="w-5 h-5 text-yellow-500" />
                <span>Medal Count Rankings</span>
              </h3>
              
              <div className="space-y-3 sm:space-y-4">
                {medalRankings.map((manager, index) => (
                  <div 
                    key={manager.name} 
                    className={`p-3 sm:p-4 rounded-lg border-2 transition-all duration-200 ${
                      manager.active 
                        ? 'bg-gradient-to-r from-white to-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-md' 
                        : 'bg-gray-50 border-gray-300 opacity-60'
                    }`}
                  >
                    {/* Mobile Layout - Stacked */}
                    <div className="sm:hidden">
                      {/* Mobile Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 && manager.active
                              ? 'bg-yellow-500 text-white shadow-lg'
                              : index === 1 && manager.active
                              ? 'bg-gray-400 text-white shadow-md'
                              : index === 2 && manager.active
                              ? 'bg-amber-600 text-white shadow-md'
                              : manager.active
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-400 text-gray-600'
                          }`}>
                            {index + 1}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <h4 className={`font-bold text-lg leading-tight truncate ${
                              manager.active ? 'text-gray-900' : 'text-gray-500'
                            }`}>
                              {manager.name}
                            </h4>
                            {!manager.active && (
                              <span className="text-xs text-gray-400 bg-gray-200 px-2 py-1 rounded-full">
                                INACTIVE
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Total Medals - Prominent on Mobile */}
                        <div className={`px-3 py-2 rounded-full text-lg font-bold ${
                          manager.totalMedals > 0 && manager.active
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {manager.totalMedals}
                        </div>
                      </div>

                      {/* Mobile Medal Breakdown */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Championships */}
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">🏆</span>
                            </div>
                          </div>
                          <span className={`font-bold text-lg ${
                            manager.championships > 0 && manager.active ? 'text-yellow-600' : 'text-gray-400'
                          }`}>
                            {manager.championships}
                          </span>
                          <div className={`text-xs ${manager.active ? 'text-gray-600' : 'text-gray-400'}`}>
                            Championships
                          </div>
                        </div>

                        {/* Second Place */}
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">🥈</span>
                            </div>
                          </div>
                          <span className={`font-bold text-lg ${
                            manager.secondPlace > 0 && manager.active ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            {manager.secondPlace}
                          </span>
                          <div className={`text-xs ${manager.active ? 'text-gray-600' : 'text-gray-400'}`}>
                            Runner-up
                          </div>
                        </div>

                        {/* Third Place */}
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <div className="w-4 h-4 bg-amber-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">🥉</span>
                            </div>
                          </div>
                          <span className={`font-bold text-lg ${
                            manager.thirdPlace > 0 && manager.active ? 'text-amber-600' : 'text-gray-400'
                          }`}>
                            {manager.thirdPlace}
                          </span>
                          <div className={`text-xs ${manager.active ? 'text-gray-600' : 'text-gray-400'}`}>
                            Third place
                          </div>
                        </div>
                      </div>

                      {/* Mobile Stats */}
                      {manager.active && (
                        <div className="mt-2 text-center text-xs text-gray-500">
                          {(manager.winPct * 100).toFixed(1)}% win rate • {manager.seasons} seasons
                        </div>
                      )}
                    </div>

                    {/* Desktop Layout - Horizontal */}
                    <div className="hidden sm:flex items-center justify-between">
                      {/* Left side - Rank and Name */}
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                          index === 0 && manager.active
                            ? 'bg-yellow-500 text-white shadow-lg'
                            : index === 1 && manager.active
                            ? 'bg-gray-400 text-white shadow-md'
                            : index === 2 && manager.active
                            ? 'bg-amber-600 text-white shadow-md'
                            : manager.active
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-400 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        
                        <div>
                          <h4 className={`font-bold text-xl ${
                            manager.active ? 'text-gray-900' : 'text-gray-500'
                          }`}>
                            {manager.name}
                          </h4>
                          {!manager.active && (
                            <span className="text-xs text-gray-400 bg-gray-200 px-2 py-1 rounded-full">
                              INACTIVE
                            </span>
                          )}
                          {manager.active && (
                            <div className="text-sm text-gray-500">
                              {(manager.winPct * 100).toFixed(1)}% win rate • {manager.seasons} seasons
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right side - Medal counts */}
                      <div className="flex items-center space-x-6">
                        {/* Championships */}
                        <div className="text-center">
                          <div className="flex items-center space-x-1 mb-1">
                            <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">🏆</span>
                            </div>
                            <span className={`text-xs font-medium ${manager.active ? 'text-gray-600' : 'text-gray-400'}`}>
                              Championships
                            </span>
                          </div>
                          <span className={`font-bold text-2xl ${
                            manager.championships > 0 && manager.active ? 'text-yellow-600' : 'text-gray-400'
                          }`}>
                            {manager.championships}
                          </span>
                        </div>

                        {/* Second Place */}
                        <div className="text-center">
                          <div className="flex items-center space-x-1 mb-1">
                            <div className="w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">🥈</span>
                            </div>
                            <span className={`text-xs font-medium ${manager.active ? 'text-gray-600' : 'text-gray-400'}`}>
                              Runner-up
                            </span>
                          </div>
                          <span className={`font-bold text-2xl ${
                            manager.secondPlace > 0 && manager.active ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            {manager.secondPlace}
                          </span>
                        </div>

                        {/* Third Place */}
                        <div className="text-center">
                          <div className="flex items-center space-x-1 mb-1">
                            <div className="w-5 h-5 bg-amber-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">🥉</span>
                            </div>
                            <span className={`text-xs font-medium ${manager.active ? 'text-gray-600' : 'text-gray-400'}`}>
                              Third place
                            </span>
                          </div>
                          <span className={`font-bold text-2xl ${
                            manager.thirdPlace > 0 && manager.active ? 'text-amber-600' : 'text-gray-400'
                          }`}>
                            {manager.thirdPlace}
                          </span>
                        </div>

                        {/* Total Medals */}
                        <div className="text-center">
                          <div className="text-xs font-medium text-gray-600 mb-1">
                            Total Medals
                          </div>
                          <div className={`px-4 py-2 rounded-full text-xl font-bold ${
                            manager.totalMedals > 0 && manager.active
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {manager.totalMedals}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Franchise Win/Loss and Points Scored Cards */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              {/* Franchise Win/Loss Records */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-green-500" />
                  <span>Franchise Win/Loss Records</span>
                </h3>
                
                <div className="space-y-2 sm:space-y-3">
                  {winPctRankings.map((manager, index) => (
                    <div 
                      key={manager.name} 
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        manager.active 
                          ? 'bg-white border-gray-200 hover:bg-gray-50' 
                          : 'bg-gray-50 border-gray-300 opacity-60'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <span className={`font-bold text-base sm:text-lg flex-shrink-0 ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                          #{index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold text-sm sm:text-base truncate ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                            {manager.name}
                            {!manager.active && <span className="text-xs text-gray-400 ml-2">(Inactive)</span>}
                          </p>
                          <p className={`text-xs sm:text-sm ${manager.active ? 'text-gray-600' : 'text-gray-400'}`}>
                            {manager.seasons} seasons
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm sm:text-base ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                          {manager.totalWins}-{manager.totalLosses}
                        </p>
                        <p className={`text-xs sm:text-sm ${manager.active ? 'text-green-600' : 'text-gray-400'}`}>
                          {(manager.winPct * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Franchise Points Scored */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <span>Franchise Points Scored</span>
                </h3>
                
                <div className="space-y-2 sm:space-y-3">
                  {ppgRankings.map((manager, index) => (
                    <div 
                      key={manager.name} 
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        manager.active 
                          ? 'bg-white border-gray-200 hover:bg-gray-50' 
                          : 'bg-gray-50 border-gray-300 opacity-60'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <span className={`font-bold text-base sm:text-lg flex-shrink-0 ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                          #{index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold text-sm sm:text-base truncate ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                            {manager.name}
                            {!manager.active && <span className="text-xs text-gray-400 ml-2">(Inactive)</span>}
                          </p>
                          <p className={`text-xs sm:text-sm ${manager.active ? 'text-gray-600' : 'text-gray-400'}`}>
                            {manager.gamesPlayed} games played
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm sm:text-base ${manager.active ? 'text-blue-600' : 'text-gray-500'}`}>
                          {manager.pointsPerGame.toFixed(1)} PPG
                        </p>
                        <p className={`text-xs sm:text-sm ${manager.active ? 'text-gray-600' : 'text-gray-400'}`}>
                          {manager.totalPointsFor.toLocaleString()} total
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chumpion Rankings */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center space-x-2">
                <Target className="w-5 h-5 text-red-500" />
                <span>Chumpion Count Rankings</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {chumpionRankings.map((manager, index) => (
                  <div key={manager.name} className={`p-3 sm:p-4 rounded-lg border ${
                    manager.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-75'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <span className="font-bold text-base sm:text-lg flex-shrink-0">#{index + 1}</span>
                        <span className={`font-semibold text-sm sm:text-base truncate ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                          {manager.name}
                        </span>
                      </div>
                      <span className={`text-lg sm:text-xl font-bold flex-shrink-0 ${
                        manager.chumpionships > 0 ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {manager.chumpionships}
                      </span>
                    </div>
                    {!manager.active && (
                      <span className="text-xs text-gray-400">(Inactive)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Individual Manager Lookup */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-500" />
                <span>Individual Manager Lookup</span>
              </h3>
              
              <div className="mb-4 sm:mb-6">
                <div className="relative">
                  <select
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-sm sm:text-base"
                  >
                    <option value="">Select a manager to view detailed stats</option>
                    {Object.entries(allRecords).map(([nameId, record]) => (
                      <option key={nameId} value={nameId}>
                        {record.name} {!record.active ? '(Inactive)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {selectedManager && allRecords[selectedManager] && (
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-2 sm:space-y-0">
                    <h4 className="text-xl sm:text-2xl font-bold text-gray-900">
                      {allRecords[selectedManager].name}
                    </h4>
                    {!allRecords[selectedManager].active && (
                      <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium self-start sm:self-auto">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <div className="bg-white p-3 sm:p-4 rounded-lg">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Franchise Record</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">
                        {allRecords[selectedManager].totalWins}-{allRecords[selectedManager].totalLosses}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {(allRecords[selectedManager].winPct * 100).toFixed(1)}% win rate
                      </p>
                    </div>
                    
                    <div className="bg-white p-3 sm:p-4 rounded-lg">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Championships</p>
                      <p className="text-xl sm:text-2xl font-bold text-yellow-600">
                        {allRecords[selectedManager].championships}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {allRecords[selectedManager].totalMedals} total medals
                      </p>
                    </div>
                    
                    <div className="bg-white p-3 sm:p-4 rounded-lg">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Net Earnings</p>
                      <p className={`text-xl sm:text-2xl font-bold ${
                        allRecords[selectedManager].netEarnings >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {allRecords[selectedManager].netEarnings >= 0 ? '+' : '-'}${Math.abs(allRecords[selectedManager].netEarnings)}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        ${allRecords[selectedManager].totalPayout} won - ${allRecords[selectedManager].totalDues + allRecords[selectedManager].totalDuesChumpion} dues
                      </p>
                    </div>
                    
                    <div className="bg-white p-3 sm:p-4 rounded-lg">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Points Per Game</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-600">
                        {allRecords[selectedManager].pointsPerGame.toFixed(1)}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
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
          <div className="space-y-6 sm:space-y-8">
            {/* Excel Upload Section */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-blue-500" />
                <span>Data Management</span>
              </h3>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6">
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
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
                        <span className="mt-1 block text-xs sm:text-sm text-gray-500">
                          Excel files only
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Managers</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600">{managers.length}</p>
                  </div>
                  <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Season Records</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{teamSeasons.length}</p>
                  </div>
                  <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Years Covered</p>
                    <p className="text-xl sm:text-2xl font-bold text-purple-600">
                      {teamSeasons.length > 0 ? new Set(teamSeasons.map(s => s.year)).size : 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Editable Data Table */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-2 sm:space-y-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <Edit3 className="w-5 h-5 text-green-500" />
                  <span>Season Data</span>
                </h3>
                <button
                  onClick={addNewRow}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2 text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Season</span>
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2 font-medium text-gray-700">Year</th>
                      <th className="text-left p-2 font-medium text-gray-700">Manager</th>
                      <th className="text-left p-2 font-medium text-gray-700">Team</th>
                      <th className="text-left p-2 font-medium text-gray-700">W-L</th>
                      <th className="text-left p-2 font-medium text-gray-700">PF</th>
                      <th className="text-left p-2 font-medium text-gray-700">PA</th>
                      <th className="text-left p-2 font-medium text-gray-700">Rank</th>
                      <th className="text-left p-2 font-medium text-gray-700">Playoff</th>
                      <th className="text-left p-2 font-medium text-gray-700">Dues</th>
                      <th className="text-left p-2 font-medium text-gray-700">Payout</th>
                      <th className="text-left p-2 font-medium text-gray-700">Chumpion</th>
                      <th className="text-left p-2 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamSeasons.sort((a, b) => b.year - a.year || (a.regular_season_rank || 99) - (b.regular_season_rank || 99)).map((season) => (
                      <tr key={season.id} className="border-b hover:bg-gray-50">
                        {editingRow === season.id ? (
                          <>
                            <td className="p-2">
                              <input
                                type="number"
                                value={editedData.year}
                                onChange={(e) => setEditedData({...editedData, year: parseInt(e.target.value)})}
                                className="w-16 px-1 py-1 border rounded text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={editedData.name_id}
                                onChange={(e) => setEditedData({...editedData, name_id: e.target.value})}
                                className="w-24 px-1 py-1 border rounded text-xs"
                              >
                                {managers.map(manager => (
                                  <option key={manager.name_id} value={manager.name_id}>
                                    {manager.full_name.split(' ')[0]}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={editedData.team_name}
                                onChange={(e) => setEditedData({...editedData, team_name: e.target.value})}
                                className="w-20 px-1 py-1 border rounded text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <div className="flex space-x-1">
                                <input
                                  type="number"
                                  value={editedData.wins}
                                  onChange={(e) => setEditedData({...editedData, wins: parseInt(e.target.value)})}
                                  className="w-8 px-1 py-1 border rounded text-xs"
                                />
                                <span className="text-xs self-center">-</span>
                                <input
                                  type="number"
                                  value={editedData.losses}
                                  onChange={(e) => setEditedData({...editedData, losses: parseInt(e.target.value)})}
                                  className="w-8 px-1 py-1 border rounded text-xs"
                                />
                              </div>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editedData.points_for}
                                onChange={(e) => setEditedData({...editedData, points_for: parseFloat(e.target.value)})}
                                className="w-16 px-1 py-1 border rounded text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editedData.points_against}
                                onChange={(e) => setEditedData({...editedData, points_against: parseFloat(e.target.value)})}
                                className="w-16 px-1 py-1 border rounded text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={editedData.regular_season_rank || ''}
                                onChange={(e) => setEditedData({...editedData, regular_season_rank: e.target.value ? parseInt(e.target.value) : null})}
                                className="w-12 px-1 py-1 border rounded text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={editedData.playoff_finish || ''}
                                onChange={(e) => setEditedData({...editedData, playoff_finish: e.target.value ? parseInt(e.target.value) : null})}
                                className="w-12 px-1 py-1 border rounded text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editedData.dues}
                                onChange={(e) => setEditedData({...editedData, dues: parseFloat(e.target.value)})}
                                className="w-16 px-1 py-1 border rounded text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editedData.payout}
                                onChange={(e) => setEditedData({...editedData, payout: parseFloat(e.target.value)})}
                                className="w-16 px-1 py-1 border rounded text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editedData.dues_chumpion || ''}
                                onChange={(e) => setEditedData({...editedData, dues_chumpion: e.target.value ? parseFloat(e.target.value) : 0})}
                                className="w-16 px-1 py-1 border rounded text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <div className="flex space-x-1">
                                <button
                                  onClick={saveEdit}
                                  className="text-green-600 hover:text-green-800"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="text-gray-600 hover:text-gray-800"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2">{season.year}</td>
                            <td className="p-2">{managers.find(m => m.name_id === season.name_id)?.full_name.split(' ')[0] || season.name_id}</td>
                            <td className="p-2 max-w-20 truncate">{season.team_name}</td>
                            <td className="p-2">{season.wins}-{season.losses}</td>
                            <td className="p-2">{season.points_for}</td>
                            <td className="p-2">{season.points_against}</td>
                            <td className="p-2">{season.regular_season_rank || '-'}</td>
                            <td className="p-2">{season.playoff_finish || '-'}</td>
                            <td className="p-2">${season.dues}</td>
                            <td className="p-2">${season.payout}</td>
                            <td className="p-2">${season.dues_chumpion || 0}</td>
                            <td className="p-2">
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => startEdit(season)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteRow(season.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rules Editor Section */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-purple-500" />
                <span>Edit League Rules</span>
              </h3>
              
              <div className="space-y-4">
                <textarea
                  value={rulesContent}
                  onChange={(e) => setRulesContent(e.target.value)}
                  className="w-full h-64 sm:h-96 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs sm:text-sm"
                  placeholder="Enter league rules in Markdown format..."
                />
                <div className="flex justify-end">
                  <button
                    onClick={saveRules}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base"
                  >
                    Save Rules
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8">
            <div className="flex items-center space-x-3 mb-6 sm:mb-8">
              <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">League Rules</h2>
            </div>
            <div className="prose prose-sm sm:prose-lg max-w-none">
              {renderMarkdown(rulesContent)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FantasyFootballApp;