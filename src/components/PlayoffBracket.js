import React from 'react';
import { GitBranch } from 'lucide-react';
import DashboardSection from './DashboardSection';

const PlayoffBracket = ({ rounds = [] }) => {
  const filteredRounds = (rounds || [])
    .map(r => ({
      ...r,
      matchups: (r.matchups || []).filter(
        m =>
          m.home?.roster_id != null &&
          m.home?.seed <= 6 &&
          (m.away == null ||
            m.away?.roster_id == null ||
            m.away?.seed <= 6)
      )
    }))
    .filter(r => r.matchups.length > 0);

  const round1Losers = new Set();
  if (filteredRounds[0]) {
    filteredRounds[0].matchups.forEach(m => {
      if (!m.away || m.away.roster_id == null) return; // skip byes
      const homePoints = m.home?.points ?? 0;
      const awayPoints = m.away?.points ?? 0;
      if (homePoints > awayPoints) {
        round1Losers.add(m.away.roster_id);
      } else if (awayPoints > homePoints) {
        round1Losers.add(m.home.roster_id);
      }
    });
  }

  const semifinalWinners = new Set();
  const semifinalLosers = new Set();
  if (filteredRounds[1]) {
    // Remove 5th place game from second round
    filteredRounds[1].matchups = filteredRounds[1].matchups.filter(m => {
      const homeId = m.home.roster_id;
      const awayId = m.away.roster_id;
      return !(round1Losers.has(homeId) && round1Losers.has(awayId));
    });

    // Determine semifinal winners and losers
    filteredRounds[1].matchups.forEach(m => {
      const homePoints = m.home?.points ?? 0;
      const awayPoints = m.away?.points ?? 0;
      if (homePoints > awayPoints) {
        semifinalWinners.add(m.home.roster_id);
        semifinalLosers.add(m.away.roster_id);
      } else if (awayPoints > homePoints) {
        semifinalWinners.add(m.away.roster_id);
        semifinalLosers.add(m.home.roster_id);
      }
    });
  }

  if (filteredRounds[2]) {
    // Only keep championship and 3rd place games in final round
    filteredRounds[2].matchups = filteredRounds[2].matchups.filter(m => {
      const homeId = m.home.roster_id;
      const awayId = m.away.roster_id;
      const isChampionship =
        semifinalWinners.has(homeId) && semifinalWinners.has(awayId);
      const isThirdPlace =
        semifinalLosers.has(homeId) && semifinalLosers.has(awayId);
      return isChampionship || isThirdPlace;
    });
  }

  if (filteredRounds.length === 0) return null;

  const roundLabels = ['Round 1', 'Round 2', 'Round 3'];

  return (
    <DashboardSection
      title="Playoff Bracket"
      description="Seeds 1-6 postseason results"
      icon={GitBranch}
      bodyClassName="w-full overflow-x-auto"
    >
      <div className="flex items-start space-x-4 sm:space-x-8 w-max mx-auto">
        {filteredRounds.map((round, roundIdx) => (
          <div
            key={roundIdx}
            className={`flex flex-col space-y-4 ${
              roundIdx === 1 ? 'mt-12' : roundIdx === 2 ? 'mt-24' : ''
            }`}
          >
            <div className="text-center text-sm sm:text-base font-semibold mb-1">
              {roundLabels[roundIdx] || `Round ${roundIdx + 1}`}
            </div>
            {round.matchups.map((m, idx) => {
              const homePoints = m.home?.points ?? 0;
              const awayPoints = m.away?.points ?? 0;
              const hasAway = m.away?.roster_id != null;
              const isBye = roundIdx === 0 && !hasAway;
              const homeWin = hasAway && homePoints > awayPoints;
              const awayWin = hasAway && awayPoints > homePoints;
              let gameLabel = '';
              if (roundIdx === 2) {
                const homeId = m.home.roster_id;
                const awayId = m.away.roster_id;
                if (
                  semifinalWinners.has(homeId) &&
                  semifinalWinners.has(awayId)
                ) {
                  gameLabel = 'Championship';
                } else if (
                  semifinalLosers.has(homeId) &&
                  semifinalLosers.has(awayId)
                ) {
                  gameLabel = '3rd Place Game';
                }
              }
              return (
                <div key={idx} className="relative">
                  {gameLabel && (
                    <div className="text-center text-xs sm:text-sm font-medium mb-1">
                      {gameLabel}
                    </div>
                  )}
                  <div className="card-tertiary w-40 sm:w-48 text-xs sm:text-sm">
                    <div
                      className={`flex justify-between ${
                        homeWin || isBye ? 'font-semibold text-green-600' : ''
                      }`}
                    >
                      <span className="truncate">
                        {m.home.seed != null ? `(${m.home.seed}) ${m.home.manager_name}` : m.home.manager_name}
                      </span>
                      <span>{homePoints || ''}</span>
                    </div>
                    <div className={`flex justify-between ${awayWin ? 'font-semibold text-green-600' : ''}`}>
                      <span className="truncate">
                        {m.away?.seed != null
                          ? `(${m.away.seed}) ${m.away.manager_name}`
                          : m.away?.manager_name || 'Bye'}
                      </span>
                      <span>{hasAway ? (awayPoints || '') : ''}</span>
                    </div>
                  </div>
                  {roundIdx < filteredRounds.length - 1 && (
                    <div className="absolute top-1/2 right-0 w-4 sm:w-6 border-t-2 border-gray-300"></div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </DashboardSection>
  );
};

export default PlayoffBracket;
