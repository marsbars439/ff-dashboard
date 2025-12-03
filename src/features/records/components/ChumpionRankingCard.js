import React from 'react';

const ChumpionRankingCard = React.memo(({ manager, index }) => {
  return (
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
  );
});

export default ChumpionRankingCard;
