import React from 'react';

const MedalRankingCard = React.memo(({ manager, index }) => {
  return (
    <div
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
  );
});

export default MedalRankingCard;
