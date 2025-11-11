import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock, Eye } from 'lucide-react';

const SleeperAdmin = ({ API_BASE_URL, onDataUpdate }) => {
  const [leagueSettings, setLeagueSettings] = useState({});
  const [syncStatus, setSyncStatus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncingYear, setSyncingYear] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [message, setMessage] = useState(null);
  const [managerMappings, setManagerMappings] = useState([]);
  const [managers, setManagers] = useState([]);
  const [newMapping, setNewMapping] = useState({ name_id: '', season: '', sleeper_user_id: '' });
  const [editingMappingId, setEditingMappingId] = useState(null);
  const [editingMapping, setEditingMapping] = useState({});
  const [passcodeEdit, setPasscodeEdit] = useState({
    managerId: null,
    passcode: '',
    confirm: '',
    loading: false,
    error: null
  });

  const sortedManagers = useMemo(() => {
    return [...managers].sort((a, b) => {
      if (a.active !== b.active) return b.active - a.active;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [managers]);

  const managersByName = useMemo(() => {
    return [...managers].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [managers]);

  // Generate years from 2015 to current year
  const years = Array.from(
    { length: new Date().getFullYear() - 2014 },
    (_, i) => new Date().getFullYear() - i
  );

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
      data.settings.forEach(s => {
        settings[s.year] = s.league_id;
      });
      setLeagueSettings(settings);
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
      setManagers(data.managers || []);
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
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update league ID' });
    }
  };

  const previewSync = async (year) => {
    const leagueId = leagueSettings[year];
    if (!leagueId) {
      setMessage({ type: 'error', text: `No league ID set for ${year}` });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/sleeper/preview/${year}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ league_id: leagueId })
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewData(data);
        setShowPreview(true);
        setSelectedYear(year);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to preview data' });
    } finally {
      setLoading(false);
    }
  };

  const syncData = async (year, preserveManualFields = true) => {
    const leagueId = leagueSettings[year];
    if (!leagueId) {
      setMessage({ type: 'error', text: `No league ID set for ${year}` });
      return;
    }

    setSyncingYear(year);
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
        setMessage({ 
          type: 'success', 
          text: `Synced ${data.summary.successful_updates} teams for ${year}` 
        });
        fetchSyncStatus();
        if (onDataUpdate) onDataUpdate();
        setShowPreview(false);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Sync failed' });
    } finally {
      setSyncingYear(null);
    }
  };

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

  const managerNameMap = Object.fromEntries(managers.map(m => [m.name_id, m.full_name]));

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
                    Last Sync
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          {status && getSyncStatusIcon(status.sync_status)}
                          <span className="text-sm text-gray-600">
                            {status?.sync_status || 'Never synced'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {status?.last_sync ? 
                          new Date(status.last_sync).toLocaleDateString() : 
                          'Never'
                        }
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {status?.team_count || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => previewSync(year)}
                            disabled={!leagueSettings[year] || loading || syncingYear === year}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Preview
                          </button>
                          <button
                            onClick={() => syncData(year)}
                            disabled={!leagueSettings[year] || syncingYear === year}
                            className="inline-flex items-center px-2 py-1 border border-transparent rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {syncingYear === year ? (
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3 mr-1" />
                            )}
                            Sync
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
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-left">Passcode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedManagers.map(manager => (
                <tr key={manager.id}>
                  <td className="px-3 py-2 font-mono text-xs">{manager.name_id}</td>
                  <td className="px-3 py-2">
                    <span className={`font-medium ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>{manager.full_name}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{manager.sleeper_username || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{manager.sleeper_user_id || '-'}</td>
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
              <option key={m.name_id} value={m.name_id}>{m.full_name}</option>
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

    {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">
                Preview Sync for {previewData.year}
              </h3>
              <div className="mt-2 text-sm text-gray-600">
                League ID: {previewData.league_id}
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Summary */}
              <div className="mb-4 grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-xs text-blue-600">Total Teams</div>
                  <div className="text-xl font-bold">{previewData.summary.total_teams}</div>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <div className="text-xs text-green-600">Matched</div>
                  <div className="text-xl font-bold">{previewData.summary.matched}</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded">
                  <div className="text-xs text-yellow-600">To Update</div>
                  <div className="text-xl font-bold">{previewData.summary.to_update}</div>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <div className="text-xs text-red-600">Unmatched</div>
                  <div className="text-xl font-bold">{previewData.summary.unmatched}</div>
                </div>
              </div>

              {/* Team Details */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Team</th>
                      <th className="px-3 py-2 text-left">Manager</th>
                      <th className="px-3 py-2 text-left">Record</th>
                      <th className="px-3 py-2 text-left">Points</th>
                      <th className="px-3 py-2 text-left">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewData.preview.map((team, idx) => (
                      <tr key={idx} className={
                        team.status === 'unmatched' ? 'bg-red-50' : ''
                      }>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            team.status === 'unmatched' ? 'bg-red-100 text-red-800' :
                            team.status === 'update' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {team.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">{team.team_name || '-'}</td>
                        <td className="px-3 py-2">
                          {team.name_id || team.sleeper_user_id}
                        </td>
                        <td className="px-3 py-2">{team.wins}-{team.losses}</td>
                        <td className="px-3 py-2">{team.points_for.toFixed(2)}</td>
                        <td className="px-3 py-2">{team.regular_season_rank}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {previewData.summary.unmatched > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ {previewData.summary.unmatched} Sleeper users don't match any managers in your database. 
                    Make sure the sleeper_user_id field is set correctly in the Managers table.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-between">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <div className="space-x-2">
                <button
                  onClick={() => {
                    syncData(selectedYear, true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Sync (Preserve Manual Fields)
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('This will overwrite ALL data including dues and payouts. Are you sure?')) {
                      syncData(selectedYear, false);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Sync (Overwrite All)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SleeperAdmin;
