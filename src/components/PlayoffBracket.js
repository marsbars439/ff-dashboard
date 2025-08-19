import React from 'react';

const PlayoffBracket = ({ rounds = [] }) => {
  if (!rounds || rounds.length === 0 || rounds.every(r => !r.matchups || r.matchups.length === 0)) return null;

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-center items-start space-x-4 sm:space-x-8">
        {rounds.map((round, roundIdx) => (
          <div key={roundIdx} className="flex flex-col space-y-6">
            {round.matchups.map((m, idx) => {
              const homeWin = m.home && m.away ? m.home.points > m.away.points : false;
              const awayWin = m.home && m.away ? m.away.points > m.home.points : false;
              return (
                <div key={idx} className="relative">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 w-40 sm:w-48 text-xs sm:text-sm">
                    <div className={`flex justify-between ${homeWin ? 'font-semibold text-green-600' : ''}`}>
                      <span className="truncate">{m.home?.manager_name}</span>
                      <span>{m.home?.points ?? ''}</span>
                    </div>
                    <div className={`flex justify-between ${awayWin ? 'font-semibold text-green-600' : ''}`}>
                      <span className="truncate">{m.away?.manager_name}</span>
                      <span>{m.away?.points ?? ''}</span>
                    </div>
                  </div>
                  {roundIdx < rounds.length - 1 && (
                    <div className="absolute top-1/2 right-0 w-4 sm:w-6 border-t-2 border-gray-300"></div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayoffBracket;
