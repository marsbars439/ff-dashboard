import React from 'react';
import {
  Award,
  BarChart3,
  ChevronDown,
  Crown,
  Target,
  TrendingUp,
  Trophy,
  Zap,
  Frown
} from 'lucide-react';
import DashboardSection from './DashboardSection';

const RecordsView = ({
  allRecords,
  mostRecentYear,
  currentChampion,
  currentChumpion,
  currentYearSeasons,
  selectedManager,
  onSelectManager,
  medalRankings,
  chumpionRankings,
  winPctRankings,
  ppgRankings,
  getCurrentYearChumpionDues
}) => {
  return (
    <DashboardSection
      title="Hall of Records"
      description="League champions, medal counts, and manager-by-manager performance snapshots."
      icon={Trophy}
      bodyClassName="space-y-6 sm:space-y-8"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
              <p
                className={`text-sm sm:text-base mb-2 ${
                  currentChampion ? 'text-yellow-100' : 'text-white'
                }`}
              >
                {currentChampion
                  ? `${currentChampion.team_name} • ${currentChampion.wins}-${currentChampion.losses} Record`
                  : 'Season in progress'}
              </p>
              <p className="text-yellow-100 font-semibold text-sm sm:text-base mb-3">
                {currentChampion ? `$${currentChampion.payout} Prize Money` : ''}
              </p>
              {currentYearSeasons.length > 0 && (
                <div className="mt-3 pt-3 text-xs sm:text-sm opacity-90">
                  {currentYearSeasons.find(s => s.playoff_finish === 2) && (
                    <div className="truncate">
                      2nd: {allRecords[currentYearSeasons.find(s => s.playoff_finish === 2).name_id]?.name}
                    </div>
                  )}
                  {currentYearSeasons.find(s => s.playoff_finish === 3) && (
                    <div className="truncate">
                      3rd: {allRecords[currentYearSeasons.find(s => s.playoff_finish === 3).name_id]?.name}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-200 flex-shrink-0 ml-2" />
          </div>
        </div>

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
                {currentChumpion
                  ? `${currentChumpion.team_name} • ${currentChumpion.wins}-${currentChumpion.losses} Record`
                  : 'Season in progress'}
              </p>
              <p className="text-red-100 font-semibold text-sm sm:text-base mb-3">
                {currentChumpion
                  ? getCurrentYearChumpionDues() > 0
                    ? `Paid $${getCurrentYearChumpionDues()} Extra to ${
                        currentChampion ? allRecords[currentChampion.name_id]?.name : 'Champion'
                      }`
                    : 'Pays extra to Champion'
                  : ''}
              </p>
            </div>
            <Frown className="w-10 h-10 sm:w-12 sm:h-12 text-red-100 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card-primary text-white">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <h3 className="text-lg sm:text-xl font-bold flex items-center space-x-2">
                <Award className="w-5 h-5 text-amber-300" />
                <span>Medal Count Rankings</span>
              </h3>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {medalRankings.map((manager, index) => (
              <div
                key={manager.name}
                className="card-tertiary hover:bg-white/10 transition-all duration-200"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-base sm:text-lg font-bold ${
                        index === 0
                          ? 'bg-amber-400 text-slate-900 shadow-lg'
                          : index === 1
                          ? 'bg-slate-200 text-slate-900 shadow'
                          : index === 2
                          ? 'bg-amber-700/80 text-white shadow'
                          : 'bg-slate-800 text-slate-100 border border-white/10'
                      }`}
                    >
                      #{index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-base sm:text-lg truncate text-white">{manager.name}</h4>
                      <p className="text-xs sm:text-sm text-slate-300">
                        {manager.totalWins}-{manager.totalLosses} ({(manager.winPct * 100).toFixed(1)}%) • {manager.gamesPlayed} games
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 sm:gap-6 flex-shrink-0 w-full sm:w-auto">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-amber-300 font-bold text-lg sm:text-xl">{manager.championships}</div>
                        <div className="text-[0.65rem] uppercase tracking-wide text-amber-100">🥇 titles</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-200 font-bold text-lg sm:text-xl">{manager.secondPlace}</div>
                        <div className="text-[0.65rem] uppercase tracking-wide text-slate-300">🥈</div>
                      </div>
                      <div className="text-center">
                        <div className="text-orange-300 font-bold text-lg sm:text-xl">{manager.thirdPlace}</div>
                        <div className="text-[0.65rem] uppercase tracking-wide text-orange-200">🥉</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm sm:text-base text-indigo-200">{manager.pointsPerGame.toFixed(1)} PPG</p>
                      <p className="text-xs sm:text-sm text-slate-300">{manager.totalMedals} total medals</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-primary">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center space-x-2">
            <Target className="w-5 h-5 text-red-500" />
            <span>Chumpion Count Rankings</span>
          </h3>

          <div className="space-y-2 sm:space-y-3">
            {chumpionRankings.map((manager, index) => (
              <div key={manager.name} className="card-tertiary">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className="font-bold text-base sm:text-lg flex-shrink-0">#{index + 1}</span>
                    <span className="font-semibold text-sm sm:text-base truncate text-gray-900">{manager.name}</span>
                  </div>
                  <span className={`text-lg sm:text-xl font-bold flex-shrink-0 ${
                    manager.chumpionships > 0 ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {manager.chumpionships}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">{manager.seasons} seasons</span>
                  <span className="text-gray-600">
                    {manager.chumpionYears.length > 0 ? manager.chumpionYears.join(', ') : 'None'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card-primary">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-5 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <span>Win Percentage Rankings</span>
          </h3>

          <div className="space-y-1 sm:space-y-2">
            {winPctRankings.map((manager, index) => (
              <div
                key={manager.name}
                className={`card-tertiary ${
                  manager.active ? '' : 'opacity-75'
                }`}
              >
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
                  <span className={manager.active ? 'text-gray-600' : 'text-gray-400'}>{manager.gamesPlayed} games played</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-primary">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-5 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <span>Points Per Game Rankings</span>
          </h3>

          <div className="space-y-1 sm:space-y-2">
            {ppgRankings.map((manager, index) => (
              <div
                key={`${manager.name}-${index}`}
                className={`card-tertiary ${
                  manager.active ? '' : 'opacity-75'
                }`}
              >
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
                  <span className={manager.active ? 'text-gray-600' : 'text-gray-400'}>{manager.gamesPlayed} games played</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-primary">
        <h3 className="text-lg sm:text-xl font-bold text-slate-50 mb-4 sm:mb-6 flex items-center space-x-2">
          <Zap className="w-5 h-5 text-purple-500" />
          <span>Individual Manager Lookup</span>
        </h3>

        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <select
              value={selectedManager}
              onChange={(e) => onSelectManager(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-3 pr-10 text-gray-700 leading-tight focus:outline-none focus:border-blue-500 text-sm sm:text-base"
            >
              <option value="">Select a manager to view detailed stats</option>
              {Object.entries(allRecords)
                .sort((a, b) => a[1].name.localeCompare(b[1].name))
                .map(([nameId, manager]) => (
                  <option key={nameId} value={nameId}>
                    {manager.name} {!manager.active ? '(Inactive)' : ''}
                  </option>
                ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
          </div>
        </div>

        {selectedManager && allRecords[selectedManager] && (
          <div className="card-secondary">
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
              <div className="card-tertiary">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Franchise Record</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {allRecords[selectedManager].totalWins}-{allRecords[selectedManager].totalLosses}
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  {(allRecords[selectedManager].winPct * 100).toFixed(1)}% win rate
                </p>
              </div>

              <div className="card-tertiary">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Championships</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-600">
                  {allRecords[selectedManager].championships}
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  {allRecords[selectedManager].totalMedals} total medals
                </p>
              </div>

              <div className="card-tertiary">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Net Earnings</p>
                <p
                  className={`text-xl sm:text-2xl font-bold ${
                    allRecords[selectedManager].netEarnings >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {allRecords[selectedManager].netEarnings >= 0 ? '+' : '-'}$
                  {Math.abs(allRecords[selectedManager].netEarnings)}
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  ${allRecords[selectedManager].totalPayout} won - $
                  {allRecords[selectedManager].totalDues + allRecords[selectedManager].totalDuesChumpion} dues
                </p>
              </div>

              <div className="card-tertiary">
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
    </DashboardSection>
  );
};

export default RecordsView;
