import React, { useState, useEffect, useMemo } from 'react';
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
  BookOpen,
  Users,
  Zap,
  Edit3,
  Save,
  X,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import SleeperAdmin from './SleeperAdmin';
import PlayoffBracket from './PlayoffBracket';

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

  // NEW: Manager editing state variables
  const [editingManager, setEditingManager] = useState(null);
  const [editedManagerData, setEditedManagerData] = useState({});

  const [selectedSeasonYear, setSelectedSeasonYear] = useState(null);
  const [seasonMatchups, setSeasonMatchups] = useState([]);
  const [playoffBracket, setPlayoffBracket] = useState([]);
  const [selectedKeeperYear, setSelectedKeeperYear] = useState(null);
  const [keepers, setKeepers] = useState([]);
  const [selectedKeeperRosterId, setSelectedKeeperRosterId] = useState(null);
  const seasonsWithoutMatchups = [2016, 2017, 2018, 2019];
  const [seasonDataPage, setSeasonDataPage] = useState(0);

  // Determine if a season's regular season is complete (all teams have 14 games)
  const isRegularSeasonComplete = year => {
    const seasons = teamSeasons.filter(s => s.year === year);
    return (
      seasons.length > 0 &&
      seasons.every(s => (s.wins + s.losses + (s.ties || 0)) === 14)
    );
  };

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
    if (selectedKeeperYear) {
      fetchKeepers(selectedKeeperYear);
    }
  }, [selectedKeeperYear]);

  useEffect(() => {
    setSeasonDataPage(0);
  }, [teamSeasons]);

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

  const fetchKeepers = async (year) => {
    try {
      const [currentRes, savedKeepRes, prevKeepRes] = await Promise.all([
        fetch(`${API_BASE_URL}/seasons/${year}/keepers`),
        fetch(`${API_BASE_URL}/keepers/${year}`),
        fetch(`${API_BASE_URL}/keepers/${year - 1}`)
      ]);

      const currentData = currentRes.ok ? await currentRes.json() : { rosters: [] };
      const savedKeepers = savedKeepRes.ok ? await savedKeepRes.json() : { keepers: [] };
      const prevKeepers = prevKeepRes.ok ? await prevKeepRes.json() : { keepers: [] };

      const prevYearsMap = prevKeepers.keepers.reduce((acc, k) => {
        acc[k.player_id] = (k.years_kept || 0) + 1;
        return acc;
      }, {});

      const tradedFromMap = savedKeepers.keepers.reduce((acc, k) => {
        if (k.trade_from_roster_id != null && k.trade_from_roster_id !== k.roster_id) {
          if (!acc[k.trade_from_roster_id]) acc[k.trade_from_roster_id] = [];
          acc[k.trade_from_roster_id].push(k);
        }
        return acc;
      }, {});

      const processed = currentData.rosters.map(team => {
        const savedTeam = savedKeepers.keepers.filter(
          k => k.roster_id === team.roster_id && k.trade_from_roster_id !== k.roster_id
        );
        const players = team.players.map(p => {
          const savedPlayer = savedTeam.find(k => k.player_id === p.id);
          const keep = !!savedPlayer;
          return {
            id: p.id,
            name: p.name,
            previous_cost: p.draft_cost || '',
            years_kept: prevYearsMap[p.id] || 0,
            keep,
            trade: savedPlayer ? savedPlayer.trade_from_roster_id != null : false,
            trade_roster_id: savedPlayer ? savedPlayer.trade_from_roster_id : null,
            trade_amount: savedPlayer ? savedPlayer.trade_amount : '',
            locked: savedPlayer ? savedPlayer.trade_from_roster_id != null : false
          };
        });

        savedTeam.forEach(sp => {
          if (!players.some(p => p.id === sp.player_id)) {
            players.push({
              id: sp.player_id,
              name: sp.player_name,
              previous_cost: sp.previous_cost,
              years_kept: prevYearsMap[sp.player_id] || sp.years_kept || 0,
              keep: true,
              trade: sp.trade_from_roster_id != null,
              trade_roster_id: sp.trade_from_roster_id,
              trade_amount: sp.trade_amount || '',
              locked: sp.trade_from_roster_id != null
            });
          }
        });

        const tradedAway = tradedFromMap[team.roster_id] || [];
        tradedAway.forEach(sp => {
          if (!players.some(p => p.id === sp.player_id && p.trade_roster_id === sp.roster_id)) {
            players.push({
              id: sp.player_id,
              name: sp.player_name,
              previous_cost: sp.previous_cost,
              years_kept: prevYearsMap[sp.player_id] || sp.years_kept || 0,
              keep: false,
              trade: true,
              trade_roster_id: sp.roster_id,
              trade_amount: sp.trade_amount || '',
              locked: false
            });
          }
        });

        const sortedPlayers = players.sort((a, b) => (b.previous_cost || 0) - (a.previous_cost || 0));
        return { ...team, players: sortedPlayers };
      });

      setKeepers(processed);
      const prevManager = keepers.find(t => t.roster_id === selectedKeeperRosterId)?.manager_name;
      setSelectedKeeperRosterId(() => {
        if (prevManager) {
          const match = processed.find(t => t.manager_name === prevManager);
          if (match) return match.roster_id;
        }
        return processed.length > 0 ? processed[0].roster_id : null;
      });
    } catch (error) {
      console.error('Error fetching keepers:', error);
      setKeepers([]);
      setSelectedKeeperRosterId(null);
    }
  };

const toggleKeeperSelection = (rosterId, playerIndex) => {
  setKeepers(prev => {
    const updated = prev.map(team => ({ ...team, players: [...team.players] }));
    const team = updated.find(t => t.roster_id === rosterId);
    const player = team.players[playerIndex];
    if (player.trade && !player.locked) return prev;
    const newKeep = !player.keep;
    team.players[playerIndex] = {
      ...player,
      keep: newKeep
    };
    team.players.sort((a, b) => (b.previous_cost || 0) - (a.previous_cost || 0));
    saveAllKeepers(updated);
    return updated;
  });
};

  const toggleTradeSelection = (rosterId, playerIndex) => {
    setKeepers(prev => {
      const updated = prev.map(team => ({ ...team, players: [...team.players] }));
      const sourceTeam = updated.find(t => t.roster_id === rosterId);
      const player = sourceTeam.players[playerIndex];
      if (player.locked) return prev;

      if (!player.trade) {
        const defaultTarget = updated.find(t => t.roster_id !== rosterId)?.roster_id || null;
        player.trade = true;
        player.trade_roster_id = defaultTarget;
        player.trade_amount = '';
        player.keep = false;

        if (defaultTarget != null) {
          const targetTeam = updated.find(t => t.roster_id === defaultTarget);
          if (!targetTeam.players.some(p => p.id === player.id && p.locked && p.trade_roster_id === rosterId)) {
            targetTeam.players.push({
              id: player.id,
              name: player.name,
              previous_cost: player.previous_cost,
              years_kept: player.years_kept,
              keep: true,
              trade: true,
              trade_roster_id: rosterId,
              trade_amount: '',
              locked: true
            });
            targetTeam.players.sort((a, b) => (b.previous_cost || 0) - (a.previous_cost || 0));
          }
        }
      } else {
        if (player.trade_roster_id) {
          const targetTeam = updated.find(t => t.roster_id === player.trade_roster_id);
          if (targetTeam) {
            targetTeam.players = targetTeam.players.filter(
              p => !(p.id === player.id && p.locked && p.trade_roster_id === rosterId)
            );
          }
        }
        player.trade = false;
        player.trade_roster_id = null;
        player.trade_amount = '';
      }

      sourceTeam.players.sort((a, b) => (b.previous_cost || 0) - (a.previous_cost || 0));

      saveAllKeepers(updated);
      return updated;
    });
  };

  const handleTradeRosterChange = (rosterId, playerIndex, value) => {
    setKeepers(prev => {
      const updated = prev.map(team => ({ ...team, players: [...team.players] }));
      const sourceTeam = updated.find(t => t.roster_id === rosterId);
      const player = sourceTeam.players[playerIndex];
      if (player.locked) return prev;

      const oldTarget = player.trade_roster_id;
      const newTarget = Number(value);
      player.trade_roster_id = newTarget;

      // remove from old target
      if (oldTarget) {
        const oldTeam = updated.find(t => t.roster_id === oldTarget);
        if (oldTeam) {
          oldTeam.players = oldTeam.players.filter(
            p => !(p.id === player.id && p.locked && p.trade_roster_id === rosterId)
          );
        }
      }

      // add to new target
      if (newTarget) {
        const newTeam = updated.find(t => t.roster_id === newTarget);
        if (!newTeam.players.some(p => p.id === player.id && p.locked && p.trade_roster_id === rosterId)) {
          newTeam.players.push({
            id: player.id,
            name: player.name,
            previous_cost: player.previous_cost,
            years_kept: player.years_kept,
            keep: true,
            trade: true,
            trade_roster_id: rosterId,
            trade_amount: player.trade_amount || '',
            locked: true
          });
          newTeam.players.sort((a, b) => (b.previous_cost || 0) - (a.previous_cost || 0));
        }
      }

      sourceTeam.players.sort((a, b) => (b.previous_cost || 0) - (a.previous_cost || 0));

      saveAllKeepers(updated);
      return updated;
    });
  };

  const handleTradeAmountChange = (rosterId, playerIndex, value) => {
    setKeepers(prev => {
      const updated = prev.map(team => ({ ...team, players: [...team.players] }));
      const sourceTeam = updated.find(t => t.roster_id === rosterId);
      const player = sourceTeam.players[playerIndex];
      if (player.locked) return prev;

      player.trade_amount = value;
      if (player.trade_roster_id) {
        const targetTeam = updated.find(t => t.roster_id === player.trade_roster_id);
        const targetPlayer = targetTeam.players.find(
          p => p.id === player.id && p.locked && p.trade_roster_id === rosterId
        );
        if (targetPlayer) targetPlayer.trade_amount = value;
      }

      saveAllKeepers(updated);
      return updated;
    });
  };

  const getManagerName = (rosterId) => {
    const team = keepers.find(t => t.roster_id === rosterId);
    return team ? team.manager_name || team.team_name || `Roster ${rosterId}` : `Roster ${rosterId}`;
  };

  const saveAllKeepers = async (data) => {
    if (!selectedKeeperYear) return;
    const playersByRoster = {};
    data.forEach(team => {
      const teamPlayers = team.players
        .filter(p => (p.trade ? p.locked && p.keep : p.keep))
        .map(p => ({
          player_id: p.id,
          name: p.name,
          previous_cost: p.previous_cost,
          trade_from_roster_id: p.trade ? p.trade_roster_id : null,
          trade_amount: p.trade ? (p.trade_amount ? Number(p.trade_amount) : null) : null
        }));
      playersByRoster[team.roster_id] = teamPlayers;
    });

    try {
      for (const [rId, players] of Object.entries(playersByRoster)) {
        const response = await fetch(`${API_BASE_URL}/keepers/${selectedKeeperYear}/${rId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ players })
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to save');
        }
      }
      await fetchKeepers(selectedKeeperYear);
    } catch (error) {
      console.error('Error saving keepers:', error);
    }
  };

  const keeperSummary = useMemo(() => {
    return keepers
      .map(team => ({
        roster_id: team.roster_id,
        team_name: team.manager_name || team.team_name,
        players: team.players.filter(p => p.keep).map(p => p.name)
      }))
      .filter(team => team.players.length > 0);
  }, [keepers]);

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
    if (!window.confirm('Are you sure you want to delete this season record?')) return;
    
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

  // Simple but effective markdown rendering with proper indentation
  const renderMarkdown = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    let inList = false;

    const processLine = (line, index) => {
      // Handle lists (both regular and indented)
      const listMatch = line.match(/^(\s*)- (.+)$/);
      if (listMatch) {
        const spaces = listMatch[1].length;
        const content = listMatch[2];
        const indentLevel = Math.floor(spaces / 2);
        
        if (!inList) {
          inList = true;
        }
        
        currentList.push({ content: processInlineFormatting(content), indent: indentLevel });
        return;
      }

      // Flush any pending list when we hit non-list content
      if (inList && currentList.length > 0) {
        elements.push(createSimpleList(currentList, `list-${elements.length}`));
        currentList = [];
        inList = false;
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

    const createSimpleList = (items, key) => {
      return (
        <ul key={key} className="mb-4 space-y-1">
          {items.map((item, i) => {
            // Use style for precise indentation control
            const indentStyle = {
              marginLeft: `${Math.max(1, 1 + item.indent * 1.5)}rem`,
              listStyleType: 'disc',
              display: 'list-item'
            };
            
            return (
              <li 
                key={i} 
                className="text-gray-700 text-sm sm:text-base"
                style={indentStyle}
              >
                {item.content}
              </li>
            );
          })}
        </ul>
      );
    };

    lines.forEach(processLine);

    // Flush any remaining list
    if (inList && currentList.length > 0) {
      elements.push(createSimpleList(currentList, `list-${elements.length}`));
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
    return seasonMatchups.flatMap(week =>
      week.matchups.flatMap(m => [
        { manager: m.home.manager_name, points: m.home.points, week: week.week },
        { manager: m.away.manager_name, points: m.away.points, week: week.week }
      ])
    );
  }, [seasonMatchups]);

  const topWeeklyScores = [...weeklyScores].sort((a, b) => b.points - a.points).slice(0, 5);
  const bottomWeeklyScores = [...weeklyScores].sort((a, b) => a.points - b.points).slice(0, 5);

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
  
  const winPctRankings = [
    ...activeRecords.sort((a, b) => b.winPct - a.winPct),
    ...inactiveRecords.sort((a, b) => b.winPct - a.winPct)
  ];

  const ppgRankings = [
    ...activeRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame),
    ...inactiveRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame)
  ];

  const availableYears = [...new Set(teamSeasons.map(s => s.year))].sort((a, b) => b - a);
  const selectedKeeperRoster = keepers.find(team => team.roster_id === selectedKeeperRosterId) || null;
  const champion = teamSeasons.find(s => s.year === selectedSeasonYear && s.playoff_finish === 1);
  const runnerUp = teamSeasons.find(s => s.year === selectedSeasonYear && s.playoff_finish === 2);
  const thirdPlace = teamSeasons.find(s => s.year === selectedSeasonYear && s.playoff_finish === 3);

  const seasonDataYears = availableYears;
  const currentSeasonDataYear = seasonDataYears[seasonDataPage] || null;
  const paginatedSeasonData = currentSeasonDataYear
    ? teamSeasons
        .filter(s => s.year === currentSeasonDataYear)
        .sort((a, b) => (a.regular_season_rank || 99) - (b.regular_season_rank || 99))
    : [];

  const handlePrevSeasonData = () => {
    setEditingRow(null);
    setSeasonDataPage(prev => Math.min(prev + 1, seasonDataYears.length - 1));
  };

  const handleNextSeasonData = () => {
    setEditingRow(null);
    setSeasonDataPage(prev => Math.max(prev - 1, 0));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">The League Dashboard</h1>
            </div>
            <nav className="flex flex-wrap justify-center sm:justify-end items-center space-x-3 sm:space-x-6">
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
                onClick={() => setActiveTab('seasons')}
                className={`px-3 py-2 sm:px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                  activeTab === 'seasons'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Seasons
              </button>
              <button
                onClick={() => setActiveTab('keepers')}
                className={`px-3 py-2 sm:px-4 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                  activeTab === 'keepers'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Keepers
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
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {activeTab === 'seasons' && (
          <div className="space-y-4 sm:space-y-6">
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
                            <td className="px-2 py-1">{season.wins}-{season.losses}</td>
                            <td className="px-2 py-1">{season.points_for}</td>
                            <td className="px-2 py-1">{season.points_against}</td>
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
                {seasonMatchups.map(week => (
                  <div key={week.week} className="mb-6 bg-gray-50 rounded-lg p-2 sm:p-4">
                    <h4 className="font-semibold mb-2">Week {week.week}</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs sm:text-sm table-fixed">
                        <tbody className="divide-y divide-gray-200">
                          {week.matchups.map((m, idx) => {
                            const homeWin = m.home.points > m.away.points;
                            const awayWin = m.away.points > m.home.points;
                            return (
                              <tr key={idx} className="text-left">
                                <td className={`px-2 py-1 w-1/5 ${homeWin ? 'bg-green-50 text-green-700 font-semibold rounded-l' : ''}`}>{m.home.manager_name}</td>
                                <td className={`px-2 py-1 w-1/5 text-right ${homeWin ? 'bg-green-50 text-green-700 font-semibold' : ''}`}>{m.home.points}</td>
                                <td className="px-2 py-1 w-1/5 text-center">vs</td>
                                <td className={`px-2 py-1 w-1/5 ${awayWin ? 'bg-green-50 text-green-700 font-semibold' : ''}`}>{m.away.manager_name}</td>
                                <td className={`px-2 py-1 w-1/5 text-right ${awayWin ? 'bg-green-50 text-green-700 font-semibold rounded-r' : ''}`}>{m.away.points}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'keepers' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-2">Keepers for the {selectedKeeperYear + 1} season</h3>
              {keeperSummary.length === 0 ? (
                <p className="text-gray-500 text-sm">No keepers selected.</p>
              ) : (
                <ul className="text-sm list-disc list-inside space-y-1">
                  {keeperSummary.map(team => (
                    <li key={team.roster_id}>
                      <strong>{team.team_name}:</strong> {team.players.join(', ')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-0">Keepers {selectedKeeperYear}</h2>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedKeeperYear || ''}
                    onChange={e => setSelectedKeeperYear(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  {keepers.length > 0 && (
                    <select
                      value={selectedKeeperRosterId || ''}
                      onChange={e => setSelectedKeeperRosterId(Number(e.target.value))}
                      className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                    >
                      {keepers.map(team => (
                        <option key={team.roster_id} value={team.roster_id}>
                          {team.manager_name || team.team_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {keepers.length === 0 ? (
                <p className="text-gray-500">No roster data available for this season.</p>
              ) : (
                selectedKeeperRoster && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-2">{selectedKeeperRoster.team_name}</h3>
                    {selectedKeeperRoster.manager_name && (
                      <p className="text-sm text-gray-600 mb-2">{selectedKeeperRoster.manager_name}</p>
                    )}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="py-1 px-2">Player</th>
                            <th className="py-1 px-2">Previous Cost</th>
                            <th className="py-1 px-2"># of Years Kept</th>
                            <th className="py-1 px-2">Trade?</th>
                            <th className="py-1 px-2">Keep?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedKeeperRoster.players.map((player, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="py-1 px-2">{player.name}</td>
                              <td className="py-1 px-2">{player.previous_cost ? `$${player.previous_cost}` : ''}</td>
                              <td className="py-1 px-2">{player.years_kept}</td>
                              <td className="py-1 px-2">
                                {player.locked ? (
                                  player.trade && (
                                    <span className="text-xs text-gray-600">
                                      {player.keep
                                        ? `From ${getManagerName(player.trade_roster_id)}`
                                        : `To ${getManagerName(player.trade_roster_id)}`}
                                      {player.trade_amount ? ` ($${player.trade_amount})` : ''}
                                    </span>
                                  )
                                ) : (
                                  <>
                                    <input
                                      type="checkbox"
                                      checked={player.trade || false}
                                      onChange={() => toggleTradeSelection(selectedKeeperRoster.roster_id, idx)}
                                    />
                                    {player.trade && (
                                      <div className="mt-1 space-y-1">
                                        <select
                                          value={player.trade_roster_id || ''}
                                          onChange={e =>
                                            handleTradeRosterChange(
                                              selectedKeeperRoster.roster_id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                          className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                                        >
                                          <option value="">Select manager</option>
                                          {keepers
                                            .filter(t => t.roster_id !== selectedKeeperRoster.roster_id)
                                            .map(t => (
                                              <option key={t.roster_id} value={t.roster_id}>
                                                {t.manager_name || t.team_name}
                                              </option>
                                            ))}
                                        </select>
                                        <input
                                          type="number"
                                          value={player.trade_amount || ''}
                                          onChange={e =>
                                            handleTradeAmountChange(
                                              selectedKeeperRoster.roster_id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                          placeholder="$"
                                          className="border border-gray-300 rounded px-1 py-0.5 text-xs w-20"
                                        />
                                      </div>
                                    )}
                                  </>
                                )}
                              </td>
                              <td className="py-1 px-2">
                                <input
                                  type="checkbox"
                                  checked={player.keep}
                                  onChange={() => toggleKeeperSelection(selectedKeeperRoster.roster_id, idx)}
                                  disabled={player.trade && !player.locked}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
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
                    <p className="text-red-100 font-semibold text-sm sm:text-base mb-3">
                      {currentChumpion
                        ? (getCurrentYearChumpionDues() > 0
                            ? `Paid $${getCurrentYearChumpionDues()} Extra to ${currentChampion ? allRecords[currentChampion.name_id]?.name : 'Champion'}`
                            : 'Pays extra to Champion')
                        : ''}
                    </p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500 rounded-full flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 ml-2">
                    💩
                  </div>
                </div>
              </div>
            </div>

            {/* Medal and Chumpion Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Medal Count Rankings */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <span>Medal Count Rankings</span>
                </h3>

                <div className="space-y-2 sm:space-y-3">
                  {medalRankings.map((manager, index) => (
                    <div
                      key={manager.name}
                      className="p-3 sm:p-4 rounded-lg border-2 bg-gradient-to-r from-white to-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1 mb-3 sm:mb-0">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold ${
                              index === 0
                                ? 'bg-yellow-500 text-white shadow-lg'
                                : index === 1
                                ? 'bg-gray-400 text-white shadow-md'
                                : index === 2
                                ? 'bg-amber-600 text-white shadow-md'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            #{index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-base sm:text-lg truncate text-gray-900">
                              {manager.name}
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-600">
                              {manager.totalWins}-{manager.totalLosses} ({(manager.winPct * 100).toFixed(1)}%) • {manager.gamesPlayed} games
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end space-x-4 sm:space-x-6 flex-shrink-0 w-full sm:w-auto">
                          <div className="flex items-center space-x-4">
                            <div className="text-center">
                              <div className="text-yellow-500 font-bold text-lg sm:text-xl">{manager.championships}</div>
                              <div className="text-xs text-gray-500">🥇</div>
                            </div>
                            <div className="text-center">
                              <div className="text-gray-500 font-bold text-lg sm:text-xl">{manager.secondPlace}</div>
                              <div className="text-xs text-gray-500">🥈</div>
                            </div>
                            <div className="text-center">
                              <div className="text-amber-600 font-bold text-lg sm:text-xl">{manager.thirdPlace}</div>
                              <div className="text-xs text-gray-500">🥉</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm sm:text-base text-blue-600">
                              {manager.pointsPerGame.toFixed(1)} PPG
                            </p>
                            <p className="text-xs sm:text-sm text-gray-600">
                              {manager.totalMedals} total medals
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chumpion Rankings */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center space-x-2">
                  <Target className="w-5 h-5 text-red-500" />
                  <span>Chumpion Count Rankings</span>
                </h3>

                <div className="space-y-2 sm:space-y-3">
                  {chumpionRankings.map((manager, index) => (
                    <div key={manager.name} className="w-full p-3 sm:p-4 rounded-lg border-2 bg-white border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <span className="font-bold text-base sm:text-lg flex-shrink-0">#{index + 1}</span>
                          <span className="font-semibold text-sm sm:text-base truncate text-gray-900">
                            {manager.name}
                          </span>
                        </div>
                        <span className={`text-lg sm:text-xl font-bold flex-shrink-0 ${
                          manager.chumpionships > 0 ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {manager.chumpionships}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-gray-600">
                          {manager.seasons} seasons
                        </span>
                        <span className="text-gray-600">
                          {manager.chumpionYears.length > 0 ? manager.chumpionYears.join(', ') : 'None'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Win Percentage and Points Per Game Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Win Percentage Rankings */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-5 flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  <span>Win Percentage Rankings</span>
                </h3>

                <div className="space-y-1 sm:space-y-2">
                  {winPctRankings.map((manager, index) => (
                    <div key={manager.name} className={`p-2 sm:p-3 rounded-lg border ${
                      manager.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-75'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <span className="font-bold text-base sm:text-lg flex-shrink-0">#{index + 1}</span>
                          <span className={`font-semibold text-sm sm:text-base truncate ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                            {manager.name}
                          </span>
                        </div>
                        <span className={`text-lg sm:text-xl font-bold flex-shrink-0 ${manager.active ? 'text-blue-600' : 'text-gray-500'}`}>
                          {(manager.winPct * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                        <span className={manager.active ? 'text-gray-600' : 'text-gray-400'}>
                          {manager.totalWins}-{manager.totalLosses}
                        </span>
                        <span className={manager.active ? 'text-gray-600' : 'text-gray-400'}>
                          {manager.gamesPlayed} games played
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Points Per Game Rankings */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-5 flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <span>Points Per Game Rankings</span>
                </h3>

                <div className="space-y-1 sm:space-y-2">
                  {ppgRankings.map((manager, index) => (
                    <div key={manager.name} className={`p-2 sm:p-3 rounded-lg border ${
                      manager.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-75'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <span className="font-bold text-base sm:text-lg flex-shrink-0">#{index + 1}</span>
                          <span className={`font-semibold text-sm sm:text-base truncate ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                            {manager.name}
                          </span>
                        </div>
                        <span className={`text-lg sm:text-xl font-bold flex-shrink-0 ${manager.active ? 'text-green-600' : 'text-gray-500'}`}>
                          {manager.pointsPerGame.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className={manager.active ? 'text-gray-600' : 'text-gray-400'}>
                          {manager.totalPointsFor.toLocaleString()} total
                        </span>
                        <span className={manager.active ? 'text-gray-600' : 'text-gray-400'}>
                          {manager.gamesPlayed} games played
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Individual Manager Lookup */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center space-x-2">
                <Zap className="w-5 h-5 text-purple-500" />
                <span>Individual Manager Lookup</span>
              </h3>
              
              <div className="mb-4 sm:mb-6">
                <div className="relative">
                  <select
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-3 pr-10 text-gray-700 leading-tight focus:outline-none focus:border-blue-500 text-sm sm:text-base"
                  >
                    <option value="">Select a manager to view detailed stats</option>
                    {Object.entries(allRecords).map(([nameId, manager]) => (
                      <option key={nameId} value={nameId}>
                        {manager.name} {!manager.active ? '(Inactive)' : ''}
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
            {/* Add the Sleeper Admin component */}
            <SleeperAdmin 
              API_BASE_URL={API_BASE_URL} 
              onDataUpdate={fetchData}  // This will refresh your data after sync
            />
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

            {/* Manager Data Table - Display Only */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-2 sm:space-y-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span>Manager Data</span>
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2 font-medium text-gray-700">Name ID</th>
                      <th className="text-left p-2 font-medium text-gray-700">Full Name</th>
                      <th className="text-left p-2 font-medium text-gray-700">Sleeper Username</th>
                      <th className="text-left p-2 font-medium text-gray-700">Sleeper User ID</th>
                      <th className="text-left p-2 font-medium text-gray-700">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managers.sort((a, b) => {
                      if (a.active !== b.active) return b.active - a.active; // Active first
                      return a.full_name.localeCompare(b.full_name); // Then alphabetical
                    }).map((manager) => (
                      <tr key={manager.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <span className="font-mono text-xs">{manager.name_id}</span>
                        </td>
                        <td className="p-2">
                          <span className={`font-medium ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                            {manager.full_name}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className="text-gray-600">{manager.sleeper_username || '-'}</span>
                        </td>
                        <td className="p-2">
                          <span className="text-gray-600">{manager.sleeper_user_id || '-'}</span>
                        </td>
                        <td className="p-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            manager.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {manager.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Season Data Table - Limited Editing */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-2 sm:space-y-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <Edit3 className="w-5 h-5 text-green-500" />
                  <span>Season Data</span>
                </h3>
                {seasonDataYears.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handlePrevSeasonData}
                      disabled={seasonDataPage >= seasonDataYears.length - 1}
                      className={`p-1 rounded ${seasonDataPage >= seasonDataYears.length - 1 ? 'text-gray-300' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-medium">{currentSeasonDataYear}</span>
                    <button
                      onClick={handleNextSeasonData}
                      disabled={seasonDataPage === 0}
                      className={`p-1 rounded ${seasonDataPage === 0 ? 'text-gray-300' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
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
                    {paginatedSeasonData.map((season) => (
                      <tr key={season.id} className="border-b hover:bg-gray-50">
                        {editingRow === season.id ? (
                          <>
                            <td className="p-2">{season.year}</td>
                            <td className="p-2">{managers.find(m => m.name_id === season.name_id)?.full_name.split(' ')[0] || season.name_id}</td>
                            <td className="p-2">{season.team_name}</td>
                            <td className="p-2">{season.wins}-{season.losses}</td>
                            <td className="p-2">{season.points_for}</td>
                            <td className="p-2">{season.points_against}</td>
                            <td className="p-2">{season.regular_season_rank || '-'}</td>
                            <td className="p-2">{season.playoff_finish || '-'}</td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editedData.dues}
                                onChange={(e) => setEditedData({...editedData, dues: parseFloat(e.target.value)})}
                                className="w-16 px-1 py-1 border rounded text-xs bg-yellow-50"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editedData.payout}
                                onChange={(e) => setEditedData({...editedData, payout: parseFloat(e.target.value)})}
                                className="w-16 px-1 py-1 border rounded text-xs bg-yellow-50"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editedData.dues_chumpion || ''}
                                onChange={(e) => setEditedData({...editedData, dues_chumpion: e.target.value ? parseFloat(e.target.value) : 0})}
                                className="w-16 px-1 py-1 border rounded text-xs bg-yellow-50"
                              />
                            </td>
                            <td className="p-2">
                              <div className="flex space-x-1">
                                <button
                                  onClick={saveEdit}
                                  className="bg-green-500 hover:bg-green-600 text-white p-1 rounded transition-colors"
                                  title="Save"
                                >
                                  <Save className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="bg-gray-500 hover:bg-gray-600 text-white p-1 rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2">{season.year}</td>
                            <td className="p-2">{managers.find(m => m.name_id === season.name_id)?.full_name.split(' ')[0] || season.name_id}</td>
                            <td className="p-2">{season.team_name}</td>
                            <td className="p-2">{season.wins}-{season.losses}</td>
                            <td className="p-2">{season.points_for}</td>
                            <td className="p-2">{season.points_against}</td>
                            <td className="p-2">{season.regular_season_rank || '-'}</td>
                            <td className="p-2">{season.playoff_finish || '-'}</td>
                            <td className="p-2 bg-yellow-50">${season.dues}</td>
                            <td className="p-2 bg-yellow-50">${season.payout}</td>
                            <td className="p-2 bg-yellow-50">${season.dues_chumpion || 0}</td>
                            <td className="p-2">
                              <button
                                onClick={() => startEdit(season)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Edit financial data"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
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