import React from 'react';
import { getPlayerStatus } from '../../utils/playerStatus';

/**
 * ShareableMatchupCard Component
 *
 * Optimized card for social media sharing with full lineups and status indicators
 * Renders a matchup in a clean, branded format with ALL starting lineup information
 *
 * @param {Object} props
 * @param {Object} props.matchup - Matchup data with home/away teams including ALL starters
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
    const rounded = Math.round(num * 100) / 100;
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
  };

  const homePoints = formatPoints(home.points);
  const awayPoints = formatPoints(away.points);

  // Determine winner
  const homeScore = parseFloat(homePoints);
  const awayScore = parseFloat(awayPoints);
  const homeWins = !isNaN(homeScore) && !isNaN(awayScore) && homeScore > awayScore;
  const awayWins = !isNaN(homeScore) && !isNaN(awayScore) && awayScore > homeScore;

  // Get ALL starters
  const getAllStarters = (team) => {
    if (!team || !Array.isArray(team.starters)) return [];
    return team.starters.filter(s => s && s.name);
  };

  const homeStarters = getAllStarters(home);
  const awayStarters = getAllStarters(away);

  const renderPlayer = (starter, isWinner) => {
    const points = formatPoints(starter.points);
    const status = getPlayerStatus(starter);
    const textColor = isWinner ? '#ffffff' : '#e2e8f0';
    const pointsColor = isWinner ? '#10b981' : '#3b82f6';

    // Get opponent info
    const opponentLabel = starter.opponent
      ? `${starter.home_away === 'home' ? 'vs' : '@'} ${starter.opponent}`
      : null;

    return (
      <div
        key={`${starter.player_id}-${starter.slot}`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '10px 0',
          borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
          minHeight: '60px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#64748b',
            width: '45px',
            flexShrink: 0,
            paddingTop: '2px',
          }}>
            {starter.position || starter.slot}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: textColor,
              marginBottom: '3px',
              lineHeight: '1.3',
            }}>
              {starter.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {starter.team && (
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                  {starter.team}
                </span>
              )}
              {opponentLabel && (
                <>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>•</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {opponentLabel}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Status Badge - Inline to the right */}
        {status.key !== 'finished' && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '12px',
            marginRight: '12px',
            padding: '3px 8px',
            borderRadius: '12px',
            backgroundColor: status.bgColor,
            border: `1px solid ${status.badgeColor}40`,
            flexShrink: 0,
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: status.dotColor,
            }} />
            <span style={{
              fontSize: '10px',
              fontWeight: '600',
              color: status.badgeColor,
            }}>
              {status.label}
            </span>
          </div>
        )}
        <div style={{
          fontSize: '15px',
          fontWeight: '700',
          color: pointsColor,
          minWidth: '45px',
          textAlign: 'right',
          paddingTop: '2px',
          flexShrink: 0,
        }}>
          {points}
        </div>
      </div>
    );
  };

  // Calculate height based on max number of starters
  const maxStarters = Math.max(homeStarters.length, awayStarters.length);
  const cardHeight = 500 + (maxStarters * 65);

  return (
    <div
      data-export-id="shareable-matchup"
      style={{
        width: '1200px',
        height: `${cardHeight}px`,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '36px',
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
      <div style={{ position: 'relative', zIndex: 1, marginBottom: '28px' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>
          {leagueName}
        </div>
        <div style={{ fontSize: '38px', fontWeight: '700', color: '#ffffff' }}>
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
        gap: '20px',
        marginBottom: '28px',
        padding: '20px',
        background: 'rgba(30, 41, 59, 0.5)',
        borderRadius: '14px',
        border: '1px solid rgba(148, 163, 184, 0.15)',
      }}>
        {/* Home Team Summary */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            marginBottom: '6px',
            color: homeWins ? '#10b981' : '#ffffff',
          }}>
            {home.manager_name || 'TBD'}
          </div>
          {home.team_name && (
            <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '10px' }}>
              {home.team_name}
            </div>
          )}
          <div style={{
            fontSize: '52px',
            fontWeight: '900',
            color: homeWins ? '#10b981' : '#3b82f6',
          }}>
            {homePoints}
          </div>
          {homeWins && (
            <div style={{ marginTop: '6px', fontSize: '15px', fontWeight: '600', color: '#10b981' }}>
              ✓ WINNER
            </div>
          )}
        </div>

        {/* VS Divider */}
        <div style={{
          fontSize: '22px',
          fontWeight: '700',
          color: '#64748b',
          padding: '10px 18px',
          background: 'rgba(15, 23, 42, 0.7)',
          borderRadius: '10px',
          border: '1px solid rgba(148, 163, 184, 0.2)',
        }}>
          VS
        </div>

        {/* Away Team Summary */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            marginBottom: '6px',
            color: awayWins ? '#10b981' : '#ffffff',
          }}>
            {away.manager_name || 'TBD'}
          </div>
          {away.team_name && (
            <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '10px' }}>
              {away.team_name}
            </div>
          )}
          <div style={{
            fontSize: '52px',
            fontWeight: '900',
            color: awayWins ? '#10b981' : '#3b82f6',
          }}>
            {awayPoints}
          </div>
          {awayWins && (
            <div style={{ marginTop: '6px', fontSize: '15px', fontWeight: '600', color: '#10b981' }}>
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
        gap: '20px',
        flex: 1,
      }}>
        {/* Home Lineup */}
        <div style={{ flex: 1 }}>
          <div style={{
            background: homeWins ? 'rgba(16, 185, 129, 0.08)' : 'rgba(30, 41, 59, 0.5)',
            border: homeWins ? '2px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(148, 163, 184, 0.15)',
            borderRadius: '14px',
            padding: '18px',
            backdropFilter: 'blur(10px)',
            height: '100%',
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              marginBottom: '14px',
              color: homeWins ? '#10b981' : '#ffffff',
              borderBottom: '2px solid rgba(148, 163, 184, 0.15)',
              paddingBottom: '10px',
            }}>
              {home.manager_name}'s Lineup
            </div>
            <div>
              {homeStarters.length > 0 ? (
                homeStarters.map(starter => renderPlayer(starter, homeWins))
              ) : (
                <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                  Lineup not available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Away Lineup */}
        <div style={{ flex: 1 }}>
          <div style={{
            background: awayWins ? 'rgba(16, 185, 129, 0.08)' : 'rgba(30, 41, 59, 0.5)',
            border: awayWins ? '2px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(148, 163, 184, 0.15)',
            borderRadius: '14px',
            padding: '18px',
            backdropFilter: 'blur(10px)',
            height: '100%',
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              marginBottom: '14px',
              color: awayWins ? '#10b981' : '#ffffff',
              borderBottom: '2px solid rgba(148, 163, 184, 0.15)',
              paddingBottom: '10px',
            }}>
              {away.manager_name}'s Lineup
            </div>
            <div>
              {awayStarters.length > 0 ? (
                awayStarters.map(starter => renderPlayer(starter, awayWins))
              ) : (
                <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                  Lineup not available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShareableMatchupCard;
