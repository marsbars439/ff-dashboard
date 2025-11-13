import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock, Lock, Unlock, X } from 'lucide-react';

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
  const [newMapping, setNewMapping] = useState({ name_id: '', season: '', sleeper_user_id: '' });
  const [editingMappingId, setEditingMappingId] = useState(null);
  const [editingMapping, setEditingMapping] = useState({});
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

  const managersByName = useMemo(() => {
    return [...managers].sort((a, b) => {
      const nameA = getManagerName(a);
      const nameB = getManagerName(b);
      return nameA.localeCompare(nameB);
    });
  }, [managers]);

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

  const addMapping = async () => {
    if (!newMapping.name_id || !newMapping.season || !newMapping.sleeper_user_id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/manager-sleeper-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMapping)
      });
      if (response.ok) {
        setNewMapping({ name_id: '', season: '', sleeper_user_id: '' });
        fetchMappings();
      }
    } catch (error) {
      console.error('Error adding mapping:', error);
    }
  };

  const startEditMapping = (mapping) => {
    setEditingMappingId(mapping.id);
    setEditingMapping({ ...mapping });
  };

  const saveEditMapping = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/manager-sleeper-ids/${editingMappingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMapping)
      });
      if (response.ok) {
        setEditingMappingId(null);
        setEditingMapping({});
        fetchMappings();
      }
    } catch (error) {
      console.error('Error updating mapping:', error);
    }
  };

  const deleteMapping = async (id) => {
    if (!window.confirm('Delete this mapping?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/manager-sleeper-ids/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchMappings();
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
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
      return;
    }

    const managerToUpdate = managers.find(m => m.id === emailEdit.managerId);
    if (!managerToUpdate) {
      setEmailEdit(prev => ({ ...prev, error: 'Manager not found' }));
      return;
    }

    const pendingEmail = typeof emailEdit.newEmail === 'string' ? emailEdit.newEmail.trim() : '';
    if (pendingEmail && !isValidEmail(pendingEmail)) {
      setEmailEdit(prev => ({ ...prev, error: `Enter a valid email address (${pendingEmail})` }));
      return;
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
      return;
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
    } catch (error) {
      setEmailEdit(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to update emails'
      }));
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

  const startPasscodeEdit = (manager) => {
    setPasscodeEdit({
      managerId: manager.name_id,
      passcode: '',
      confirm: '',
      loading: false,
      error: null
    });
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
      return;
    }

    if (!passcodeEdit.passcode) {
      setPasscodeEdit(prev => ({ ...prev, error: 'Enter a passcode.' }));
      return;
    }

    if (passcodeEdit.passcode !== passcodeEdit.confirm) {
      setPasscodeEdit(prev => ({ ...prev, error: 'Passcodes do not match.' }));
      return;
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

      cancelPasscodeEdit();
      setMessage({
        type: 'success',
        text: `Passcode updated for ${managerNameMap[targetManagerId] || targetManagerId}`
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setPasscodeEdit(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to update passcode'
      }));
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
                              ? new Date(status.last_sync).toLocaleString()
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

    {/* Manager IDs */}
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6">
        <h4 className="text-lg font-semibold mb-4">Manager IDs</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Name ID</th>
                <th className="px-3 py-2 text-left">Full Name</th>
                <th className="px-3 py-2 text-left">Sleeper Username</th>
                <th className="px-3 py-2 text-left">Sleeper User ID</th>
                <th className="px-3 py-2 text-left">Emails</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-left">Passcode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedManagers.map(manager => (
                <tr key={manager.id}>
                  <td className="px-3 py-2 font-mono text-xs">{manager.name_id}</td>
                  <td className="px-3 py-2">
                    <span className={`font-medium ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                      {getManagerName(manager) || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{manager.sleeper_username || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{manager.sleeper_user_id || '-'}</td>
                  <td className="px-3 py-2 align-top">
                    {emailEdit.managerId === manager.id ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(emailEdit.emails) && emailEdit.emails.length ? (
                            emailEdit.emails.map((email, index) => {
                              const normalizedEmail = typeof email === 'string' ? email : '';
                              if (!normalizedEmail) {
                                return null;
                              }
                              const isPrimary = index === 0;
                              return (
                                <span
                                  key={`${normalizedEmail}-${index}`}
                                  className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
                                >
                                  <span>{normalizedEmail}</span>
                                  {isPrimary && (
                                    <span className="ml-2 text-[10px] uppercase text-indigo-600 font-semibold">Primary</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeEmailFromEdit(normalizedEmail)}
                                    className="ml-1 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 disabled:opacity-50"
                                    disabled={emailEdit.loading}
                                    aria-label={`Remove ${normalizedEmail}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-gray-500">No email addresses added yet.</span>
                          )}
                        </div>
                        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                          <input
                            type="email"
                            placeholder="Add email"
                            className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            value={emailEdit.newEmail}
                            onChange={(e) =>
                              setEmailEdit(prev => ({
                                ...prev,
                                newEmail: e.target.value,
                                error: null
                              }))
                            }
                            onKeyDown={handleEmailInputKeyDown}
                            disabled={emailEdit.loading}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={addEmailToEdit}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
                              disabled={emailEdit.loading}
                            >
                              Add Email
                            </button>
                            <button
                              type="button"
                              onClick={saveEmailEdit}
                              className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                              disabled={emailEdit.loading}
                            >
                              {emailEdit.loading ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEmailEdit}
                              className="text-xs font-medium text-gray-600 hover:underline"
                              disabled={emailEdit.loading}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                        {emailEdit.error && (
                          <div className="text-xs text-red-600">{emailEdit.error}</div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
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
                        <button
                          type="button"
                          onClick={() => startEmailEdit(manager)}
                          className="self-start text-xs font-medium text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${manager.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {manager.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {passcodeEdit.managerId === manager.name_id ? (
                      <div className="space-y-2">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                          <input
                            type="password"
                            placeholder="New passcode"
                            className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            value={passcodeEdit.passcode}
                            onChange={(e) =>
                              setPasscodeEdit(prev => ({
                                ...prev,
                                passcode: e.target.value,
                                error: null
                              }))
                            }
                            disabled={passcodeEdit.loading}
                          />
                          <input
                            type="password"
                            placeholder="Confirm passcode"
                            className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            value={passcodeEdit.confirm}
                            onChange={(e) =>
                              setPasscodeEdit(prev => ({
                                ...prev,
                                confirm: e.target.value,
                                error: null
                              }))
                            }
                            disabled={passcodeEdit.loading}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={savePasscodeEdit}
                              className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                              disabled={passcodeEdit.loading}
                            >
                              {passcodeEdit.loading ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={cancelPasscodeEdit}
                              className="text-xs font-medium text-gray-600 hover:underline"
                              disabled={passcodeEdit.loading}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                        {passcodeEdit.error && (
                          <div className="text-xs text-red-600">{passcodeEdit.error}</div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => startPasscodeEdit(manager)}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Set Passcode
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* Manager ID Aliases mappings */}
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6">
        <h4 className="text-lg font-semibold mb-4">Manager ID Aliases</h4>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select
            className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={newMapping.name_id}
            onChange={(e) => setNewMapping(prev => ({ ...prev, name_id: e.target.value }))}
          >
            <option value="">Select Manager</option>
            {managersByName.map(m => (
              <option key={m.name_id} value={m.name_id}>
                {getManagerName(m) || m.name_id}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Season"
            className="border-gray-300 rounded-md shadow-sm w-24 focus:border-blue-500 focus:ring-blue-500"
            value={newMapping.season}
            onChange={(e) => setNewMapping(prev => ({ ...prev, season: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Sleeper User ID"
            className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={newMapping.sleeper_user_id}
            onChange={(e) => setNewMapping(prev => ({ ...prev, sleeper_user_id: e.target.value }))}
          />
          <button
            onClick={addMapping}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Manager</th>
                <th className="px-3 py-2 text-left">Season</th>
                <th className="px-3 py-2 text-left">Sleeper User ID</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {managerMappings.map(m => (
                <tr key={m.id}>
                  <td className="px-3 py-2">{managerNameMap[m.name_id] || m.name_id}</td>
                  <td className="px-3 py-2">
                    {editingMappingId === m.id ? (
                      <input
                        type="number"
                        className="border-gray-300 rounded-md shadow-sm w-24 focus:border-blue-500 focus:ring-blue-500"
                        value={editingMapping.season}
                        onChange={(e) => setEditingMapping(prev => ({ ...prev, season: e.target.value }))}
                      />
                    ) : (
                      m.season
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingMappingId === m.id ? (
                      <input
                        type="text"
                        className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        value={editingMapping.sleeper_user_id}
                        onChange={(e) => setEditingMapping(prev => ({ ...prev, sleeper_user_id: e.target.value }))}
                      />
                    ) : (
                      m.sleeper_user_id
                    )}
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    {editingMappingId === m.id ? (
                      <>
                        <button onClick={saveEditMapping} className="text-blue-600 hover:underline">Save</button>
                        <button onClick={() => setEditingMappingId(null)} className="text-gray-600 hover:underline">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEditMapping(m)} className="text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => deleteMapping(m.id)} className="text-red-600 hover:underline">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    </div>
  );
};

export default SleeperAdmin;
