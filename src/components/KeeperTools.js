import React from 'react';
import { Cloud, Loader2, ShieldCheck } from 'lucide-react';
import RuleVotingPanel from './RuleVotingPanel';
import { useManagerAuth } from '../state/ManagerAuthContext';
import { useKeeperTools } from '../state/KeeperToolsContext';
import { useRuleVoting } from '../state/RuleVotingContext';

const KeeperTools = ({ availableYears = [], managerOptions = [] }) => {
  const {
    managerAuth,
    managerAuthSelection,
    setManagerAuthSelection,
    managerAuthPasscode,
    setManagerAuthPasscode,
    managerAuthError,
    managerAuthLoading,
    loginManager
  } = useManagerAuth();
  const {
    selectedKeeperYear,
    setSelectedKeeperYear,
    keepers,
    keeperEditingLocked,
    selectedKeeperRosterId,
    setSelectedKeeperRosterId,
    selectedKeeperRoster,
    canEditSelectedKeeperRoster,
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
    canEditRoster
  } = useKeeperTools();
  const { handleManagerLogout: handleRuleVotingManagerLogout } = useRuleVoting();

  const handleManagerLogin = async (event) => {
    event.preventDefault();
    await loginManager();
  };

  if (managerAuth.status !== 'authenticated') {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8">
          <div className="flex items-center space-x-3 mb-6 sm:mb-8">
            <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Manager Verification</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">Authenticate as a league manager to view preseason content.</p>
          {managerAuth.status === 'pending' ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {managerAuth.verificationSource === 'cloudflare'
                  ? 'Verifying manager via Cloudflare...'
                  : 'Verifying stored manager session...'}
              </span>
            </div>
          ) : (
            <form onSubmit={handleManagerLogin} className="space-y-4">
              <div className="space-y-3">
                <select
                  value={managerAuthSelection}
                  onChange={e => setManagerAuthSelection(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select manager</option>
                  {managerOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <input
                  type="password"
                  value={managerAuthPasscode}
                  onChange={e => setManagerAuthPasscode(e.target.value)}
                  placeholder="Manager passcode"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              {managerAuthError && <p className="text-sm text-red-600">{managerAuthError}</p>}
              <button
                type="submit"
                disabled={managerAuthLoading}
                className={`w-full rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors ${
                  managerAuthLoading ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {managerAuthLoading ? 'Verifying…' : 'Verify Manager'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-end">
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs sm:text-sm text-gray-600">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            <span>
              Verified as{' '}
              <span className="font-semibold text-gray-700">{managerAuth.managerName || managerAuth.managerId}</span>
            </span>
          </span>
          {managerAuth.verificationSource === 'cloudflare' && (
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium uppercase tracking-wide text-blue-600">
              <Cloud className="h-3 w-3" />
              Verified via Cloudflare
            </span>
          )}
          <button
            type="button"
            onClick={handleRuleVotingManagerLogout}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          {keeperEditingLocked && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              Keeper and trade selections are currently locked by the commissioner.
            </div>
          )}
          {availableYears.length > 0 && (
            <div className="flex justify-center">
              <div className="inline-flex flex-col items-center gap-2">
                <span className="text-xs sm:text-sm font-medium uppercase tracking-wide text-gray-600">Rosters / Draft Filter</span>
                <select
                  value={selectedKeeperYear || ''}
                  onChange={e => setSelectedKeeperYear(Number(e.target.value))}
                  className="border-2 border-blue-200 bg-white rounded-full px-4 py-2 text-sm sm:text-base font-medium text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {`${year} Rosters / ${year + 1} Draft`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <RuleVotingPanel />

      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-0">
            {keeperSummaryView === 'keepers'
              ? `Keepers for the ${selectedKeeperYear + 1} season`
              : keeperSummaryView === 'trades'
              ? `Trades involving ${selectedKeeperYear + 1} draft money`
              : `${selectedKeeperYear + 1} Starting Draft Budget`}
          </h3>
          <div className="flex gap-2">
            <button
              className={`px-2 py-1 text-sm rounded ${
                keeperSummaryView === 'keepers' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => setKeeperSummaryView('keepers')}
            >
              Keepers
            </button>
            <button
              className={`px-2 py-1 text-sm rounded ${
                keeperSummaryView === 'trades' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => setKeeperSummaryView('trades')}
            >
              Trades
            </button>
            <button
              className={`px-2 py-1 text-sm rounded ${
                keeperSummaryView === 'budgets' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
              }`}
              onClick={() => setKeeperSummaryView('budgets')}
            >
              Draft Budgets
            </button>
          </div>
        </div>
        {keeperSummaryView === 'keepers' && (
          keeperSummary.length === 0 ? (
            <p className="text-gray-500 text-sm">No keepers selected.</p>
          ) : (
            <ul className="text-sm list-disc list-inside space-y-1">
              {keeperSummary.map(team => (
                <li key={team.roster_id}>
                  <strong>{team.team_name}:</strong> {team.players.join(', ')}
                </li>
              ))}
            </ul>
          )
        )}
        {keeperSummaryView === 'trades' && (
          tradeSummary.length === 0 ? (
            <p className="text-gray-500 text-sm">No trades recorded.</p>
          ) : (
            <ul className="text-sm list-disc list-inside space-y-1">
              {tradeSummary.map((trade, idx) => (
                <li key={idx}>
                  {trade.manual
                    ? `${trade.from} (-$${trade.amount}) in-season trade to ${trade.to} (+$${trade.amount})${
                        trade.note ? ` - ${trade.note}` : ''
                      }`
                    : `${trade.to} (-$${trade.amount}) buys ${trade.player} from ${trade.from} (+$${trade.amount})${
                        trade.note ? ` - ${trade.note}` : ''
                      }`}
                </li>
              ))}
            </ul>
          )
        )}
        {keeperSummaryView === 'budgets' && (
          draftBudgetSummary.length === 0 ? (
            <p className="text-gray-500 text-sm">No budget data.</p>
          ) : (
            <ul className="text-sm list-disc list-inside space-y-1">
              {draftBudgetSummary.map((b, idx) => (
                <li key={idx}>
                  <strong>{b.manager}:</strong> ${b.amount}
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-0">{selectedKeeperYear} Rosters</h2>
          {keepers.length > 0 && (
            <select
              value={selectedKeeperRosterId || ''}
              onChange={e => setSelectedKeeperRosterId(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              {[...keepers]
                .sort((a, b) => (a.manager_name || a.team_name).localeCompare(b.manager_name || b.team_name))
                .map(team => (
                  <option key={team.roster_id} value={team.roster_id}>
                    {team.manager_name || team.team_name}
                  </option>
                ))}
            </select>
          )}
        </div>
        {keepers.length === 0 ? (
          <p className="text-gray-500">No roster data available for this season.</p>
        ) : (
          selectedKeeperRoster && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">
                {selectedKeeperRoster.manager_name || selectedKeeperRoster.team_name}
              </h3>
              {selectedKeeperRoster.team_name && selectedKeeperRoster.manager_name && (
                <p className="text-sm text-gray-600 mb-2">{selectedKeeperRoster.team_name}</p>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="py-1 px-2">Player</th>
                      <th className="py-1 px-2">Previous Cost</th>
                      <th className="py-1 px-2"># of Years Kept</th>
                      <th className="py-1 px-2">Trade?</th>
                      <th className="py-1 px-2">Cost to Keep</th>
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
                                disabled={!canEditSelectedKeeperRoster || player.years_kept > 1}
                              />
                              {player.trade && (
                                <div className="mt-1 space-y-1">
                                  <select
                                    value={player.trade_roster_id || ''}
                                    onChange={e =>
                                      handleTradeRosterChange(selectedKeeperRoster.roster_id, idx, e.target.value)
                                    }
                                    className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                                    disabled={!canEditSelectedKeeperRoster}
                                  >
                                    <option value="">Select manager</option>
                                    {keepers
                                      .filter(t => t.roster_id !== selectedKeeperRoster.roster_id)
                                      .sort((a, b) => (a.manager_name || a.team_name).localeCompare(b.manager_name || b.team_name))
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
                                      handleTradeAmountChange(selectedKeeperRoster.roster_id, idx, e.target.value)
                                    }
                                    placeholder="$"
                                    className="border border-gray-300 rounded px-1 py-0.5 text-xs w-20"
                                    disabled={!canEditSelectedKeeperRoster}
                                  />
                                  <input
                                    type="text"
                                    value={player.trade_note || ''}
                                    onChange={e =>
                                      handleTradeNoteChange(selectedKeeperRoster.roster_id, idx, e.target.value)
                                    }
                                    placeholder="Note"
                                    className="border border-gray-300 rounded px-1 py-0.5 text-xs w-32"
                                    disabled={!canEditSelectedKeeperRoster}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-1 px-2">{player.cost_to_keep ? `$${player.cost_to_keep}` : ''}</td>
                        <td className="py-1 px-2">
                          <input
                            type="checkbox"
                            checked={player.keep}
                            onChange={() => toggleKeeperSelection(selectedKeeperRoster.roster_id, idx)}
                            disabled={!canEditSelectedKeeperRoster || player.trade || player.years_kept > 1 || !canEditRoster}
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
  );
};

export default KeeperTools;
