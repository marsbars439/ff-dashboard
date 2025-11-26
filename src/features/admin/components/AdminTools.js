import React from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Database,
  FileText,
  Gavel,
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  Zap
} from 'lucide-react';
import CollapsibleSection from '../../../components/CollapsibleSection';
import SleeperAdmin from '../../../components/SleeperAdmin';
import AISummaryConfig from '../../../components/AISummaryConfig';
import RuleChangeAdmin from '../../../components/RuleChangeAdmin';
import DashboardSection from '../../../components/DashboardSection';
import { useAdminSession } from '../../../state/AdminSessionContext';
import { useKeeperTools } from '../../../state/KeeperToolsContext';

const AdminTools = ({
  apiBaseUrl,
  availableYears = [],
  managers = [],
  rulesContent,
  setRulesContent,
  onSaveRules = () => {},
  onAnalyticsClick = () => {},
  onSignOut,
  onDataUpdate = () => {}
}) => {
  const {
    adminSession,
    adminAuthorized,
    adminPasswordInput,
    setAdminPasswordInput,
    adminPasswordError,
    setAdminPasswordError,
    adminAuthLoading,
    handleAdminAuthSubmit,
    handleAdminSignOut
  } = useAdminSession();
  const {
    selectedKeeperYear,
    setSelectedKeeperYear,
    keepers,
    newTrade,
    setNewTrade,
    manualTrades,
    addManualTrade,
    deleteManualTrade,
    getManagerName
  } = useKeeperTools();

  const handleSignOutClick = () => {
    handleAdminSignOut();
    if (typeof onSignOut === 'function') {
      onSignOut();
    }
  };

  if (!adminAuthorized) {
    return (
      <DashboardSection
        title="Admin Access"
        description="Secure tools for commissioners and data upkeep."
        icon={ShieldCheck}
        className="max-w-xl mx-auto"
      >
        <div className="card-primary text-slate-100 space-y-4">
          <form onSubmit={handleAdminAuthSubmit} className="space-y-4">
            {adminSession.status === 'pending' && (
              <p className="text-sm text-slate-200 flex items-center">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Validating existing session...
              </p>
            )}
            <input
              type="password"
              placeholder="Enter admin password"
              value={adminPasswordInput}
              onChange={e => {
                setAdminPasswordInput(e.target.value);
                if (adminPasswordError) {
                  setAdminPasswordError(null);
                }
              }}
              disabled={adminAuthLoading}
              className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
            {adminPasswordError && <p className="text-sm text-red-300">{adminPasswordError}</p>}
            <button
              type="submit"
              disabled={adminAuthLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:hover:bg-blue-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded shadow"
            >
              {adminAuthLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {adminSession.status === 'pending' ? 'Verifying...' : 'Authenticating...'}
                </span>
              ) : (
                'Enter'
              )}
            </button>
          </form>
        </div>
      </DashboardSection>
    );
  }

  const adminActions = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSignOutClick}
        className="flex items-center justify-center px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm shadow"
      >
        <LogOut className="w-4 h-4 mr-1" /> Sign Out
      </button>
      <button
        onClick={onAnalyticsClick}
        className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm shadow"
      >
        <BarChart3 className="w-4 h-4 mr-1" /> Analytics
      </button>
    </div>
  );

  return (
    <DashboardSection
      title="Admin Console"
      description="Commissioner tools, data imports, and AI helpers in one place."
      icon={Gavel}
      actions={adminActions}
      bodyClassName="space-y-6 sm:space-y-8"
    >

      <SleeperAdmin API_BASE_URL={apiBaseUrl} onDataUpdate={onDataUpdate}>
        {({ renderMessageBanner, renderDataManagementSection, renderManagerSection }) => {
          const banner = renderMessageBanner();

          return (
            <>
              {banner && <div className="mb-4">{banner}</div>}
              <CollapsibleSection
                title={
                  <div className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-blue-500" />
                    <span>Data Management</span>
                  </div>
                }
              >
                <div className="space-y-4">{renderDataManagementSection()}</div>
              </CollapsibleSection>
              <CollapsibleSection
                title={
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    <span>Managers</span>
                  </div>
                }
              >
                <div className="space-y-4">{renderManagerSection()}</div>
              </CollapsibleSection>
            </>
          );
        }}
      </SleeperAdmin>

      <CollapsibleSection
        title={
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-purple-500" />
            <span>AI Summary Settings</span>
          </div>
        }
      >
        <AISummaryConfig API_BASE_URL={apiBaseUrl} onDataUpdate={onDataUpdate} />
      </CollapsibleSection>

      <CollapsibleSection
        title={
          <div className="flex items-center space-x-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-500" />
            <span>Record a Trade</span>
          </div>
        }
      >
        {availableYears.length > 0 && (
          <div className="mb-4">
            <select
              value={selectedKeeperYear || ''}
              onChange={e => setSelectedKeeperYear(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{`${year} (${year + 1} Draft)`}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
          <select
            value={newTrade.from}
            onChange={e => setNewTrade({ ...newTrade, from: e.target.value })}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm flex-1"
          >
            <option value="">From Team</option>
            {[...keepers]
              .sort((a, b) => (a.manager_name || a.team_name).localeCompare(b.manager_name || b.team_name))
              .map(team => (
                <option key={team.roster_id} value={team.roster_id}>
                  {team.manager_name || team.team_name}
                </option>
              ))}
          </select>
          <select
            value={newTrade.to}
            onChange={e => setNewTrade({ ...newTrade, to: e.target.value })}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm flex-1"
          >
            <option value="">To Team</option>
            {[...keepers]
              .sort((a, b) => (a.manager_name || a.team_name).localeCompare(b.manager_name || b.team_name))
              .map(team => (
                <option key={team.roster_id} value={team.roster_id}>
                  {team.manager_name || team.team_name}
                </option>
              ))}
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={newTrade.amount}
            onChange={e => setNewTrade({ ...newTrade, amount: e.target.value })}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm w-24"
          />
          <input
            type="text"
            placeholder="Note"
            value={newTrade.note}
            onChange={e => setNewTrade({ ...newTrade, note: e.target.value })}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm flex-1"
          />
          <button className="flex items-center px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm" onClick={addManualTrade}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </button>
        </div>
        {manualTrades.length === 0 ? (
          <p className="text-gray-500 text-sm">No trades recorded.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {manualTrades.map(t => (
              <li key={t.id} className="flex items-center justify-between">
                <span>
                  {getManagerName(t.from_roster_id)} (-${t.amount}) to {getManagerName(t.to_roster_id)} (+${t.amount})
                  {t.note ? ` - ${t.note}` : ''}
                </span>
                <button onClick={() => deleteManualTrade(t.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={
          <div className="flex items-center space-x-2">
            <Gavel className="w-5 h-5 text-purple-500" />
            <span>Manage Rule Change Proposals</span>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Season Selection</h4>
              <p className="text-xs text-gray-500">Choose the keeper year to manage proposals for the upcoming season.</p>
            </div>
            {availableYears.length > 0 && (
              <select
                value={selectedKeeperYear ?? ''}
                onChange={event => {
                  const value = event.target.value;
                  setSelectedKeeperYear(value ? Number(value) : null);
                }}
                className="w-full sm:w-auto rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
              >
                <option value="" disabled>
                  Select a season
                </option>
                {availableYears.map(year => (
                  <option key={`rule-change-year-${year}`} value={year}>
                    {`${year + 1} Season`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <RuleChangeAdmin managers={managers} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-purple-500" />
            <span>Edit League Rules</span>
          </div>
        }
      >
        <div className="space-y-4">
          <textarea
            value={rulesContent}
            onChange={e => setRulesContent(e.target.value)}
            className="w-full h-64 sm:h-96 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs sm:text-sm"
            placeholder="Enter league rules in Markdown format..."
          />
          <div className="flex justify-end">
            <button
              onClick={onSaveRules}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base"
            >
              Save Rules
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </DashboardSection>
  );
};

export default AdminTools;
