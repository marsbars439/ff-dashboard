import React from 'react';

/**
 * ShareableMatchupCard Component
 *
 * Optimized card for social media sharing with full lineups
 * Renders a matchup in a clean, branded format with starting lineups
 *
 * @param {Object} props
 * @param {Object} props.matchup - Matchup data with home/away teams including starters
 * @param {number} props.week - Week number
 * @param {string} props.leagueName - League name for branding
 */
export function ShareableMatchupCard({ matchup, week, leagueName = 'Fantasy Football' }) {
  const home = matchup.home || {};
  const away = matchup.away || {};

  const formatPoints = (points) => {
    if (points === null || points === undefined) return '--';
    const num = typeof points === 'number' ? points : parseFloat(points);
    if (Number.isNaN(num)) return '--';
    return num.toFixed(2);
  };

  const homePoints = formatPoints(home.points);
  const awayPoints = formatPoints(away.points);

  // Determine winner
  const homeScore = parseFloat(homePoints);
  const awayScore = parseFloat(awayPoints);
  const homeWins = !isNaN(homeScore) && !isNaN(awayScore) && homeScore > awayScore;
  const awayWins = !isNaN(homeScore) && !isNaN(awayScore) && awayScore > homeScore;

  // Get starters (limit to top scoring positions for space)
  const getTopStarters = (team) => {
    if (!team || !Array.isArray(team.starters)) return [];
    return team.starters
      .filter(s => s && s.name)
      .slice(0, 7); // Show top 7 positions
  };

  const homeStarters = getTopStarters(home);
  const awayStarters = getTopStarters(away);

  const renderPlayer = (starter, isWinner) => {
    const points = formatPoints(starter.points);
    const textColor = isWinner ? '#ffffff' : '#e2e8f0';
    const pointsColor = isWinner ? '#10b981' : '#3b82f6';

    return (
      <div
        key={`${starter.player_id}-${starter.slot}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#64748b',
              width: '35px',
              flexShrink: 0,
            }}>
              {starter.position || starter.slot}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: '15px',
                fontWeight: '600',
                color: textColor,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {starter.name}
              </div>
              {starter.team && (
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {starter.team}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: '700',
          color: pointsColor,
          marginLeft: '16px',
          minWidth: '50px',
          textAlign: 'right',
        }}>
          {points}
        </div>
      </div>
    );
  };

  return (
    <div
      data-export-id="shareable-matchup"
      style={{
        width: '1200px',
        minHeight: '1400px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '40px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
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
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
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
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
          borderRadius: '50%',
        }}
      />

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: '32px' }}>
        <div style={{ fontSize: '20px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>
          {leagueName}
        </div>
        <div style={{ fontSize: '42px', fontWeight: '700', color: '#ffffff' }}>
          Week {week} Matchup
        </div>
      </div>

      {/* Score Summary */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        marginBottom: '32px',
        padding: '24px',
        background: 'rgba(30, 41, 59, 0.4)',
        borderRadius: '16px',
        border: '1px solid rgba(148, 163, 184, 0.1)',
      }}>
        {/* Home Team Summary */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: '28px',
            fontWeight: '700',
            marginBottom: '8px',
            color: homeWins ? '#10b981' : '#ffffff',
          }}>
            {home.manager_name || 'TBD'}
          </div>
          {home.team_name && (
            <div style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '12px' }}>
              {home.team_name}
            </div>
          )}
          <div style={{
            fontSize: '56px',
            fontWeight: '900',
            color: homeWins ? '#10b981' : '#3b82f6',
          }}>
            {homePoints}
          </div>
          {homeWins && (
            <div style={{ marginTop: '8px', fontSize: '16px', fontWeight: '600', color: '#10b981' }}>
              ✓ WINNER
            </div>
          )}
        </div>

        {/* VS Divider */}
        <div style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#64748b',
          padding: '12px 20px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '12px',
          border: '1px solid rgba(148, 163, 184, 0.2)',
        }}>
          VS
        </div>

        {/* Away Team Summary */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: '28px',
            fontWeight: '700',
            marginBottom: '8px',
            color: awayWins ? '#10b981' : '#ffffff',
          }}>
            {away.manager_name || 'TBD'}
          </div>
          {away.team_name && (
            <div style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '12px' }}>
              {away.team_name}
            </div>
          )}
          <div style={{
            fontSize: '56px',
            fontWeight: '900',
            color: awayWins ? '#10b981' : '#3b82f6',
          }}>
            {awayPoints}
          </div>
          {awayWins && (
            <div style={{ marginTop: '8px', fontSize: '16px', fontWeight: '600', color: '#10b981' }}>
              ✓ WINNER
            </div>
          )}
        </div>
      </div>

      {/* Lineups */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        gap: '24px',
        flex: 1,
      }}>
        {/* Home Lineup */}
        <div style={{ flex: 1 }}>
          <div style={{
            background: homeWins ? 'rgba(16, 185, 129, 0.1)' : 'rgba(30, 41, 59, 0.5)',
            border: homeWins ? '2px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: '16px',
            padding: '20px',
            backdropFilter: 'blur(10px)',
            height: '100%',
          }}>
            <div style={{
              fontSize: '20px',
              fontWeight: '700',
              marginBottom: '16px',
              color: homeWins ? '#10b981' : '#ffffff',
              borderBottom: '2px solid rgba(148, 163, 184, 0.1)',
              paddingBottom: '12px',
            }}>
              {home.manager_name}'s Lineup
            </div>
            <div>
              {homeStarters.length > 0 ? (
                homeStarters.map(starter => renderPlayer(starter, homeWins))
              ) : (
                <div style={{ fontSize: '14px', color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                  Lineup not available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Away Lineup */}
        <div style={{ flex: 1 }}>
          <div style={{
            background: awayWins ? 'rgba(16, 185, 129, 0.1)' : 'rgba(30, 41, 59, 0.5)',
            border: awayWins ? '2px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: '16px',
            padding: '20px',
            backdropFilter: 'blur(10px)',
            height: '100%',
          }}>
            <div style={{
              fontSize: '20px',
              fontWeight: '700',
              marginBottom: '16px',
              color: awayWins ? '#10b981' : '#ffffff',
              borderBottom: '2px solid rgba(148, 163, 184, 0.1)',
              paddingBottom: '12px',
            }}>
              {away.manager_name}'s Lineup
            </div>
            <div>
              {awayStarters.length > 0 ? (
                awayStarters.map(starter => renderPlayer(starter, awayWins))
              ) : (
                <div style={{ fontSize: '14px', color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                  Lineup not available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        marginTop: '32px',
        paddingTop: '24px',
        borderTop: '1px solid rgba(148, 163, 184, 0.1)',
      }}>
        <div style={{ fontSize: '14px', color: '#64748b' }}>
          Generated by {leagueName} Dashboard
        </div>
      </div>
    </div>
  );
}

export default ShareableMatchupCard;
