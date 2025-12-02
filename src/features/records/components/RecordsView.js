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
import DashboardSection from '../../../components/DashboardSection';
import { BarChart, PieChart } from '../../../shared/components';

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
      bodyClassName="space-y-2 sm:space-y-4"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl shadow-lg p-2.5 sm:p-4 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1 sm:mb-1.5">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 flex-shrink-0" />
                <span className="text-[10px] sm:text-xs md:text-sm font-medium opacity-90">{mostRecentYear} CHAMPION</span>
              </div>
              <h2 className="text-sm sm:text-lg md:text-2xl font-bold mb-0.5 sm:mb-1 truncate">
                {currentChampion ? allRecords[currentChampion.name_id]?.name : 'TBD'}
              </h2>
              <p
                className={`text-xs sm:text-sm md:text-base mb-1 sm:mb-1.5 md:mb-2 ${
                  currentChampion ? 'text-yellow-100' : 'text-white'
                }`}
              >
                {currentChampion
                  ? `${currentChampion.team_name} • ${currentChampion.wins}-${currentChampion.losses} Record`
                  : 'Season in progress'}
              </p>
              <p className="text-yellow-100 font-semibold text-xs sm:text-sm md:text-base mb-1.5 sm:mb-2">
                {currentChampion ? `$${currentChampion.payout} Prize Money` : ''}
              </p>
              {currentYearSeasons.length > 0 && (
                <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 text-[10px] sm:text-xs md:text-sm opacity-90">
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
            <Trophy className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-yellow-200 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-400 to-red-600 rounded-xl shadow-lg p-2.5 sm:p-4 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1 sm:mb-1.5">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 flex-shrink-0" />
                <span className="text-[10px] sm:text-xs md:text-sm font-medium opacity-90">{mostRecentYear} CHUMPION</span>
              </div>
              <h2 className="text-sm sm:text-lg md:text-2xl font-bold mb-0.5 sm:mb-1 truncate">
                {currentChumpion ? allRecords[currentChumpion.name_id]?.name : 'TBD'}
              </h2>
              <p className="text-red-100 text-xs sm:text-sm md:text-base mb-1 sm:mb-1.5">
                {currentChumpion
                  ? `${currentChumpion.team_name} • ${currentChumpion.wins}-${currentChumpion.losses} Record`
                  : 'Season in progress'}
              </p>
              <p className="text-red-100 font-semibold text-xs sm:text-sm md:text-base mb-1.5 sm:mb-2">
                {currentChumpion
                  ? getCurrentYearChumpionDues() > 0
                    ? `Paid $${getCurrentYearChumpionDues()} Extra to ${
                        currentChampion ? allRecords[currentChampion.name_id]?.name : 'Champion'
                      }`
                    : 'Pays extra to Champion'
                  : ''}
              </p>
            </div>
            <Frown className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-red-100 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
        <div className="card-primary text-white">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-1.5 sm:mb-3">
            <div>
              <h3 className="text-sm sm:text-lg md:text-xl font-bold flex items-center space-x-2">
                <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                <span>Medal Count Rankings</span>
              </h3>
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2.5 mb-3">
            {medalRankings.map((manager, index) => (
              <div
                key={manager.name}
                className="card-tertiary hover:bg-white/10 transition-all duration-200"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm sm:text-base md:text-lg font-bold ${
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
                      <h4 className="font-semibold text-xs sm:text-base md:text-lg truncate text-white">{manager.name}</h4>
                      <p className="text-[10px] sm:text-xs md:text-sm text-slate-300">
                        {manager.totalWins}-{manager.totalLosses} ({(manager.winPct * 100).toFixed(1)}%) • {manager.gamesPlayed} games
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-4 flex-shrink-0 w-full sm:w-auto">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="text-center">
                        <div className="text-amber-300 font-bold text-base sm:text-lg md:text-xl">{manager.championships}</div>
                        <div className="text-[10px] sm:text-[0.65rem] uppercase tracking-wide text-amber-100">🥇 titles</div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-200 font-bold text-base sm:text-lg md:text-xl">{manager.secondPlace}</div>
                        <div className="text-[10px] sm:text-[0.65rem] uppercase tracking-wide text-slate-300">🥈</div>
                      </div>
                      <div className="text-center">
                        <div className="text-orange-300 font-bold text-base sm:text-lg md:text-xl">{manager.thirdPlace}</div>
                        <div className="text-[10px] sm:text-[0.65rem] uppercase tracking-wide text-orange-200">🥉</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-xs sm:text-sm md:text-base text-indigo-200">{manager.pointsPerGame.toFixed(1)} PPG</p>
                      <p className="text-[10px] sm:text-xs md:text-sm text-slate-300">{manager.totalMedals} total medals</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Medal Distribution Charts - Side by Side */}
          <div className="pt-2 border-t border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PieChart
                data={{
                  labels: medalRankings.slice(0, 6).map(m => m.name.split(' ').slice(-1)[0]),
                  values: medalRankings.slice(0, 6).map(m => m.championships)
                }}
                title="Championships"
                subtitle="1st place finishes"
                className="max-h-[250px]"
              />
              <PieChart
                data={{
                  labels: medalRankings.slice(0, 6).map(m => m.name.split(' ').slice(-1)[0]),
                  values: medalRankings.slice(0, 6).map(m => m.totalMedals)
                }}
                title="All Medals"
                subtitle="Total playoff finishes"
                className="max-h-[250px]"
              />
            </div>
          </div>
        </div>

        <div className="card-primary">
          <h3 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 mb-1.5 sm:mb-3 flex items-center space-x-2">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
            <span>Chumpion Count Rankings</span>
          </h3>

          <div className="space-y-1.5 sm:space-y-2.5">
            {chumpionRankings.map((manager, index) => (
              <div key={manager.name} className="card-tertiary">
                <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className="font-bold text-sm sm:text-base md:text-lg flex-shrink-0">#{index + 1}</span>
                    <span className="font-semibold text-xs sm:text-sm md:text-base truncate text-gray-900">{manager.name}</span>
                  </div>
                  <span className={`text-base sm:text-lg md:text-xl font-bold flex-shrink-0 ${
                    manager.chumpionships > 0 ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {manager.chumpionships}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] sm:text-xs md:text-sm">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
        <div className="card-primary">
          <h3 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 mb-1.5 sm:mb-3 flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            <span>Win Percentage Rankings</span>
          </h3>

          <div className="space-y-0.5 sm:space-y-1.5 mb-3">
            {winPctRankings.map((manager, index) => (
              <div
                key={manager.name}
                className={`card-tertiary ${
                  manager.active ? '' : 'opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    {manager.active ? <span className="font-bold text-sm sm:text-base md:text-lg flex-shrink-0">#{index + 1}</span> : null}
                    <span className={`font-semibold text-xs sm:text-sm md:text-base truncate ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                      {manager.name}
                    </span>
                  </div>
                  <span className={`text-base sm:text-lg md:text-xl font-bold flex-shrink-0 ${manager.active ? 'text-blue-600' : 'text-gray-500'}`}>
                    {(manager.winPct * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-[10px] sm:text-xs md:text-sm text-gray-600">
                  <span className={manager.active ? 'text-gray-600' : 'text-gray-400'}>
                    {manager.totalWins}-{manager.totalLosses}
                  </span>
                  <span className={manager.active ? 'text-gray-600' : 'text-gray-400'}>{manager.gamesPlayed} games played</span>
                </div>
              </div>
            ))}
          </div>

          {/* Win Percentage Chart */}
          <div className="pt-2 border-t border-gray-200">
            <BarChart
              data={{
                labels: winPctRankings.filter(m => m.active).map(m => m.name.split(' ').slice(-1)[0]),
                values: winPctRankings.filter(m => m.active).map(m => m.winPct * 100),
                label: 'Win %',
                conditionalColor: true,
                baseline: 50
              }}
              title="Win % vs 50% Baseline"
              subtitle="All active managers (green = above .500, red = below .500)"
              horizontal={false}
              className="max-h-[280px]"
            />
          </div>
        </div>

        <div className="card-primary">
          <h3 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 mb-1.5 sm:mb-3 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
            <span>Points Per Game Rankings</span>
          </h3>

          <div className="space-y-0.5 sm:space-y-1.5 mb-3">
            {ppgRankings.map((manager, index) => (
              <div
                key={`${manager.name}-${index}`}
                className={`card-tertiary ${
                  manager.active ? '' : 'opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    {manager.active ? <span className="font-bold text-sm sm:text-base md:text-lg flex-shrink-0">#{index + 1}</span> : null}
                    <span className={`font-semibold text-xs sm:text-sm md:text-base truncate ${manager.active ? 'text-gray-900' : 'text-gray-500'}`}>
                      {manager.name}
                    </span>
                  </div>
                  <span className={`text-base sm:text-lg md:text-xl font-bold flex-shrink-0 ${manager.active ? 'text-green-600' : 'text-gray-500'}`}>
                    {manager.pointsPerGame.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] sm:text-xs md:text-sm">
                  <span className={manager.active ? 'text-gray-600' : 'text-gray-400'}>
                    {manager.totalPointsFor.toLocaleString()} total
                  </span>
                  <span className={manager.active ? 'text-gray-600' : 'text-gray-400'}>{manager.gamesPlayed} games played</span>
                </div>
              </div>
            ))}
          </div>

          {/* Points Per Game Chart */}
          <div className="pt-2 border-t border-gray-200">
            <BarChart
              data={{
                labels: ppgRankings.filter(m => m.active).slice(0, 6).map(m => m.name.split(' ').slice(-1)[0]),
                values: ppgRankings.filter(m => m.active).slice(0, 6).map(m => m.pointsPerGame),
                label: 'PPG',
                minValue: 100
              }}
              title="PPG Comparison"
              subtitle="Top 6 active managers"
              horizontal={true}
              className="max-h-[250px]"
            />
          </div>
        </div>
      </div>

      <div className="card-primary">
        <h3 className="text-sm sm:text-lg md:text-xl font-bold text-slate-50 mb-1.5 sm:mb-3 flex items-center space-x-2">
          <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
          <span>Individual Manager Lookup</span>
        </h3>

        <div className="mb-1.5 sm:mb-3">
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1.5 sm:mb-3 space-y-2 sm:space-y-0">
              <h4 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900">
                {allRecords[selectedManager].name}
              </h4>
              {!allRecords[selectedManager].active && (
                <span className="bg-gray-200 text-gray-700 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium self-start sm:self-auto">
                  INACTIVE
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-3">
              <div className="card-tertiary">
                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">Franchise Record</p>
                <p className="text-base sm:text-xl md:text-2xl font-bold text-gray-900">
                  {allRecords[selectedManager].totalWins}-{allRecords[selectedManager].totalLosses}
                </p>
                <p className="text-[10px] sm:text-xs md:text-sm text-gray-500">
                  {(allRecords[selectedManager].winPct * 100).toFixed(1)}% win rate
                </p>
              </div>

              <div className="card-tertiary">
                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">Championships</p>
                <p className="text-base sm:text-xl md:text-2xl font-bold text-yellow-600">
                  {allRecords[selectedManager].championships}
                </p>
                <p className="text-[10px] sm:text-xs md:text-sm text-gray-500">
                  {allRecords[selectedManager].totalMedals} total medals
                </p>
              </div>

              <div className="card-tertiary">
                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">Net Earnings</p>
                <p
                  className={`text-base sm:text-xl md:text-2xl font-bold ${
                    allRecords[selectedManager].netEarnings >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {allRecords[selectedManager].netEarnings >= 0 ? '+' : '-'}$
                  {Math.abs(allRecords[selectedManager].netEarnings)}
                </p>
                <p className="text-[10px] sm:text-xs md:text-sm text-gray-500">
                  ${allRecords[selectedManager].totalPayout} won - $
                  {allRecords[selectedManager].totalDues + allRecords[selectedManager].totalDuesChumpion} dues
                </p>
              </div>

              <div className="card-tertiary">
                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">Points Per Game</p>
                <p className="text-base sm:text-xl md:text-2xl font-bold text-blue-600">
                  {allRecords[selectedManager].pointsPerGame.toFixed(1)}
                </p>
                <p className="text-[10px] sm:text-xs md:text-sm text-gray-500">
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
