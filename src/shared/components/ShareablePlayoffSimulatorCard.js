import React from 'react';

/**
 * ShareablePlayoffSimulatorCard Component
 *
 * Optimized card for social media sharing with playoff simulation results
 * Includes matchups, projected standings, and playoff bracket
 *
 * @param {Object} props
 * @param {Array} props.upcomingWeeks - Array of upcoming weeks with matchups
 * @param {Object} props.predictions - Score predictions keyed by matchup
 * @param {Array} props.projectedStandings - Projected standings array
 * @param {Array} props.playoffSeeds - Playoff seeds array
 * @param {Set} props.playoffIds - Set of team IDs in playoffs
 * @param {string} props.wildcardId - ID of wildcard team
 * @param {Set} props.byeIds - Set of team IDs with byes
 * @param {string} props.chumpionId - ID of last place team
 * @param {string} props.firstPlaceId - ID of first place team
 * @param {Set} props.highestPfIds - Set of team IDs with highest PF
 * @param {string} props.leagueName - League name for branding
 * @param {number} props.year - Season year
 */
export function ShareablePlayoffSimulatorCard({
  upcomingWeeks,
  predictions,
  projectedStandings,
  playoffSeeds,
  playoffIds,
  wildcardId,
  byeIds,
  chumpionId,
  firstPlaceId,
  highestPfIds,
  leagueName = 'Fantasy Football',
  year
}) {
  const formatRecord = (team) => {
    const ties = team.ties || 0;
    return `${team.wins}-${team.losses}${ties ? `-${ties}` : ''}`;
  };

  const formatPoints = (points) => {
    if (points === null || points === undefined) return '--';
    const num = typeof points === 'number' ? points : parseFloat(points);
    if (Number.isNaN(num)) return '--';
    return num.toFixed(1);
  };

  const getSeed = (n) => playoffSeeds.find((s) => s.seed === n) || null;

  // Render matchup summary (compact view)
  const renderMatchupsSummary = () => {
    if (!upcomingWeeks || upcomingWeeks.length === 0) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          No upcoming matchups to simulate
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {upcomingWeeks.slice(0, 3).map((week) => (
          <div key={week.week}>
            <div style={{
              fontSize: '13px',
              fontWeight: '700',
              color: '#e2e8f0',
              marginBottom: '8px',
              borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
              paddingBottom: '6px',
            }}>
              Week {week.week}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(week.matchups || []).slice(0, 3).map((matchup, idx) => {
                const homeScore = predictions?.[`${week.week}-${idx}`]?.homeScore;
                const awayScore = predictions?.[`${week.week}-${idx}`]?.awayScore;
                const homeWins = homeScore && awayScore && parseFloat(homeScore) > parseFloat(awayScore);
                const awayWins = homeScore && awayScore && parseFloat(awayScore) > parseFloat(homeScore);

                return (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontWeight: '600',
                        color: homeWins ? '#10b981' : '#e2e8f0',
                      }}>
                        {matchup.home?.manager_name || 'TBD'}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '10px' }}>vs</span>
                      <span style={{
                        fontWeight: '600',
                        color: awayWins ? '#10b981' : '#e2e8f0',
                      }}>
                        {matchup.away?.manager_name || 'TBD'}
                      </span>
                    </div>
                    {homeScore && awayScore && (
                      <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '600' }}>
                        {formatPoints(homeScore)} - {formatPoints(awayScore)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render projected standings (compact)
  const renderStandings = () => {
    if (!projectedStandings || projectedStandings.length === 0) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          No standings available
        </div>
      );
    }

    return (
      <div style={{ width: '100%' }}>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <thead style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.15)' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>Rank</th>
              <th style={{ textAlign: 'left', padding: '8px 8px', color: '#94a3b8', fontWeight: '600' }}>Manager</th>
              <th style={{ textAlign: 'left', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>Record</th>
              <th style={{ textAlign: 'right', padding: '8px 0', color: '#94a3b8', fontWeight: '600' }}>PF</th>
            </tr>
          </thead>
          <tbody>
            {projectedStandings.slice(0, 8).map((team) => {
              const inPlayoffs = playoffIds?.has(team.id);
              const isWildcard = wildcardId && team.id === wildcardId;
              const hasBye = byeIds?.has?.(team.id);
              const isChumpion = chumpionId && team.id === chumpionId;
              const isFirstPlace = firstPlaceId && team.id === firstPlaceId;
              const hasHighestPf = highestPfIds?.has?.(team.id);

              return (
                <tr
                  key={team.id}
                  style={{
                    backgroundColor: inPlayoffs ? 'rgba(16, 185, 129, 0.08)' : isWildcard ? 'rgba(251, 191, 36, 0.08)' : 'transparent',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                  }}
                >
                  <td style={{ padding: '10px 0', color: '#f1f5f9', fontWeight: '600' }}>{team.rank}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ color: '#f1f5f9', fontWeight: '600', fontSize: '12px' }}>
                        {team.managerName}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {hasBye && (
                          <span style={{
                            padding: '2px 6px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '8px',
                            fontSize: '9px',
                            fontWeight: '600',
                            color: '#10b981',
                          }}>
                            Bye
                          </span>
                        )}
                        {isWildcard && (
                          <span style={{
                            padding: '2px 6px',
                            backgroundColor: 'rgba(251, 191, 36, 0.15)',
                            border: '1px solid rgba(251, 191, 36, 0.3)',
                            borderRadius: '8px',
                            fontSize: '9px',
                            fontWeight: '600',
                            color: '#fbbf24',
                          }}>
                            Wildcard
                          </span>
                        )}
                        {isChumpion && (
                          <span style={{
                            padding: '2px 6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            fontSize: '9px',
                            fontWeight: '600',
                            color: '#ef4444',
                          }}>
                            Chump
                          </span>
                        )}
                        {(isFirstPlace || hasHighestPf) && (
                          <span style={{
                            padding: '2px 6px',
                            backgroundColor: 'rgba(163, 230, 53, 0.15)',
                            border: '1px solid rgba(163, 230, 53, 0.3)',
                            borderRadius: '8px',
                            fontSize: '9px',
                            fontWeight: '600',
                            color: '#a3e635',
                          }}>
                            {isFirstPlace && hasHighestPf ? '+$600' : '+$300'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 0', color: '#e2e8f0' }}>{formatRecord(team)}</td>
                  <td style={{ padding: '10px 0', color: '#e2e8f0', textAlign: 'right' }}>{formatPoints(team.pointsFor)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Render playoff bracket (compact)
  const renderBracket = () => {
    const seed1 = getSeed(1);
    const seed2 = getSeed(2);
    const seed3 = getSeed(3);
    const seed4 = getSeed(4);
    const seed5 = getSeed(5);
    const seed6 = getSeed(6);

    const MatchupBox = ({ topSeed, bottomSeed, topLabel, bottomLabel }) => {
      const topName = topSeed ? topSeed.managerName : topLabel || 'TBD';
      const topSeedNum = topSeed ? `#${topSeed.seed}` : '';
      const bottomName = bottomSeed ? bottomSeed.managerName : bottomLabel || 'TBD';
      const bottomSeedNum = bottomSeed ? `#${bottomSeed.seed}` : '';

      return (
        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '8px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 8px',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: '6px',
          }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: topSeed ? '#f1f5f9' : '#64748b' }}>
              {topName}
            </span>
            {topSeedNum && (
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>{topSeedNum}</span>
            )}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 8px',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: '6px',
          }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: bottomSeed ? '#f1f5f9' : '#64748b' }}>
              {bottomName}
            </span>
            {bottomSeedNum && (
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>{bottomSeedNum}</span>
            )}
          </div>
        </div>
      );
    };

    return (
      <div style={{ display: 'flex', gap: '12px' }}>
        {/* Round 1 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', marginBottom: '2px' }}>Round 1</div>
          <MatchupBox topSeed={seed1} bottomLabel="Bye" />
          <MatchupBox topSeed={seed4} bottomSeed={seed5} />
          <MatchupBox topSeed={seed2} bottomLabel="Bye" />
          <MatchupBox topSeed={seed6} bottomSeed={seed3} />
        </div>

        {/* Semifinals */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', marginBottom: '2px' }}>Semifinals</div>
          <MatchupBox topSeed={seed1} topLabel="Seed 1" bottomLabel="Win 4/5" />
          <div style={{ height: '20px' }} />
          <MatchupBox topSeed={seed2} topLabel="Seed 2" bottomLabel="Win 3/6" />
        </div>

        {/* Championship */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>Final</div>
          <MatchupBox topLabel="Winner" bottomLabel="Winner" />
        </div>
      </div>
    );
  };

  return (
    <div
      data-export-id="shareable-playoff-simulator"
      style={{
        width: '1400px',
        minHeight: '1000px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '40px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative Background Elements */}
      <div
        style={{
          position: 'absolute',
          top: '-100px',
          right: '-100px',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)',
          borderRadius: '50%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-150px',
          left: '-150px',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%)',
          borderRadius: '50%',
        }}
      />

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '18px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>
          {leagueName} {year && `• ${year}`}
        </div>
        <div style={{ fontSize: '42px', fontWeight: '700', color: '#ffffff' }}>
          Playoff Simulator
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr',
        gap: '24px',
      }}>
        {/* Left Column: Matchups */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '14px',
          padding: '20px',
        }}>
          <div style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '16px',
            borderBottom: '2px solid rgba(148, 163, 184, 0.15)',
            paddingBottom: '12px',
          }}>
            Simulated Matchups
          </div>
          {renderMatchupsSummary()}
        </div>

        {/* Right Column: Standings */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '14px',
          padding: '20px',
        }}>
          <div style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '16px',
            borderBottom: '2px solid rgba(148, 163, 184, 0.15)',
            paddingBottom: '12px',
          }}>
            Projected Standings
          </div>
          {renderStandings()}
        </div>
      </div>

      {/* Bracket Section */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        background: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid rgba(148, 163, 184, 0.15)',
        borderRadius: '14px',
        padding: '20px',
      }}>
        <div style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#ffffff',
          marginBottom: '16px',
          borderBottom: '2px solid rgba(148, 163, 184, 0.15)',
          paddingBottom: '12px',
        }}>
          Projected Playoff Bracket
        </div>
        {renderBracket()}
      </div>
    </div>
  );
}

export default ShareablePlayoffSimulatorCard;
