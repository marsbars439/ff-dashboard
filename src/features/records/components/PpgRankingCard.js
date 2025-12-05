import React from 'react';

const PpgRankingCard = React.memo(({ manager, index }) => {
  return (
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
  );
});

export default PpgRankingCard;
