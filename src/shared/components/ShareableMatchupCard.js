import React from 'react';

/**
 * ShareableMatchupCard Component
 *
 * Optimized card for social media sharing (1200x630px recommended)
 * Renders a matchup in a clean, branded format
 *
 * @param {Object} props
 * @param {Object} props.matchup - Matchup data with home/away teams
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

  return (
    <div
      data-export-id="shareable-matchup"
      style={{
        width: '1200px',
        height: '630px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '48px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
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
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
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
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
          borderRadius: '50%',
        }}
      />

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '24px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>
          {leagueName}
        </div>
        <div style={{ fontSize: '48px', fontWeight: '700', color: '#ffffff' }}>
          Week {week} Matchup
        </div>
      </div>

      {/* Matchup Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
        {/* Home Team */}
        <div
          style={{
            flex: 1,
            background: homeWins ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.6)',
            border: homeWins ? '3px solid #10b981' : '3px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '24px',
            padding: '40px',
            backdropFilter: 'blur(10px)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '16px', color: '#ffffff' }}>
            {home.manager_name || 'TBD'}
          </div>
          {home.team_name && (
            <div style={{ fontSize: '20px', color: '#94a3b8', marginBottom: '32px' }}>
              {home.team_name}
            </div>
          )}
          <div style={{ fontSize: '80px', fontWeight: '900', color: homeWins ? '#10b981' : '#ffffff' }}>
            {homePoints}
          </div>
          {homeWins && (
            <div style={{ marginTop: '16px', fontSize: '24px', fontWeight: '600', color: '#10b981' }}>
              WINNER
            </div>
          )}
        </div>

        {/* VS Divider */}
        <div
          style={{
            fontSize: '36px',
            fontWeight: '700',
            color: '#475569',
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '50%',
            width: '80px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '3px solid rgba(148, 163, 184, 0.2)',
            backdropFilter: 'blur(10px)',
          }}
        >
          VS
        </div>

        {/* Away Team */}
        <div
          style={{
            flex: 1,
            background: awayWins ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.6)',
            border: awayWins ? '3px solid #10b981' : '3px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '24px',
            padding: '40px',
            backdropFilter: 'blur(10px)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '16px', color: '#ffffff' }}>
            {away.manager_name || 'TBD'}
          </div>
          {away.team_name && (
            <div style={{ fontSize: '20px', color: '#94a3b8', marginBottom: '32px' }}>
              {away.team_name}
            </div>
          )}
          <div style={{ fontSize: '80px', fontWeight: '900', color: awayWins ? '#10b981' : '#ffffff' }}>
            {awayPoints}
          </div>
          {awayWins && (
            <div style={{ marginTop: '16px', fontSize: '24px', fontWeight: '600', color: '#10b981' }}>
              WINNER
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#64748b' }}>
          Generated by {leagueName} Dashboard
        </div>
      </div>
    </div>
  );
}

export default ShareableMatchupCard;
