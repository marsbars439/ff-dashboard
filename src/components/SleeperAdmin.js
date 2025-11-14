import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Lock,
  Unlock,
  X,
  Upload,
  Edit3,
  Save
} from 'lucide-react';
import { formatDateTimeForDisplay } from '../utils/date';

const INITIAL_ALIAS_ADD_STATE = {
  managerNameId: null,
  season: '',
  sleeper_user_id: '',
  loading: false,
  error: null
};

const SleeperAdmin = ({
  API_BASE_URL,
  onDataUpdate,
  adminToken,
  onAdminSessionInvalid,
  onKeeperLockChange,
  onVotingLockChange
}) => {
  const [leagueSettings, setLeagueSettings] = useState({});
  const [syncStatus, setSyncStatus] = useState([]);
  const [message, setMessage] = useState(null);
  const [managerMappings, setManagerMappings] = useState([]);
  const [managers, setManagers] = useState([]);
  const [editingMappingId, setEditingMappingId] = useState(null);
  const [editingMapping, setEditingMapping] = useState({});
  const [aliasAddState, setAliasAddState] = useState(INITIAL_ALIAS_ADD_STATE);
  const [keeperLockStates, setKeeperLockStates] = useState({});
  const [keeperLockUpdating, setKeeperLockUpdating] = useState({});
  const [keeperLockErrors, setKeeperLockErrors] = useState({});
  const [votingLockStates, setVotingLockStates] = useState({});
  const [votingLockUpdating, setVotingLockUpdating] = useState({});
  const [votingLockErrors, setVotingLockErrors] = useState({});
  const [syncErrors, setSyncErrors] = useState({});
  const [emailEdit, setEmailEdit] = useState({
    managerId: null,
    emails: [],
    newEmail: '',
    loading: false,
    error: null
  });
  const [passcodeEdit, setPasscodeEdit] = useState({
    managerId: null,
    passcode: '',
    confirm: '',
    loading: false,
    error: null
  });
  const [managerRowEditingId, setManagerRowEditingId] = useState(null);
  const [managerRowSaving, setManagerRowSaving] = useState(false);
  const [managerModalManager, setManagerModalManager] = useState(null);
  const [seasonModalYear, setSeasonModalYear] = useState(null);
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [seasonModalLoading, setSeasonModalLoading] = useState(false);
  const [seasonModalError, setSeasonModalError] = useState(null);
  const [seasonModalSeasons, setSeasonModalSeasons] = useState([]);
  const [seasonModalDataSource, setSeasonModalDataSource] = useState('sleeper');
  const [seasonModalLeagueId, setSeasonModalLeagueId] = useState('');
  const [seasonModalEditingId, setSeasonModalEditingId] = useState(null);
  const [seasonModalEditedRow, setSeasonModalEditedRow] = useState(null);
  const [seasonModalSaving, setSeasonModalSaving] = useState(false);
  const [seasonModalUploadLoading, setSeasonModalUploadLoading] = useState(false);

  const adminAuthToken = typeof adminToken === 'string' ? adminToken.trim() : '';

  const autoSyncYearsRef = useRef(new Set());

  const isValidEmail = (value) => {
    if (typeof value !== 'string') {
      return false;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const normalizeManagerEmails = (rawEmails, fallbackEmail) => {
    const candidates = [];

    if (Array.isArray(rawEmails)) {
      candidates.push(...rawEmails);
    }

    if (typeof fallbackEmail === 'string') {
      candidates.push(fallbackEmail);
    }

    const seen = new Set();
    const sanitized = [];

    candidates.forEach(email => {
      if (typeof email !== 'string') {
        return;
      }

      const trimmed = email.trim();
      if (!trimmed) {
        return;
      }

      const lower = trimmed.toLowerCase();
      if (seen.has(lower)) {
        return;
      }

      seen.add(lower);
      sanitized.push(trimmed);
    });

    return sanitized;
  };

  const areEmailListsEqual = (listA, listB) => {
    const normalizeListPreservingOrder = (list) => {
      if (!Array.isArray(list)) {
        return [];
      }

      return list
        .map(value => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
        .filter(Boolean);
    };

    const normalizedA = normalizeListPreservingOrder(listA);
    const normalizedB = normalizeListPreservingOrder(listB);

    if (normalizedA.length !== normalizedB.length) {
      return false;
    }

    return normalizedA.every((value, index) => value === normalizedB[index]);
  };

  const formatManagerRecord = (manager) => {
    if (!manager) {
      return manager;
    }

    const emails = normalizeManagerEmails(manager.emails, manager.email);

    return {
      ...manager,
      emails,
      email: emails[0] || ''
    };
  };

  const getManagerName = (manager) => {
    if (!manager) {
      return '';
    }

    const rawName = typeof manager.full_name === 'string' ? manager.full_name.trim() : '';
    if (rawName) {
      return rawName;
    }

    const fallbackId = typeof manager.name_id === 'string' ? manager.name_id.trim() : '';
    if (fallbackId) {
      return fallbackId;
    }

    return '';
  };

  const sortedManagers = useMemo(() => {
    return [...managers].sort((a, b) => {
      if (a?.active !== b?.active) {
        return Number(Boolean(b?.active)) - Number(Boolean(a?.active));
      }

      const nameA = getManagerName(a);
      const nameB = getManagerName(b);
      return nameA.localeCompare(nameB);
    });
  }, [managers]);

  const aliasesByManager = useMemo(() => {
    const grouped = managerMappings.reduce((acc, mapping) => {
      if (!mapping || mapping.name_id == null) {
        return acc;
      }

      const key = mapping.name_id;
      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(mapping);
      return acc;
    }, {});

    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        const seasonA = Number(a?.season) || 0;
        const seasonB = Number(b?.season) || 0;
        if (seasonA !== seasonB) {
          return seasonB - seasonA;
        }

        const idA = String(a?.sleeper_user_id || '').toLowerCase();
        const idB = String(b?.sleeper_user_id || '').toLowerCase();
        return idA.localeCompare(idB);
      });
    });

    return grouped;
  }, [managerMappings]);

  // Generate years from 2015 to current year
  const years = Array.from(
    { length: new Date().getFullYear() - 2014 },
    (_, i) => new Date().getFullYear() - i
  );

  const formatSyncStatusLabel = (syncStatus) => {
    if (!syncStatus || typeof syncStatus !== 'string') {
      return 'Never synced';
    }

    const normalized = syncStatus.toLowerCase();

    if (normalized === 'completed') {
      return 'Sync Complete';
    }

    return normalized
      .split('_')
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  };

  const modalManager = managerModalManager
    ? managers.find(manager => manager.id === managerModalManager.id) || managerModalManager
    : null;
  const isModalOpen = Boolean(modalManager);
  const modalManagerAliases = modalManager
    ? Array.isArray(aliasesByManager[modalManager.name_id])
      ? aliasesByManager[modalManager.name_id]
      : []
    : [];
  const isSeasonModalVisible = Boolean(seasonModalOpen && seasonModalYear != null);
  const seasonModalStatus = isSeasonModalVisible ? getStatusForYear(seasonModalYear) : null;
  const seasonModalManual = Boolean(seasonModalStatus?.manual_complete);
  const isManualSeasonMode = seasonModalDataSource === 'manual';
  const isEmailEditActive = Boolean(modalManager && emailEdit.managerId === modalManager.id);
  const displayedEmails = isEmailEditActive && Array.isArray(emailEdit.emails)
    ? emailEdit.emails
    : modalManager && Array.isArray(modalManager.emails)
      ? modalManager.emails
      : [];
  const pendingEmailValue = isEmailEditActive ? emailEdit.newEmail : '';
  const isPasscodeEditActive = Boolean(modalManager && passcodeEdit.managerId === modalManager.name_id);
  const isAliasAddActive = Boolean(modalManager && aliasAddState.managerNameId === modalManager.name_id);
  const isAliasSaving = Boolean(isAliasAddActive && aliasAddState.loading);
  const isSaveDisabled =
    Boolean(managerRowSaving) ||
    (isEmailEditActive && emailEdit.loading) ||
    (isPasscodeEditActive && passcodeEdit.loading);
  const isModalBusy =
    Boolean(managerRowSaving) ||
    (isEmailEditActive && emailEdit.loading) ||
    (isPasscodeEditActive && passcodeEdit.loading);

  useEffect(() => {
    fetchLeagueSettings();
    fetchSyncStatus();
    fetchManagers();
    fetchMappings();
  }, []);

  const fetchLeagueSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/league-settings`);
      const data = await response.json();
      const settings = {};
      const locks = {};
      const votingLocks = {};
      (Array.isArray(data.settings) ? data.settings : []).forEach(s => {
        if (s?.year == null) {
          return;
        }
        settings[s.year] = s.league_id;
        locks[s.year] = {
          locked: Boolean(s?.keeper_locked),
          lockedAt: s?.keeper_locked_at || null,
          updatedAt: s?.keeper_lock_updated_at || null
        };
        votingLocks[s.year] = {
          locked: Boolean(s?.voting_locked),
          lockedAt: s?.voting_locked_at || null,
          updatedAt: s?.voting_lock_updated_at || null
        };
      });
      setLeagueSettings(settings);
      setKeeperLockStates(locks);
      setKeeperLockErrors({});
      setKeeperLockUpdating({});
      setVotingLockStates(votingLocks);
      setVotingLockErrors({});
      setVotingLockUpdating({});
    } catch (error) {
      console.error('Error fetching league settings:', error);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sleeper/sync-status`);
      const data = await response.json();
      setSyncStatus(data.status || []);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/managers`);
      const data = await response.json();
      const managerList = Array.isArray(data.managers) ? data.managers : [];
      setManagers(managerList.map(formatManagerRecord));
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const fetchMappings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/manager-sleeper-ids`);
      const data = await response.json();
      setManagerMappings(data.mappings || []);
    } catch (error) {
      console.error('Error fetching mappings:', error);
    }
  };

  const updateLeagueId = async (year, leagueId) => {
    const numericYear = Number(year);
    try {
      const response = await fetch(`${API_BASE_URL}/league-settings/${year}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ league_id: leagueId })
      });

      if (response.ok) {
        setLeagueSettings(prev => ({ ...prev, [year]: leagueId }));
        setMessage({ type: 'success', text: `League ID updated for ${year}` });
        setTimeout(() => setMessage(null), 3000);
        setSyncErrors(prev => {
          if (!prev[numericYear]) {
            return prev;
          }
          const updated = { ...prev };
          delete updated[numericYear];
          return updated;
        });
        if (!Number.isNaN(numericYear)) {
          autoSyncYearsRef.current.delete(numericYear);
        }
        fetchSyncStatus();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update league ID' });
    }
  };

  const toggleKeeperLock = async (year, nextLocked) => {
    const numericYear = Number(year);

    if (!Number.isInteger(numericYear)) {
      setKeeperLockErrors(prev => ({
        ...prev,
        [year]: 'A valid season year is required to adjust keeper access.'
      }));
      return;
    }

    if (!adminAuthToken) {
      setKeeperLockErrors(prev => ({
        ...prev,
        [numericYear]: 'Admin authentication is required to adjust keeper access.'
      }));
      return;
    }

    setKeeperLockUpdating(prev => ({ ...prev, [numericYear]: true }));
    setKeeperLockErrors(prev => ({ ...prev, [numericYear]: null }));

    try {
      const response = await fetch(`${API_BASE_URL}/keepers/lock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminAuthToken
        },
        body: JSON.stringify({ seasonYear: numericYear, locked: Boolean(nextLocked) })
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        const errorMessage = data?.error || 'Admin session has expired. Please sign in again.';
        setKeeperLockErrors(prev => ({ ...prev, [numericYear]: errorMessage }));
        if (onAdminSessionInvalid) {
          onAdminSessionInvalid();
        }
        return;
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update keeper access');
      }

      const updatedLock = {
        locked: Boolean(data?.locked),
        lockedAt: data?.lockedAt || data?.locked_at || null,
        updatedAt: data?.updatedAt || data?.updated_at || null
      };

      setKeeperLockStates(prev => ({ ...prev, [numericYear]: updatedLock }));
      setKeeperLockErrors(prev => ({ ...prev, [numericYear]: null }));
      setMessage({
        type: 'success',
        text: `${updatedLock.locked ? 'Locked' : 'Unlocked'} keepers for ${numericYear}`
      });
      setTimeout(() => setMessage(null), 3000);

      if (typeof onKeeperLockChange === 'function') {
        onKeeperLockChange(numericYear, updatedLock.locked);
      }
    } catch (error) {
      console.error('Error updating keeper access:', error);
      setKeeperLockErrors(prev => ({
        ...prev,
        [numericYear]: error.message || 'Failed to update keeper access'
      }));
    } finally {
      setKeeperLockUpdating(prev => ({ ...prev, [numericYear]: false }));
    }
  };

  const toggleVotingLock = async (year, nextLocked) => {
    const numericYear = Number(year);

    if (!Number.isInteger(numericYear)) {
      setVotingLockErrors(prev => ({
        ...prev,
        [numericYear]: 'A valid season year is required to adjust voting access.'
      }));
      return;
    }

    if (!adminAuthToken) {
      setVotingLockErrors(prev => ({
        ...prev,
        [numericYear]: 'Admin authentication is required to adjust voting access.'
      }));
      return;
    }

    setVotingLockUpdating(prev => ({ ...prev, [numericYear]: true }));
    setVotingLockErrors(prev => ({ ...prev, [numericYear]: null }));

    try {
      const response = await fetch(`${API_BASE_URL}/rule-changes/voting-lock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminAuthToken
        },
        body: JSON.stringify({ seasonYear: numericYear, locked: Boolean(nextLocked) })
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        const errorMessage = data?.error || 'Admin session has expired. Please sign in again.';
        setVotingLockErrors(prev => ({ ...prev, [numericYear]: errorMessage }));
        if (onAdminSessionInvalid) {
          onAdminSessionInvalid();
        }
        return;
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update voting access');
      }

      const updatedLock = {
        locked: Boolean(data?.locked),
        lockedAt: data?.lockedAt || data?.locked_at || null,
        updatedAt: data?.updatedAt || data?.updated_at || null
      };

      setVotingLockStates(prev => ({ ...prev, [numericYear]: updatedLock }));
      setVotingLockErrors(prev => ({ ...prev, [numericYear]: null }));
      setMessage({
        type: 'success',
        text: `${updatedLock.locked ? 'Locked' : 'Unlocked'} voting for ${numericYear}`
      });
      setTimeout(() => setMessage(null), 3000);

      if (typeof onVotingLockChange === 'function') {
        onVotingLockChange(numericYear, updatedLock.locked);
      }
    } catch (error) {
      console.error('Error updating voting access:', error);
      setVotingLockErrors(prev => ({
        ...prev,
        [numericYear]: error.message || 'Failed to update voting access'
      }));
    } finally {
      setVotingLockUpdating(prev => ({ ...prev, [numericYear]: false }));
    }
  };

  const fetchSeasonModalSeasons = async (year) => {
    if (!Number.isInteger(year)) {
      setSeasonModalSeasons([]);
      setSeasonModalError('A valid season year is required to load season data.');
      return;
    }

    setSeasonModalLoading(true);
    setSeasonModalError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/team-seasons/${year}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load season data');
      }

      const seasons = Array.isArray(data?.teamSeasons)
        ? data.teamSeasons
            .filter(season => season && typeof season === 'object')
            .sort((a, b) => {
              const rankA = Number(a?.regular_season_rank) || 99;
              const rankB = Number(b?.regular_season_rank) || 99;
              if (rankA !== rankB) {
                return rankA - rankB;
              }
              const nameA = (a?.manager_name || '').toLowerCase();
              const nameB = (b?.manager_name || '').toLowerCase();
              return nameA.localeCompare(nameB);
            })
        : [];

      setSeasonModalSeasons(seasons);
    } catch (error) {
      console.error('Error loading season data:', error);
      setSeasonModalSeasons([]);
      setSeasonModalError(error.message || 'Failed to load season data');
    } finally {
      setSeasonModalLoading(false);
    }
  };

  const openSeasonModal = (year) => {
    const numericYear = Number(year);

    if (!Number.isInteger(numericYear)) {
      return;
    }

    const status = getStatusForYear(numericYear);
    setSeasonModalYear(numericYear);
    setSeasonModalOpen(true);
    setSeasonModalEditingId(null);
    setSeasonModalEditedRow(null);
    setSeasonModalError(null);
    setSeasonModalDataSource(status?.manual_complete ? 'manual' : 'sleeper');
    setSeasonModalLeagueId(leagueSettings?.[numericYear] || '');
    fetchSeasonModalSeasons(numericYear);
  };

  const closeSeasonModal = () => {
    setSeasonModalOpen(false);
    setSeasonModalYear(null);
    setSeasonModalSeasons([]);
    setSeasonModalEditingId(null);
    setSeasonModalEditedRow(null);
    setSeasonModalLoading(false);
    setSeasonModalError(null);
    setSeasonModalUploadLoading(false);
  };

  const handleSeasonDataSourceChange = async (nextSource) => {
    if (!isSeasonModalVisible) {
      return;
    }

    if (nextSource !== 'manual' && nextSource !== 'sleeper') {
      return;
    }

    const previousSource = seasonModalDataSource;
    const numericYear = seasonModalYear;

    setSeasonModalDataSource(nextSource);

    try {
      const response = await fetch(`${API_BASE_URL}/league-settings/${numericYear}/manual-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complete: nextSource === 'manual' })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update data source');
      }

      const successMessage =
        nextSource === 'manual'
          ? `Season ${numericYear} set to manual management.`
          : `Season ${numericYear} set to Sleeper sync.`;
      setMessage({ type: 'success', text: successMessage });
      setTimeout(() => setMessage(null), 3000);

      fetchSyncStatus();
      if (onDataUpdate) {
        onDataUpdate({ silent: true });
      }
    } catch (error) {
      console.error('Error updating data source:', error);
      setSeasonModalDataSource(previousSource);
      setMessage({ type: 'error', text: error.message || 'Failed to update data source' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSeasonLeagueIdSave = async () => {
    if (!isSeasonModalVisible) {
      return;
    }

    const trimmedLeagueId = (seasonModalLeagueId || '').trim();
    await updateLeagueId(seasonModalYear, trimmedLeagueId);
    if (onDataUpdate) {
      onDataUpdate({ silent: true });
    }
  };

  const startSeasonRowEdit = (season) => {
    if (!season || !season.id) {
      return;
    }

    setSeasonModalEditingId(season.id);
    setSeasonModalEditedRow({
      ...season,
      name_id: season.name_id || '',
      team_name: season.team_name || '',
      wins: season.wins ?? 0,
      losses: season.losses ?? 0,
      points_for: season.points_for ?? 0,
      points_against: season.points_against ?? 0,
      regular_season_rank:
        season.regular_season_rank === null || season.regular_season_rank === undefined
          ? ''
          : season.regular_season_rank,
      playoff_finish: season.playoff_finish || '',
      dues: season.dues ?? 0,
      payout: season.payout ?? 0,
      dues_chumpion: season.dues_chumpion ?? 0,
      high_game: season.high_game ?? null
    });
  };

  const cancelSeasonRowEdit = () => {
    setSeasonModalEditingId(null);
    setSeasonModalEditedRow(null);
  };

  const updateSeasonEditedField = (field, value) => {
    setSeasonModalEditedRow(prev => {
      if (!prev) {
        return prev;
      }

      const next = { ...prev };

      switch (field) {
        case 'name_id':
          next.name_id = value;
          break;
        case 'team_name':
          next.team_name = value;
          break;
        case 'wins':
        case 'losses':
          next[field] = Number.isNaN(Number(value)) ? 0 : Number(value);
          break;
        case 'points_for':
        case 'points_against':
        case 'dues':
        case 'payout':
        case 'dues_chumpion':
          next[field] = Number.isNaN(Number(value)) ? 0 : Number(value);
          break;
        case 'regular_season_rank':
          next.regular_season_rank = value === '' ? '' : Number(value);
          break;
        case 'playoff_finish':
          next.playoff_finish = value;
          break;
        default:
          next[field] = value;
          break;
      }

      return next;
    });
  };

  const saveSeasonRowEdit = async () => {
    if (!seasonModalEditedRow || !seasonModalEditingId) {
      return;
    }

    if (!seasonModalEditedRow.name_id) {
      setMessage({ type: 'error', text: 'Select a manager before saving season data.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const numericYear = seasonModalYear;
    const payload = {
      ...seasonModalEditedRow,
      year: numericYear,
      name_id: seasonModalEditedRow.name_id,
      team_name: seasonModalEditedRow.team_name || '',
      wins: Number(seasonModalEditedRow.wins) || 0,
      losses: Number(seasonModalEditedRow.losses) || 0,
      points_for: Number(seasonModalEditedRow.points_for) || 0,
      points_against: Number(seasonModalEditedRow.points_against) || 0,
      regular_season_rank:
        seasonModalEditedRow.regular_season_rank === '' || seasonModalEditedRow.regular_season_rank === null
          ? null
          : Number(seasonModalEditedRow.regular_season_rank),
      playoff_finish: seasonModalEditedRow.playoff_finish || null,
      dues: Number(seasonModalEditedRow.dues) || 0,
      payout: Number(seasonModalEditedRow.payout) || 0,
      dues_chumpion:
        seasonModalEditedRow.dues_chumpion === '' || seasonModalEditedRow.dues_chumpion === null
          ? 0
          : Number(seasonModalEditedRow.dues_chumpion),
      high_game: seasonModalEditedRow.high_game ?? null
    };

    setSeasonModalSaving(true);

    try {
      const response = await fetch(`${API_BASE_URL}/team-seasons/${seasonModalEditingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update season data');
      }

      const managerLabel = managerNameMap[payload.name_id] || payload.name_id;
      setSeasonModalSeasons(prev =>
        prev.map(season =>
          season.id === seasonModalEditingId
            ? {
                ...season,
                ...payload,
                manager_name: managerLabel
              }
            : season
        )
      );
      setSeasonModalEditingId(null);
      setSeasonModalEditedRow(null);
      setMessage({ type: 'success', text: `Updated season data for ${managerLabel} (${numericYear})` });
      setTimeout(() => setMessage(null), 3000);

      if (onDataUpdate) {
        onDataUpdate({ silent: true });
      }
    } catch (error) {
      console.error('Error saving season data:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update season data' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSeasonModalSaving(false);
    }
  };

  const handleSeasonFileUpload = async (event) => {
    if (!isSeasonModalVisible) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setSeasonModalUploadLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-excel`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to upload file');
      }

      setMessage({ type: 'success', text: 'Season data imported successfully.' });
      setTimeout(() => setMessage(null), 3000);

      fetchSeasonModalSeasons(seasonModalYear);
      if (onDataUpdate) {
        onDataUpdate({ silent: true });
      }
    } catch (error) {
      console.error('Error uploading season data:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to upload file' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSeasonModalUploadLoading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const syncSeason = async (year, options = {}) => {
    const { silent = false, preserveManualFields = true } = options;
    const leagueId = leagueSettings[year];
    if (!leagueId) {
      const errorText = `No league ID set for ${year}`;
      setMessage({ type: 'error', text: errorText });
      setSyncErrors(prev => ({ ...prev, [year]: errorText }));
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/sleeper/sync/${year}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          preserve_manual_fields: preserveManualFields
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (!silent) {
          setMessage({
            type: 'success',
            text: `Synced ${data.summary.successful_updates} teams for ${year}`
          });
        }
        setSyncErrors(prev => {
          const updated = { ...prev };
          delete updated[year];
          return updated;
        });
        fetchSyncStatus();
        if (onDataUpdate) onDataUpdate({ silent });
      } else {
        const errorText = data.error || 'Sync failed';
        setSyncErrors(prev => ({ ...prev, [year]: errorText }));
        if (!silent) {
          setMessage({ type: 'error', text: errorText });
        }
      }
    } catch (error) {
      const errorText = error.message || 'Sync failed';
      setSyncErrors(prev => ({ ...prev, [year]: errorText }));
      if (!silent) {
        setMessage({ type: 'error', text: errorText });
      }
    }
  };

  useEffect(() => {
    if (!Array.isArray(syncStatus) || syncStatus.length === 0) {
      return;
    }

    syncStatus.forEach(status => {
      const year = status?.year;
      if (!Number.isInteger(year)) {
        return;
      }

      const leagueId = leagueSettings?.[year];
      if (!leagueId) {
        return;
      }

      if (status?.manual_complete) {
        return;
      }

      if (typeof status?.sleeper_status === 'string' && status.sleeper_status.toLowerCase() === 'complete') {
        return;
      }

      if (autoSyncYearsRef.current.has(year)) {
        return;
      }

      autoSyncYearsRef.current.add(year);
      syncSeason(year, { silent: true });
    });
  }, [syncStatus, leagueSettings]);

  useEffect(() => {
    if (!managerModalManager) {
      return;
    }

    const latest = managers.find(manager => manager.id === managerModalManager.id);
    if (latest && latest !== managerModalManager) {
      setManagerModalManager(latest);
    }
  }, [managers, managerModalManager]);

  useEffect(() => {
    if (!isSeasonModalVisible) {
      return;
    }

    const status = getStatusForYear(seasonModalYear);
    const desiredSource = status?.manual_complete ? 'manual' : 'sleeper';
    if (desiredSource && desiredSource !== seasonModalDataSource) {
      setSeasonModalDataSource(desiredSource);
    }
  }, [isSeasonModalVisible, seasonModalYear, seasonModalDataSource, syncStatus]);

  useEffect(() => {
    if (!isSeasonModalVisible) {
      return;
    }

    const nextLeagueId = leagueSettings?.[seasonModalYear] || '';
    setSeasonModalLeagueId(nextLeagueId);
  }, [isSeasonModalVisible, seasonModalYear, leagueSettings]);

  const startAliasAdd = (manager) => {
    if (!manager || manager.name_id == null) {
      return;
    }

    if (managerRowEditingId !== manager.id) {
      return;
    }

    setEditingMappingId(null);
    setEditingMapping({});
    setAliasAddState({
      ...INITIAL_ALIAS_ADD_STATE,
      managerNameId: manager.name_id
    });
  };

  const cancelAliasAdd = () => {
    setAliasAddState(INITIAL_ALIAS_ADD_STATE);
  };

  const saveAliasAdd = async () => {
    if (!aliasAddState.managerNameId) {
      return;
    }

    const editingManager = managers.find(manager => manager.id === managerRowEditingId);
    if (!editingManager || editingManager.name_id !== aliasAddState.managerNameId) {
      return;
    }

    const trimmedSeason = String(aliasAddState.season ?? '').trim();
    const trimmedSleeperId = String(aliasAddState.sleeper_user_id ?? '').trim();

    if (!trimmedSeason) {
      setAliasAddState(prev => ({ ...prev, error: 'Enter a season year before saving.' }));
      return;
    }

    const numericSeason = Number(trimmedSeason);
    if (!Number.isInteger(numericSeason)) {
      setAliasAddState(prev => ({ ...prev, error: 'Enter a valid season year.' }));
      return;
    }

    if (!trimmedSleeperId) {
      setAliasAddState(prev => ({ ...prev, error: 'Enter a Sleeper user ID before saving.' }));
      return;
    }

    setAliasAddState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE_URL}/manager-sleeper-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_id: aliasAddState.managerNameId,
          season: numericSeason,
          sleeper_user_id: trimmedSleeperId
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add alias');
      }

      await fetchMappings();
      const managerLabel = managerNameMap[aliasAddState.managerNameId] || aliasAddState.managerNameId;
      setAliasAddState(INITIAL_ALIAS_ADD_STATE);
      setMessage({ type: 'success', text: `Alias added for ${managerLabel}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error adding mapping:', error);
      setAliasAddState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to add alias'
      }));
    }
  };

  const startEditMapping = (mapping) => {
    if (!mapping) {
      return;
    }

    const editingManager = managers.find(manager => manager.id === managerRowEditingId);
    if (!editingManager || editingManager.name_id !== mapping.name_id) {
      return;
    }

    cancelAliasAdd();
    setEditingMappingId(mapping.id);
    setEditingMapping({
      ...mapping,
      season: mapping?.season != null ? String(mapping.season) : '',
      sleeper_user_id: mapping?.sleeper_user_id ?? ''
    });
  };

  const saveEditMapping = async () => {
    try {
      const trimmedSeason = String(editingMapping?.season ?? '').trim();
      const trimmedSleeperId = String(editingMapping?.sleeper_user_id ?? '').trim();

      if (!trimmedSeason) {
        setMessage({ type: 'error', text: 'Season is required to update an alias.' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }

      const numericSeason = Number(trimmedSeason);
      if (!Number.isInteger(numericSeason)) {
        setMessage({ type: 'error', text: 'Enter a valid season year.' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }

      if (!trimmedSleeperId) {
        setMessage({ type: 'error', text: 'Sleeper user ID is required to update an alias.' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/manager-sleeper-ids/${editingMappingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingMapping,
          season: numericSeason,
          sleeper_user_id: trimmedSleeperId
        })
      });
      if (response.ok) {
        const managerLabel = managerNameMap[editingMapping?.name_id] || editingMapping?.name_id || 'Manager';
        setEditingMappingId(null);
        setEditingMapping({});
        await fetchMappings();
        setMessage({ type: 'success', text: `Alias updated for ${managerLabel}` });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error updating mapping:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update alias' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const deleteMapping = async (id) => {
    if (!window.confirm('Delete this mapping?')) return;
    try {
      const targetMapping = managerMappings.find(mapping => mapping.id === id);
      const editingManager = managers.find(manager => manager.id === managerRowEditingId);
      if (!targetMapping || !editingManager || editingManager.name_id !== targetMapping.name_id) {
        return;
      }
      const response = await fetch(`${API_BASE_URL}/manager-sleeper-ids/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchMappings();
        if (editingMappingId === id) {
          setEditingMappingId(null);
          setEditingMapping({});
        }
        const managerLabel = targetMapping?.name_id ? (managerNameMap[targetMapping.name_id] || targetMapping.name_id) : 'Manager';
        setMessage({ type: 'success', text: `Alias removed for ${managerLabel}` });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to delete alias' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const getSyncStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusForYear = (year) => {
    return syncStatus.find(s => s.year === year);
  };

  const managerNameMap = useMemo(() => {
    return managers.reduce((acc, manager) => {
      if (!manager || manager.name_id == null) {
        return acc;
      }

      const key = manager.name_id;
      acc[key] = getManagerName(manager);
      return acc;
    }, {});
  }, [managers]);

  const startEmailEdit = (manager) => {
    const emails = Array.isArray(manager?.emails) ? manager.emails : [];
    setEmailEdit({
      managerId: manager?.id ?? null,
      emails: emails.map(email => (typeof email === 'string' ? email : '')).filter(Boolean),
      newEmail: '',
      loading: false,
      error: null
    });
  };

  const cancelEmailEdit = () => {
    setEmailEdit({ managerId: null, emails: [], newEmail: '', loading: false, error: null });
  };

  const saveEmailEdit = async () => {
    if (!emailEdit.managerId) {
      return false;
    }

    const managerToUpdate = managers.find(m => m.id === emailEdit.managerId);
    if (!managerToUpdate) {
      setEmailEdit(prev => ({ ...prev, error: 'Manager not found' }));
      return false;
    }

    const pendingEmail = typeof emailEdit.newEmail === 'string' ? emailEdit.newEmail.trim() : '';
    if (pendingEmail && !isValidEmail(pendingEmail)) {
      setEmailEdit(prev => ({ ...prev, error: `Enter a valid email address (${pendingEmail})` }));
      return false;
    }

    const combinedEmails = Array.isArray(emailEdit.emails) ? [...emailEdit.emails] : [];
    if (pendingEmail) {
      combinedEmails.push(pendingEmail);
    }

    const dedupedEmails = [];
    const seen = new Set();

    combinedEmails.forEach(email => {
      if (typeof email !== 'string') {
        return;
      }

      const trimmed = email.trim();
      if (!trimmed) {
        return;
      }

      const lower = trimmed.toLowerCase();
      if (seen.has(lower)) {
        return;
      }

      seen.add(lower);
      dedupedEmails.push(trimmed);
    });

    const invalidEmail = dedupedEmails.find(email => !isValidEmail(email));
    if (invalidEmail) {
      setEmailEdit(prev => ({ ...prev, error: `Enter a valid email address (${invalidEmail})` }));
      return false;
    }

    setEmailEdit(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE_URL}/managers/${managerToUpdate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_id: managerToUpdate.name_id,
          full_name: managerToUpdate.full_name,
          sleeper_username: managerToUpdate.sleeper_username,
          sleeper_user_id: managerToUpdate.sleeper_user_id,
          active: managerToUpdate.active,
          emails: dedupedEmails
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update emails');
      }

      const data = await response.json();
      const updatedManager = data.manager;

      if (updatedManager) {
        const formatted = formatManagerRecord(updatedManager);
        setManagers(prev =>
          prev.map(m => (m.id === formatted.id ? { ...m, ...formatted } : m))
        );
      }

      cancelEmailEdit();
      setMessage({
        type: 'success',
        text: `Email addresses updated for ${getManagerName(managerToUpdate)}`
      });
      setTimeout(() => setMessage(null), 3000);
      return true;
    } catch (error) {
      setEmailEdit(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to update emails'
      }));
      return false;
    }
  };

  const addEmailToEdit = () => {
    setEmailEdit(prev => {
      if (prev.loading) {
        return prev;
      }

      const candidate = typeof prev.newEmail === 'string' ? prev.newEmail.trim() : '';
      if (!candidate) {
        return { ...prev, error: 'Enter an email address before adding' };
      }

      if (!isValidEmail(candidate)) {
        return { ...prev, error: `Enter a valid email address (${candidate})` };
      }

      const existingEmails = Array.isArray(prev.emails) ? prev.emails : [];
      const exists = existingEmails.some(
        email => typeof email === 'string' && email.toLowerCase() === candidate.toLowerCase()
      );
      if (exists) {
        return { ...prev, error: 'Email already added', newEmail: '' };
      }

      return {
        ...prev,
        emails: [...existingEmails, candidate],
        newEmail: '',
        error: null
      };
    });
  };

  const removeEmailFromEdit = (emailToRemove) => {
    setEmailEdit(prev => {
      if (prev.loading) {
        return prev;
      }

      const existingEmails = Array.isArray(prev.emails) ? prev.emails : [];

      return {
        ...prev,
        emails: existingEmails.filter(
          email => typeof email !== 'string' || email.toLowerCase() !== emailToRemove.toLowerCase()
        ),
        error: null
      };
    });
  };

  const handleEmailInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addEmailToEdit();
    }
  };

  const cancelPasscodeEdit = () => {
    setPasscodeEdit({
      managerId: null,
      passcode: '',
      confirm: '',
      loading: false,
      error: null
    });
  };

  const savePasscodeEdit = async () => {
    if (!passcodeEdit.managerId) {
      return false;
    }

    if (!passcodeEdit.passcode) {
      setPasscodeEdit(prev => ({ ...prev, error: 'Enter a passcode.' }));
      return false;
    }

    if (passcodeEdit.passcode !== passcodeEdit.confirm) {
      setPasscodeEdit(prev => ({ ...prev, error: 'Passcodes do not match.' }));
      return false;
    }

    const targetManagerId = passcodeEdit.managerId;
    setPasscodeEdit(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE_URL}/manager-auth/passcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: targetManagerId,
          passcode: passcodeEdit.passcode
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update passcode');
      }

      setPasscodeEdit({
        managerId: targetManagerId,
        passcode: '',
        confirm: '',
        loading: false,
        error: null
      });
      setMessage({
        type: 'success',
        text: `Passcode updated for ${managerNameMap[targetManagerId] || targetManagerId}`
      });
      setTimeout(() => setMessage(null), 3000);
      return true;
    } catch (error) {
      setPasscodeEdit(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to update passcode'
      }));
      return false;
    }
  };

  const cancelManagerRowEdit = () => {
    setManagerRowSaving(false);
    cancelEmailEdit();
    cancelPasscodeEdit();
    setAliasAddState(INITIAL_ALIAS_ADD_STATE);
    setEditingMappingId(null);
    setEditingMapping({});
    setManagerRowEditingId(null);
    setManagerModalManager(null);
  };

  const startManagerRowEdit = (manager) => {
    if (!manager) {
      return;
    }

    if (managerRowEditingId && managerRowEditingId !== manager.id) {
      cancelManagerRowEdit();
    }

    setManagerRowEditingId(manager.id);
    setManagerModalManager(manager);
    startEmailEdit(manager);
    setPasscodeEdit({
      managerId: manager.name_id,
      passcode: '',
      confirm: '',
      loading: false,
      error: null
    });
    setAliasAddState(INITIAL_ALIAS_ADD_STATE);
    setEditingMappingId(null);
    setEditingMapping({});
  };

  const saveManagerRowEdit = async () => {
    const editingManager = managers.find(manager => manager.id === managerRowEditingId);
    if (!editingManager) {
      return;
    }

    setManagerRowSaving(true);

    try {
      const originalEmails = Array.isArray(editingManager.emails) ? editingManager.emails : [];
      const editedEmails = Array.isArray(emailEdit.emails) ? emailEdit.emails : [];
      const pendingEmail = typeof emailEdit.newEmail === 'string' ? emailEdit.newEmail.trim() : '';
      const needsEmailSave = emailEdit.managerId === editingManager.id && (
        Boolean(pendingEmail) || !areEmailListsEqual(originalEmails, editedEmails)
      );

      let emailResult = true;
      if (needsEmailSave) {
        emailResult = await saveEmailEdit();
      }

      let passcodeResult = true;
      const hasPasscodeInput =
        passcodeEdit.managerId === editingManager.name_id &&
        (Boolean(passcodeEdit.passcode) || Boolean(passcodeEdit.confirm));

      if (emailResult && hasPasscodeInput) {
        passcodeResult = await savePasscodeEdit();
      } else if (
        !hasPasscodeInput &&
        passcodeEdit.managerId === editingManager.name_id &&
        passcodeEdit.error
      ) {
        setPasscodeEdit(prev => ({ ...prev, error: null }));
      }

      if (emailResult && passcodeResult) {
        cancelManagerRowEdit();
      }
    } finally {
      setManagerRowSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}
      {/* League ID History */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6">
          <h4 className="text-lg font-semibold mb-4">League ID History</h4>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    League ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teams
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {years.map(year => {
                  const status = getStatusForYear(year);
                  const keeperLockState = keeperLockStates[year] || { locked: false, lockedAt: null, updatedAt: null };
                  const isKeeperLocked = Boolean(keeperLockState.locked);
                  const isKeeperLockUpdating = Boolean(keeperLockUpdating[year]);
                  const keeperLockError = keeperLockErrors[year];
                  const votingLockState = votingLockStates[year] || { locked: false, lockedAt: null, updatedAt: null };
                  const isVotingLocked = Boolean(votingLockState.locked);
                  const isVotingLockUpdating = Boolean(votingLockUpdating[year]);
                  const votingLockError = votingLockErrors[year];
                  const sleeperStatusValue = typeof status?.sleeper_status === 'string'
                    ? status.sleeper_status.toLowerCase()
                    : null;
                  const hasLeagueId = Boolean(leagueSettings[year]);
                  const manualComplete = Boolean(status?.manual_complete);
                  const autoSyncMessage = (() => {
                    if (manualComplete) {
                      return 'Auto sync disabled for manually managed data.';
                    }
                    if (!hasLeagueId) {
                      return 'Enter a Sleeper league ID to enable syncing.';
                    }
                    if (sleeperStatusValue === 'complete') {
                      return 'Sleeper season is complete; syncing has stopped automatically.';
                    }
                    if (status?.sync_status === 'syncing') {
                      return 'Syncing latest data from Sleeper…';
                    }
                    if (status?.sync_status === 'failed') {
                      return 'Last sync attempt failed. Fix issues and reload to try again.';
                    }
                    if (status?.sync_status === 'completed') {
                      return 'Auto sync is active while the season remains in progress.';
                    }
                    return 'Awaiting first successful sync.';
                  })();
                  return (
                    <tr key={year}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {year}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="text"
                          className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 w-40"
                          placeholder="Enter league ID"
                          value={leagueSettings[year] || ''}
                          onChange={(e) => setLeagueSettings(prev => ({
                            ...prev,
                            [year]: e.target.value
                          }))}
                          onBlur={(e) => {
                            if (e.target.value && e.target.value !== status?.league_id) {
                              updateLeagueId(year, e.target.value);
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-1">
                            {status && getSyncStatusIcon(status.sync_status)}
                            <span className="text-sm text-gray-600">
                              {formatSyncStatusLabel(status?.sync_status)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {status?.last_sync
                              ? formatDateTimeForDisplay(status.last_sync)
                              : '—'}
                          </span>
                          {syncErrors[year] && (
                            <div className="flex items-start space-x-1 text-xs text-red-600">
                              <AlertCircle className="w-3 h-3 mt-0.5" />
                              <span>{syncErrors[year]}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {status?.team_count || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm align-top">
                        <div className="space-y-2">
                          <span className="block text-xs text-gray-500">{autoSyncMessage}</span>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => openSeasonModal(year)}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                              type="button"
                            >
                              <Edit3 className="w-3 h-3 mr-1" /> Manage Season
                            </button>
                            <button
                              onClick={() => toggleKeeperLock(year, !isKeeperLocked)}
                              disabled={isKeeperLockUpdating}
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                                isKeeperLocked
                                  ? 'bg-green-600 hover:bg-green-700'
                                  : 'bg-red-600 hover:bg-red-700'
                              }`}
                            >
                              {isKeeperLockUpdating ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : isKeeperLocked ? (
                                <Unlock className="w-3 h-3 mr-1" />
                              ) : (
                                <Lock className="w-3 h-3 mr-1" />
                              )}
                              {isKeeperLockUpdating
                                ? isKeeperLocked
                                  ? 'Unlocking…'
                                  : 'Locking…'
                                : isKeeperLocked
                                ? 'Unlock Keepers'
                                : 'Lock Keepers'}
                            </button>
                            <button
                              onClick={() => toggleVotingLock(year, !isVotingLocked)}
                              disabled={isVotingLockUpdating}
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                                isVotingLocked
                                  ? 'bg-green-600 hover:bg-green-700'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              {isVotingLockUpdating ? (
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              ) : isVotingLocked ? (
                                <Unlock className="w-3 h-3 mr-1" />
                              ) : (
                                <Lock className="w-3 h-3 mr-1" />
                              )}
                              {isVotingLockUpdating
                                ? isVotingLocked
                                  ? 'Unlocking…'
                                  : 'Locking…'
                                : isVotingLocked
                                ? 'Unlock Voting'
                                : 'Lock Voting'}
                            </button>
                            {(keeperLockError || votingLockError) && (
                              <div className="w-full space-y-1 text-xs text-red-600">
                                {keeperLockError && (
                                  <div className="flex items-start space-x-1">
                                    <AlertCircle className="w-3 h-3 mt-0.5" />
                                    <span>{keeperLockError}</span>
                                  </div>
                                )}
                                {votingLockError && (
                                  <div className="flex items-start space-x-1">
                                    <AlertCircle className="w-3 h-3 mt-0.5" />
                                    <span>{votingLockError}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
      </div>
    </div>

    {isSeasonModalVisible && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Season Management · {seasonModalYear}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {seasonModalManual ? 'Manual data entry enabled' : 'Sleeper sync active'} ·{' '}
                {(seasonModalStatus?.team_count || seasonModalSeasons.length || 0)} teams tracked
              </p>
            </div>
            <button
              type="button"
              onClick={closeSeasonModal}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close season management dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-4 space-y-6">
            {seasonModalError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {seasonModalError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-700">Data Source</label>
                <select
                  value={seasonModalDataSource}
                  onChange={e => handleSeasonDataSourceChange(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="sleeper">Sleeper</option>
                  <option value="manual">Manual</option>
                </select>
                <p className="text-xs text-gray-500">
                  Choose whether this season should sync automatically from Sleeper or be managed manually.
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase text-gray-500">Sync Status</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatSyncStatusLabel(seasonModalStatus?.sync_status)}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Last sync:{' '}
                  {seasonModalStatus?.last_sync
                    ? formatDateTimeForDisplay(seasonModalStatus.last_sync)
                    : '—'}
                </p>
              </div>
            </div>

            {seasonModalDataSource === 'sleeper' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Sleeper League ID</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={seasonModalLeagueId}
                    onChange={e => setSeasonModalLeagueId(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Enter league ID"
                  />
                  <button
                    type="button"
                    onClick={handleSeasonLeagueIdSave}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Save League ID
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Updating the league ID will refresh Sleeper sync settings for this season.
                </p>
              </div>
            )}

            {seasonModalDataSource === 'manual' && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="mx-auto h-10 w-10 text-gray-400" />
                <div className="mt-4">
                  <label className="cursor-pointer text-sm font-medium text-gray-900">
                    <span>{seasonModalUploadLoading ? 'Uploading…' : 'Upload Excel file to import season data'}</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="sr-only"
                      onChange={handleSeasonFileUpload}
                      disabled={seasonModalUploadLoading}
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Uploading a file replaces existing season records with the contents of the spreadsheet.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900">Season Data</h4>
                {!seasonModalLoading && seasonModalSeasons.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {isManualSeasonMode
                      ? 'All fields are editable while in Manual mode.'
                      : 'Only financial fields are editable while syncing from Sleeper.'}
                  </span>
                )}
              </div>

              {seasonModalLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading season data...
                </div>
              ) : seasonModalSeasons.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
                  No season records found for {seasonModalYear}. Upload data or sync from Sleeper to get started.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Year</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Manager</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Team</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">W-L</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">PF</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">PA</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Rank</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Playoff</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Dues</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Payout</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Chumpion</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                      <tbody className="divide-y divide-gray-100">
                        {seasonModalSeasons.map(season => {
                          if (!season || typeof season !== 'object') {
                            return null;
                          }
                          const isEditing = seasonModalEditingId === season.id;
                          const managerLabel = managerNameMap[season.name_id] || season.manager_name || season.name_id;
                          const edited = seasonModalEditedRow || {};

                          return (
                          <tr key={season.id} className="bg-white">
                            <td className="px-3 py-2 text-sm text-gray-600">{season.year}</td>
                            <td className="px-3 py-2">
                              {isEditing && isManualSeasonMode ? (
                                <select
                                  value={edited.name_id ?? ''}
                                  onChange={e => updateSeasonEditedField('name_id', e.target.value)}
                                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                >
                                  <option value="">Select manager</option>
                                  {sortedManagers.map(manager => (
                                    <option key={manager.name_id || manager.id} value={manager.name_id || ''}>
                                      {getManagerName(manager)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-sm text-gray-900">{managerLabel}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing && isManualSeasonMode ? (
                                <input
                                  type="text"
                                  value={edited.team_name ?? ''}
                                  onChange={e => updateSeasonEditedField('team_name', e.target.value)}
                                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                />
                              ) : (
                                <span className="text-sm text-gray-700">{season.team_name}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing && isManualSeasonMode ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={edited.wins ?? 0}
                                    onChange={e => updateSeasonEditedField('wins', e.target.value)}
                                    className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                  />
                                  <span className="text-xs text-gray-500">-</span>
                                  <input
                                    type="number"
                                    value={edited.losses ?? 0}
                                    onChange={e => updateSeasonEditedField('losses', e.target.value)}
                                    className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                  />
                                </div>
                              ) : (
                                <span className="text-sm text-gray-700">{season.wins}-{season.losses}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing && isManualSeasonMode ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={edited.points_for ?? 0}
                                  onChange={e => updateSeasonEditedField('points_for', e.target.value)}
                                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                />
                              ) : (
                                <span className="text-sm text-gray-700">{season.points_for}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing && isManualSeasonMode ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={edited.points_against ?? 0}
                                  onChange={e => updateSeasonEditedField('points_against', e.target.value)}
                                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                />
                              ) : (
                                <span className="text-sm text-gray-700">{season.points_against}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing && isManualSeasonMode ? (
                                <input
                                  type="number"
                                  value={edited.regular_season_rank === '' ? '' : edited.regular_season_rank ?? ''}
                                  onChange={e => updateSeasonEditedField('regular_season_rank', e.target.value)}
                                  className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                />
                              ) : (
                                <span className="text-sm text-gray-700">{season.regular_season_rank ?? '—'}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing && isManualSeasonMode ? (
                                <input
                                  type="text"
                                  value={edited.playoff_finish ?? ''}
                                  onChange={e => updateSeasonEditedField('playoff_finish', e.target.value)}
                                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                />
                              ) : (
                                <span className="text-sm text-gray-700">{season.playoff_finish || '—'}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={edited.dues ?? 0}
                                  onChange={e => updateSeasonEditedField('dues', e.target.value)}
                                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                />
                              ) : (
                                <span className="text-sm font-medium text-gray-900">${season.dues}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={edited.payout ?? 0}
                                  onChange={e => updateSeasonEditedField('payout', e.target.value)}
                                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                />
                              ) : (
                                <span className="text-sm font-medium text-gray-900">${season.payout}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={edited.dues_chumpion ?? 0}
                                  onChange={e => updateSeasonEditedField('dues_chumpion', e.target.value)}
                                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                />
                              ) : (
                                <span className="text-sm font-medium text-gray-900">${season.dues_chumpion || 0}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={saveSeasonRowEdit}
                                    disabled={seasonModalSaving}
                                    className="inline-flex items-center rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
                                  >
                                    {seasonModalSaving ? (
                                      <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                                    ) : (
                                      <Save className="mr-1 h-3 w-3" />
                                    )}
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelSeasonRowEdit}
                                    className="inline-flex items-center rounded-md bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startSeasonRowEdit(season)}
                                  className="inline-flex items-center rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                                >
                                  <Edit3 className="mr-1 h-3 w-3" /> Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Manager IDs */}
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6">
        <h4 className="text-lg font-semibold mb-4">Manager IDs</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Full Name</th>
                <th className="px-3 py-2 text-left">Sleeper Username</th>
                <th className="px-3 py-2 text-left">Sleeper User ID</th>
                <th className="px-3 py-2 text-left">Emails</th>
                <th className="px-3 py-2 text-left">Aliases</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedManagers.map(manager => {
                const managerAliases = Array.isArray(aliasesByManager[manager.name_id])
                  ? aliasesByManager[manager.name_id]
                  : [];
                const aliasSeasons = [];
                managerAliases.forEach(alias => {
                  const label = String(alias?.season ?? '').trim();
                  if (!label) {
                    return;
                  }

                  if (!aliasSeasons.includes(label)) {
                    aliasSeasons.push(label);
                  }
                });

                return (
                  <tr key={manager.id}>
                    <td className="px-3 py-2">
                      <span className={`font-medium ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                        {getManagerName(manager) || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{manager.sleeper_username || '-'}</td>
                    <td className="px-3 py-2 text-gray-600">{manager.sleeper_user_id || '-'}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(manager.emails) && manager.emails.length ? (
                          manager.emails.map((email, index) => {
                            const normalizedEmail = typeof email === 'string' ? email : '';
                            if (!normalizedEmail) {
                              return null;
                            }
                            const isPrimary = index === 0;
                            return (
                              <span
                                key={`${manager.id}-${normalizedEmail}-${index}`}
                                className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
                              >
                                <span>{normalizedEmail}</span>
                                {isPrimary && (
                                  <span className="ml-2 text-[10px] uppercase text-indigo-600 font-semibold">Primary</span>
                                )}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-gray-400">No email addresses configured</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {aliasSeasons.length ? (
                        <span className="text-sm text-gray-700">{aliasSeasons.join(', ')}</span>
                      ) : (
                        <span className="text-xs text-gray-400">No aliases configured</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${manager.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {manager.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => startManagerRowEdit(manager)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    {isModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {getManagerName(modalManager) || 'Manager Details'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Name ID:{' '}
                <span className="font-mono text-gray-700">{modalManager?.name_id ?? '—'}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={cancelManagerRowEdit}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close manager details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-5 space-y-6">
            <section>
              <h4 className="text-sm font-semibold text-gray-900">Manager overview</h4>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Full Name</p>
                  <p className="mt-1 text-sm text-gray-900">{getManagerName(modalManager) || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sleeper Username</p>
                  <p className="mt-1 text-sm text-gray-900">{modalManager?.sleeper_username || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sleeper User ID</p>
                  <p className="mt-1 text-sm font-mono text-gray-900 break-all">{modalManager?.sleeper_user_id || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
                  <span
                    className={`mt-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${modalManager?.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                  >
                    {modalManager?.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </section>
            <section>
              <h4 className="text-sm font-semibold text-gray-900">Email addresses</h4>
              <p className="mt-1 text-xs text-gray-500">Update contact emails. The first address is treated as primary.</p>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {displayedEmails.length ? (
                    displayedEmails.map((email, index) => {
                      const normalizedEmail = typeof email === 'string' ? email : '';
                      if (!normalizedEmail) {
                        return null;
                      }
                      const isPrimary = index === 0;
                      return (
                        <span
                          key={`${modalManager?.id || 'manager'}-${normalizedEmail}-${index}`}
                          className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
                        >
                          <span>{normalizedEmail}</span>
                          {isPrimary && (
                            <span className="ml-2 text-[10px] uppercase text-indigo-600 font-semibold">Primary</span>
                          )}
                          {isEmailEditActive && (
                            <button
                              type="button"
                              onClick={() => removeEmailFromEdit(normalizedEmail)}
                              className="ml-1 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={!isEmailEditActive || emailEdit.loading || managerRowSaving}
                              aria-label={`Remove ${normalizedEmail}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-gray-400">No email addresses configured</span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="email"
                    placeholder="Add email"
                    className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 flex-1"
                    value={pendingEmailValue}
                    onChange={(e) => {
                      if (!isEmailEditActive) {
                        return;
                      }
                      setEmailEdit(prev => ({
                        ...prev,
                        newEmail: e.target.value,
                        error: null
                      }));
                    }}
                    onKeyDown={handleEmailInputKeyDown}
                    disabled={!isEmailEditActive || emailEdit.loading || managerRowSaving}
                  />
                  <button
                    type="button"
                    onClick={addEmailToEdit}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isEmailEditActive || emailEdit.loading || managerRowSaving}
                  >
                    Add Email
                  </button>
                </div>
                {isEmailEditActive && emailEdit.error && (
                  <div className="text-xs text-red-600">{emailEdit.error}</div>
                )}
                <p className="text-[11px] text-gray-500">Emails are saved when you select Save Changes.</p>
              </div>
            </section>
            <section>
              <h4 className="text-sm font-semibold text-gray-900">Sleeper aliases</h4>
              <p className="mt-1 text-xs text-gray-500">Track alternate Sleeper IDs by season.</p>
              <div className="mt-3 space-y-3">
                {modalManagerAliases.length ? (
                  modalManagerAliases.map(alias => {
                    const isEditingAlias = editingMappingId === alias.id;
                    return (
                      <div key={alias.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        {isEditingAlias ? (
                          <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="flex flex-col space-y-1">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Season</span>
                                <input
                                  type="number"
                                  className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                  value={editingMapping?.season ?? ''}
                                  onChange={(e) =>
                                    setEditingMapping(prev => ({
                                      ...prev,
                                      season: e.target.value
                                    }))
                                  }
                                />
                              </div>
                              <div className="flex flex-col space-y-1">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Sleeper User ID</span>
                                <input
                                  type="text"
                                  className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                  value={editingMapping?.sleeper_user_id ?? ''}
                                  onChange={(e) =>
                                    setEditingMapping(prev => ({
                                      ...prev,
                                      sleeper_user_id: e.target.value
                                    }))
                                  }
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={saveEditMapping}
                                className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isModalBusy}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMappingId(null);
                                  setEditingMapping({});
                                }}
                                className="text-sm font-medium text-gray-600 hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm">
                            <div>
                              <div className="text-xs uppercase font-semibold text-gray-500">Season</div>
                              <div className="font-medium text-gray-900">{alias.season ?? '—'}</div>
                            </div>
                            <div className="sm:text-right">
                              <div className="text-xs uppercase font-semibold text-gray-500">Sleeper User ID</div>
                              <div className="font-mono text-gray-900 break-all">{alias.sleeper_user_id || '—'}</div>
                            </div>
                            <div className="flex gap-3 sm:self-end">
                              <button
                                type="button"
                                onClick={() => startEditMapping(alias)}
                                className="text-sm font-medium text-blue-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMapping(alias.id)}
                                className="text-sm font-medium text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <span className="text-xs text-gray-400">No aliases configured</span>
                )}
                {isAliasAddActive ? (
                  <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-3 bg-white">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        type="number"
                        placeholder="Season"
                        className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        value={aliasAddState.season}
                        onChange={(e) =>
                          setAliasAddState(prev => ({
                            ...prev,
                            season: e.target.value,
                            error: null
                          }))
                        }
                        disabled={isAliasSaving || isModalBusy}
                      />
                      <input
                        type="text"
                        placeholder="Sleeper User ID"
                        className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        value={aliasAddState.sleeper_user_id}
                        onChange={(e) =>
                          setAliasAddState(prev => ({
                            ...prev,
                            sleeper_user_id: e.target.value,
                            error: null
                          }))
                        }
                        disabled={isAliasSaving || isModalBusy}
                      />
                    </div>
                    {aliasAddState.error && (
                      <div className="text-xs text-red-600">{aliasAddState.error}</div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={saveAliasAdd}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isAliasSaving || isModalBusy}
                      >
                        {isAliasSaving ? 'Saving…' : 'Save Alias'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelAliasAdd}
                        className="text-sm font-medium text-gray-600 hover:underline disabled:opacity-50"
                        disabled={isAliasSaving || isModalBusy}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => modalManager && startAliasAdd(modalManager)}
                    className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isModalBusy}
                  >
                    Add Alias
                  </button>
                )}
              </div>
            </section>
            <section>
              <h4 className="text-sm font-semibold text-gray-900">Passcode</h4>
              <p className="mt-1 text-xs text-gray-500">
                Update the manager passcode. Leave both fields blank to keep the current passcode.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  type="password"
                  placeholder="New passcode"
                  className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={isPasscodeEditActive ? passcodeEdit.passcode : ''}
                  onChange={(e) => {
                    if (!isPasscodeEditActive) {
                      return;
                    }
                    setPasscodeEdit(prev => ({
                      ...prev,
                      passcode: e.target.value,
                      error: null
                    }));
                  }}
                  disabled={!isPasscodeEditActive || passcodeEdit.loading || managerRowSaving}
                />
                <input
                  type="password"
                  placeholder="Confirm passcode"
                  className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={isPasscodeEditActive ? passcodeEdit.confirm : ''}
                  onChange={(e) => {
                    if (!isPasscodeEditActive) {
                      return;
                    }
                    setPasscodeEdit(prev => ({
                      ...prev,
                      confirm: e.target.value,
                      error: null
                    }));
                  }}
                  disabled={!isPasscodeEditActive || passcodeEdit.loading || managerRowSaving}
                />
              </div>
              {isPasscodeEditActive && passcodeEdit.error && (
                <div className="mt-2 text-xs text-red-600">{passcodeEdit.error}</div>
              )}
            </section>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={cancelManagerRowEdit}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isModalBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveManagerRowEdit}
              className="px-4 py-1.5 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaveDisabled}
            >
              {managerRowSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};

export default SleeperAdmin;
