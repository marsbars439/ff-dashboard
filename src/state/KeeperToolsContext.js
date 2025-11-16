import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useManagerAuth } from './ManagerAuthContext';

const DEFAULT_API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const INITIAL_KEEPER_LOCK_STATE = { locked: false, lockedAt: null, updatedAt: null };
const INITIAL_TRADE = { from: '', to: '', amount: '', note: '' };

const KeeperToolsContext = createContext(null);

const normalizeId = (value) => (value === undefined || value === null ? '' : String(value).trim());

const findRosterIdForManager = (teams, managerId, managerName) => {
  if (!Array.isArray(teams) || teams.length === 0) {
    return null;
  }

  const normalizedManagerId = normalizeId(managerId);
  if (normalizedManagerId) {
    const rosterById = teams.find(team => normalizeId(team?.manager_id) === normalizedManagerId);
    if (rosterById) {
      return rosterById.roster_id;
    }
  }

  const normalizedManagerName = (managerName || '').trim().toLowerCase();
  if (normalizedManagerName) {
    const rosterByName = teams.find(team => {
      const teamManagerName = (team?.manager_name || '').trim().toLowerCase();
      return Boolean(teamManagerName) && teamManagerName === normalizedManagerName;
    });
    if (rosterByName) {
      return rosterByName.roster_id;
    }
  }

  return null;
};

const calculateCostToKeep = (previousCost, yearsKept) => {
  if (previousCost === undefined || previousCost === null || previousCost === '' || yearsKept > 1) {
    return '';
  }
  return Number(previousCost) + 5 * (yearsKept + 1);
};
export const KeeperToolsProvider = ({ children, apiBaseUrl = DEFAULT_API_BASE_URL }) => {
  const { managerAuth } = useManagerAuth();
  const [selectedKeeperYear, setSelectedKeeperYear] = useState(null);
  const [keepers, setKeepers] = useState([]);
  const [selectedKeeperRosterId, setSelectedKeeperRosterId] = useState(null);
  const [manualTrades, setManualTrades] = useState([]);
  const [newTrade, setNewTrade] = useState(INITIAL_TRADE);
  const [keeperSummaryView, setKeeperSummaryView] = useState('keepers');
  const [keeperLockState, setKeeperLockState] = useState(INITIAL_KEEPER_LOCK_STATE);

  const keepersRef = useRef(keepers);
  const selectedKeeperRosterIdRef = useRef(selectedKeeperRosterId);

  useEffect(() => {
    keepersRef.current = keepers;
  }, [keepers]);

  useEffect(() => {
    selectedKeeperRosterIdRef.current = selectedKeeperRosterId;
  }, [selectedKeeperRosterId]);

  const keeperEditingLocked = Boolean(keeperLockState.locked);
  const fetchManualTrades = useCallback(async (year) => {
    if (!Number.isInteger(Number(year))) {
      setManualTrades([]);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/trades/${year}`);
      if (response.ok) {
        const data = await response.json();
        setManualTrades((data.trades || []).map(t => ({ ...t, note: t.description || '' })));
      } else {
        setManualTrades([]);
      }
    } catch (error) {
      console.error('Error fetching trades:', error);
      setManualTrades([]);
    }
  }, [apiBaseUrl]);

  const fetchKeepers = useCallback(async (year) => {
    if (!Number.isInteger(Number(year))) {
      setKeepers([]);
      setKeeperLockState(INITIAL_KEEPER_LOCK_STATE);
      setSelectedKeeperRosterId(null);
      return;
    }

    try {
      const [currentRes, savedKeepRes, prevKeepRes] = await Promise.all([
        fetch(`${apiBaseUrl}/seasons/${year}/keepers`),
        fetch(`${apiBaseUrl}/keepers/${year}`),
        fetch(`${apiBaseUrl}/keepers/${year - 1}`)
      ]);

      const currentData = currentRes.ok ? await currentRes.json() : { rosters: [] };
      const savedKeepers = savedKeepRes.ok ? await savedKeepRes.json() : { keepers: [] };
      const prevSeasonKeepers = prevKeepRes.ok ? await prevKeepRes.json() : { keepers: [] };

      setKeeperLockState({
        locked: Boolean(savedKeepers.locked),
        lockedAt: savedKeepers.lockedAt || savedKeepers.locked_at || null,
        updatedAt: savedKeepers.updatedAt || savedKeepers.updated_at || null
      });

      const prevYearsMap = prevSeasonKeepers.keepers.reduce((acc, k) => {
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

      const processed = (currentData.rosters || []).map(team => {
        const savedTeam = savedKeepers.keepers.filter(
          k => k.roster_id === team.roster_id && k.trade_from_roster_id !== k.roster_id
        );

        const players = team.players.map(p => {
          const savedPlayer = savedTeam.find(k => k.player_id === p.id);
          const years_kept = prevYearsMap[p.id] || 0;
          const previous_cost = p.draft_cost || '';
          const basePlayer = {
            id: p.id,
            name: p.name,
            previous_cost,
            years_kept,
            cost_to_keep: calculateCostToKeep(previous_cost, years_kept),
            keep: !!savedPlayer,
            trade: savedPlayer ? savedPlayer.trade_from_roster_id != null : false,
            trade_roster_id: savedPlayer ? savedPlayer.trade_from_roster_id : null,
            trade_amount: savedPlayer ? savedPlayer.trade_amount : '',
            trade_note: savedPlayer ? savedPlayer.trade_note : '',
            locked: savedPlayer ? savedPlayer.trade_from_roster_id != null : false
          };
          if (years_kept > 1) {
            basePlayer.keep = false;
            basePlayer.trade = false;
            basePlayer.trade_roster_id = null;
            basePlayer.trade_amount = '';
            basePlayer.locked = false;
          }
          return basePlayer;
        });

        savedTeam.forEach(sp => {
          if (!players.some(p => p.id === sp.player_id)) {
            const years_kept = prevYearsMap[sp.player_id] || sp.years_kept || 0;
            const previous_cost = sp.previous_cost;
            const newPlayer = {
              id: sp.player_id,
              name: sp.player_name,
              previous_cost,
              years_kept,
              cost_to_keep: calculateCostToKeep(previous_cost, years_kept),
              keep: true,
              trade: sp.trade_from_roster_id != null,
              trade_roster_id: sp.trade_from_roster_id,
              trade_amount: sp.trade_amount || '',
              trade_note: sp.trade_note || '',
              locked: sp.trade_from_roster_id != null
            };
            if (years_kept > 1) {
              newPlayer.keep = false;
              newPlayer.trade = false;
              newPlayer.trade_roster_id = null;
              newPlayer.trade_amount = '';
              newPlayer.locked = false;
            }
            players.push(newPlayer);
          }
        });

        const tradedAway = tradedFromMap[team.roster_id] || [];
        tradedAway.forEach(sp => {
          const existingIdx = players.findIndex(p => p.id === sp.player_id);
          const years_kept = prevYearsMap[sp.player_id] || sp.years_kept || 0;
          const previous_cost = sp.previous_cost;
          if (existingIdx !== -1) {
            players[existingIdx] = {
              ...players[existingIdx],
              keep: false,
              trade: years_kept > 1 ? false : true,
              trade_roster_id: years_kept > 1 ? null : sp.roster_id,
              trade_amount: years_kept > 1 ? '' : sp.trade_amount || '',
              trade_note: years_kept > 1 ? '' : sp.trade_note || '',
              locked: false
            };
            if (players[existingIdx].cost_to_keep === undefined) {
              players[existingIdx].cost_to_keep = calculateCostToKeep(previous_cost, years_kept);
            }
          } else {
            const newPlayer = {
              id: sp.player_id,
              name: sp.player_name,
              previous_cost,
              years_kept,
              cost_to_keep: calculateCostToKeep(previous_cost, years_kept),
              keep: false,
              trade: years_kept > 1 ? false : true,
              trade_roster_id: years_kept > 1 ? null : sp.roster_id,
              trade_amount: years_kept > 1 ? '' : sp.trade_amount || '',
              locked: false
            };
            players.push(newPlayer);
          }
        });

        const sortedPlayers = players.sort((a, b) => (b.previous_cost || 0) - (a.previous_cost || 0));
        return { ...team, players: sortedPlayers };
      });

      const prevKeepers = keepersRef.current || [];
      const prevRosterId = selectedKeeperRosterIdRef.current;
      const prevManagerName = prevKeepers.find(t => t.roster_id === prevRosterId)?.manager_name;

      setKeepers(processed);
      setSelectedKeeperRosterId(() => {
        if (processed.find(team => team.roster_id === prevRosterId)) {
          return prevRosterId;
        }

        if (prevManagerName) {
          const normalizedPrevManager = prevManagerName.trim().toLowerCase();
          const match = processed.find(team => {
            const teamManager = (team.manager_name || '').trim().toLowerCase();
            return Boolean(teamManager) && teamManager === normalizedPrevManager;
          });
          if (match) {
            return match.roster_id;
          }
        }

        const authRosterId = managerAuth.status === 'authenticated'
          ? findRosterIdForManager(processed, managerAuth.managerId, managerAuth.managerName)
          : null;
        if (authRosterId) {
          return authRosterId;
        }

        return processed.length > 0 ? processed[0].roster_id : null;
      });
    } catch (error) {
      console.error('Error fetching keepers:', error);
      setKeepers([]);
      setSelectedKeeperRosterId(null);
      setKeeperLockState(INITIAL_KEEPER_LOCK_STATE);
    }
  }, [apiBaseUrl, managerAuth.managerId, managerAuth.managerName, managerAuth.status]);
  useEffect(() => {
    if (selectedKeeperYear) {
      fetchKeepers(selectedKeeperYear);
      fetchManualTrades(selectedKeeperYear);
    } else {
      setKeepers([]);
      setManualTrades([]);
      setSelectedKeeperRosterId(null);
      setKeeperLockState(INITIAL_KEEPER_LOCK_STATE);
    }
  }, [fetchKeepers, fetchManualTrades, selectedKeeperYear]);

  useEffect(() => {
    if (
      managerAuth.status !== 'authenticated' ||
      !Array.isArray(keepers) ||
      keepers.length === 0
    ) {
      return;
    }

    const authRosterId = findRosterIdForManager(
      keepers,
      managerAuth.managerId,
      managerAuth.managerName
    );

    const doesRosterBelongToAuth = roster => {
      if (!roster) {
        return false;
      }

      if (roster.manager_id && managerAuth.managerId) {
        if (normalizeId(roster.manager_id) === normalizeId(managerAuth.managerId)) {
          return true;
        }
      }

      const normalizedAuthName = (managerAuth.managerName || '').trim().toLowerCase();
      const normalizedRosterName = (roster.manager_name || '').trim().toLowerCase();
      return normalizedAuthName.length > 0 && normalizedAuthName === normalizedRosterName;
    };

    setSelectedKeeperRosterId(prev => {
      const prevRoster = keepers.find(team => team.roster_id === prev);
      if (authRosterId) {
        if (doesRosterBelongToAuth(prevRoster)) {
          return prevRoster.roster_id;
        }
        return authRosterId;
      }
      if (prevRoster) {
        return prevRoster.roster_id;
      }
      return keepers[0]?.roster_id ?? null;
    });
  }, [keepers, managerAuth.managerId, managerAuth.managerName, managerAuth.status]);

  const canEditRoster = useCallback((rosterId) => {
    if (keeperEditingLocked) {
      return false;
    }

    if (managerAuth.status !== 'authenticated' || !rosterId) {
      return false;
    }

    const roster = keepers.find(team => team.roster_id === rosterId);
    if (!roster) {
      return false;
    }

    if (normalizeId(roster.manager_id) && normalizeId(managerAuth.managerId)) {
      if (normalizeId(roster.manager_id) === normalizeId(managerAuth.managerId)) {
        return true;
      }
    }

    const normalizedAuthName = (managerAuth.managerName || '').trim().toLowerCase();
    const normalizedRosterName = (roster.manager_name || '').trim().toLowerCase();
    return normalizedAuthName.length > 0 && normalizedAuthName === normalizedRosterName;
  }, [keeperEditingLocked, keepers, managerAuth.managerId, managerAuth.managerName, managerAuth.status]);
  const saveAllKeepers = useCallback(async (data) => {
    if (!selectedKeeperYear || keeperEditingLocked) {
      return;
    }

    const playersByRoster = {};
    data.forEach(team => {
      const teamPlayers = team.players
        .filter(p => (p.trade ? p.locked && p.keep : p.keep))
        .map(p => ({
          player_id: p.id,
          name: p.name,
          previous_cost: p.previous_cost,
          trade_from_roster_id: p.trade ? p.trade_roster_id : null,
          trade_amount: p.trade ? (p.trade_amount ? Number(p.trade_amount) : null) : null,
          trade_note: p.trade ? (p.trade_note || null) : null
        }));
      playersByRoster[team.roster_id] = teamPlayers;
    });

    try {
      for (const [rId, players] of Object.entries(playersByRoster)) {
        const response = await fetch(`${apiBaseUrl}/keepers/${selectedKeeperYear}/${rId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ players })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to save');
        }
      }
    } catch (error) {
      console.error('Error saving keepers:', error);
    }
  }, [apiBaseUrl, keeperEditingLocked, selectedKeeperYear]);

  const updateKeepers = (updater) => {
    setKeepers(prev => {
      const updated = prev.map(team => ({ ...team, players: [...team.players] }));
      const next = updater(updated);
      if (next) {
        saveAllKeepers(next);
        return next;
      }
      return prev;
    });
  };

  const toggleKeeperSelection = (rosterId, playerIndex) => {
    if (!canEditRoster(rosterId)) {
      return;
    }

    updateKeepers(updated => {
      const team = updated.find(t => t.roster_id === rosterId);
      const player = team.players[playerIndex];
      if (player.trade || player.years_kept > 1) {
        return null;
      }

      team.players[playerIndex] = {
        ...player,
        keep: !player.keep
      };
      team.players.sort((a, b) => (b.previous_cost || 0) - (a.previous_cost || 0));
      return updated;
    });
  };

  const toggleTradeSelection = (rosterId, playerIndex) => {
    if (!canEditRoster(rosterId)) {
      return;
    }

    updateKeepers(updated => {
      const sourceTeam = updated.find(t => t.roster_id === rosterId);
      const player = sourceTeam.players[playerIndex];
      if (player.locked || player.years_kept > 1) {
        return null;
      }

      if (!player.trade) {
        const defaultTarget = updated.find(t => t.roster_id !== rosterId)?.roster_id || null;
        player.trade = true;
        player.trade_roster_id = defaultTarget;
        player.trade_amount = '';
        player.trade_note = '';
        player.prev_keep = player.keep;
        player.keep = false;

        if (defaultTarget != null) {
          const targetTeam = updated.find(t => t.roster_id === defaultTarget);
          if (!targetTeam.players.some(p => p.id === player.id && p.locked && p.trade_roster_id === rosterId)) {
            targetTeam.players.push({
              id: player.id,
              name: player.name,
              previous_cost: player.previous_cost,
              years_kept: player.years_kept,
              cost_to_keep: player.cost_to_keep,
              keep: true,
              trade: true,
              trade_roster_id: rosterId,
              trade_amount: '',
              trade_note: '',
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
        player.trade_note = '';
        player.keep = player.prev_keep;
        delete player.prev_keep;
      }

      sourceTeam.players.sort((a, b) => (b.previous_cost || 0) - (a.previous_cost || 0));
      return updated;
    });
  };
  const handleTradeRosterChange = (rosterId, playerIndex, value) => {
    if (!canEditRoster(rosterId)) {
      return;
    }

    updateKeepers(updated => {
      const sourceTeam = updated.find(t => t.roster_id === rosterId);
      const player = sourceTeam.players[playerIndex];
      if (player.locked || player.years_kept > 1) {
        return null;
      }

      const oldTarget = player.trade_roster_id;
      const newTarget = Number(value);
      player.trade_roster_id = newTarget;

      if (oldTarget) {
        const oldTeam = updated.find(t => t.roster_id === oldTarget);
        if (oldTeam) {
          oldTeam.players = oldTeam.players.filter(
            p => !(p.id === player.id && p.locked && p.trade_roster_id === rosterId)
          );
        }
      }

      if (newTarget) {
        const newTeam = updated.find(t => t.roster_id === newTarget);
        if (!newTeam.players.some(p => p.id === player.id && p.locked && p.trade_roster_id === rosterId)) {
          newTeam.players.push({
            id: player.id,
            name: player.name,
            previous_cost: player.previous_cost,
            years_kept: player.years_kept,
            cost_to_keep: player.cost_to_keep,
            keep: true,
            trade: true,
            trade_roster_id: rosterId,
            trade_amount: player.trade_amount || '',
            trade_note: player.trade_note || '',
            locked: true
          });
          newTeam.players.sort((a, b) => (b.previous_cost || 0) - (a.previous_cost || 0));
        }
      }

      sourceTeam.players.sort((a, b) => (b.previous_cost || 0) - (a.previous_cost || 0));
      return updated;
    });
  };

  const handleTradeAmountChange = (rosterId, playerIndex, value) => {
    if (!canEditRoster(rosterId)) {
      return;
    }

    updateKeepers(updated => {
      const sourceTeam = updated.find(t => t.roster_id === rosterId);
      const player = sourceTeam.players[playerIndex];
      if (player.locked || player.years_kept > 1) {
        return null;
      }

      player.trade_amount = value;
      if (player.trade_roster_id) {
        const targetTeam = updated.find(t => t.roster_id === player.trade_roster_id);
        const targetPlayer = targetTeam.players.find(
          p => p.id === player.id && p.locked && p.trade_roster_id === rosterId
        );
        if (targetPlayer) {
          targetPlayer.trade_amount = value;
        }
      }

      return updated;
    });
  };

  const handleTradeNoteChange = (rosterId, playerIndex, value) => {
    if (!canEditRoster(rosterId)) {
      return;
    }

    updateKeepers(updated => {
      const sourceTeam = updated.find(t => t.roster_id === rosterId);
      const player = sourceTeam.players[playerIndex];
      if (player.locked || player.years_kept > 1) {
        return null;
      }

      player.trade_note = value;
      if (player.trade_roster_id) {
        const targetTeam = updated.find(t => t.roster_id === player.trade_roster_id);
        const targetPlayer = targetTeam.players.find(
          p => p.id === player.id && p.locked && p.trade_roster_id === rosterId
        );
        if (targetPlayer) {
          targetPlayer.trade_note = value;
        }
      }

      return updated;
    });
  };
  const getManagerName = useCallback((rosterId) => {
    const team = keepers.find(t => t.roster_id === rosterId);
    return team ? team.manager_name || team.team_name || `Roster ${rosterId}` : `Roster ${rosterId}`;
  }, [keepers]);

  const addManualTrade = async () => {
    if (!selectedKeeperYear || !newTrade.from || !newTrade.to || !newTrade.amount) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedKeeperYear,
          from_roster_id: Number(newTrade.from),
          to_roster_id: Number(newTrade.to),
          amount: Number(newTrade.amount),
          description: newTrade.note
        })
      });
      if (response.ok) {
        setNewTrade(INITIAL_TRADE);
        fetchManualTrades(selectedKeeperYear);
      }
    } catch (error) {
      console.error('Error saving trade:', error);
    }
  };

  const deleteManualTrade = async (id) => {
    try {
      await fetch(`${apiBaseUrl}/trades/${id}`, { method: 'DELETE' });
      fetchManualTrades(selectedKeeperYear);
    } catch (error) {
      console.error('Error deleting trade:', error);
    }
  };
  const keeperSummary = useMemo(() => {
    return keepers
      .map(team => ({
        roster_id: team.roster_id,
        team_name: team.manager_name || team.team_name,
        players: team.players
          .filter(p => p.keep)
          .map(p => (p.cost_to_keep ? `${p.name} ($${p.cost_to_keep})` : p.name))
      }))
      .filter(team => team.players.length > 0)
      .sort((a, b) => a.team_name.localeCompare(b.team_name));
  }, [keepers]);

  const tradeSummary = useMemo(() => {
    const manual = manualTrades.map(t => ({
      year: t.year,
      from: getManagerName(t.from_roster_id),
      to: getManagerName(t.to_roster_id),
      amount: t.amount,
      note: t.note || '',
      manual: true
    }));
    const keeper = [];
    keepers.forEach(team => {
      team.players.forEach(p => {
        if (p.trade && p.trade_roster_id && p.locked && p.trade_amount) {
          keeper.push({
            year: selectedKeeperYear,
            from: getManagerName(p.trade_roster_id),
            to: team.manager_name || team.team_name,
            player: p.name,
            amount: p.trade_amount,
            note: p.trade_note || '',
            manual: false
          });
        }
      });
    });
    return [...manual, ...keeper];
  }, [getManagerName, keepers, manualTrades, selectedKeeperYear]);

  const draftBudgetSummary = useMemo(() => {
    const budgets = {};
    keepers.forEach(team => {
      const name = team.manager_name || team.team_name;
      budgets[name] = 200;
    });
    tradeSummary.forEach(t => {
      const amount = Number(t.amount);
      if (t.manual) {
        budgets[t.from] = (budgets[t.from] ?? 200) - amount;
        budgets[t.to] = (budgets[t.to] ?? 200) + amount;
      } else {
        budgets[t.from] = (budgets[t.from] ?? 200) + amount;
        budgets[t.to] = (budgets[t.to] ?? 200) - amount;
      }
    });
    return Object.entries(budgets)
      .map(([manager, amount]) => ({ manager, amount }))
      .sort((a, b) => a.manager.localeCompare(b.manager));
  }, [keepers, tradeSummary]);

  const selectedKeeperRoster = useMemo(() => {
    return keepers.find(team => team.roster_id === selectedKeeperRosterId) || null;
  }, [keepers, selectedKeeperRosterId]);

  const canEditSelectedKeeperRoster = useMemo(() => {
    return selectedKeeperRoster ? canEditRoster(selectedKeeperRoster.roster_id) : false;
  }, [canEditRoster, selectedKeeperRoster]);
  const handleKeeperLockChange = useCallback((year) => {
    const numericYear = Number(year);
    if (!Number.isInteger(numericYear)) {
      return;
    }

    if (Number(selectedKeeperYear) === numericYear) {
      fetchKeepers(numericYear);
    }
  }, [fetchKeepers, selectedKeeperYear]);

  const value = {
    apiBaseUrl,
    selectedKeeperYear,
    setSelectedKeeperYear,
    keepers,
    keeperLockState,
    keeperEditingLocked,
    selectedKeeperRosterId,
    setSelectedKeeperRosterId,
    selectedKeeperRoster,
    canEditSelectedKeeperRoster,
    manualTrades,
    newTrade,
    setNewTrade,
    addManualTrade,
    deleteManualTrade,
    keeperSummaryView,
    setKeeperSummaryView,
    keeperSummary,
    tradeSummary,
    draftBudgetSummary,
    toggleKeeperSelection,
    toggleTradeSelection,
    handleTradeRosterChange,
    handleTradeAmountChange,
    handleTradeNoteChange,
    getManagerName,
    handleKeeperLockChange,
    canEditRoster
  };

  return (
    <KeeperToolsContext.Provider value={value}>
      {children}
    </KeeperToolsContext.Provider>
  );
};

export const useKeeperTools = () => {
  const context = useContext(KeeperToolsContext);
  if (!context) {
    throw new Error('useKeeperTools must be used within a KeeperToolsProvider');
  }
  return context;
};
