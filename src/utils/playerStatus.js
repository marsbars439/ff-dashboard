/**
 * Player status utilities shared between WeekView and ShareableMatchupCard
 */

export const playerActivityStyles = {
  live: {
    key: 'live',
    label: 'In Progress',
    description: 'Game currently in progress.',
    badgeColor: '#f59e0b',
    bgColor: 'rgba(251, 191, 36, 0.15)',
    dotColor: '#f59e0b',
  },
  upcoming: {
    key: 'upcoming',
    label: 'Not Started',
    description: 'Game has not kicked off yet.',
    badgeColor: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    dotColor: '#3b82f6',
  },
  finished: {
    key: 'finished',
    label: '',
    summaryLabel: 'Finished',
    description: 'Game has concluded.',
    badgeColor: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    dotColor: '#10b981',
    showBadge: false,
  },
  inactive: {
    key: 'inactive',
    label: 'Inactive',
    description: 'Bye week, inactive, or no matchup this week.',
    badgeColor: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.15)',
    dotColor: '#64748b',
  },
};

/**
 * Get simplified status for a player (for export cards)
 * @param {Object} starter - Player data
 * @returns {Object} Status metadata
 */
export function getPlayerStatus(starter) {
  if (!starter || !starter.name) {
    return playerActivityStyles.inactive;
  }

  // Check if it's a bye week
  if (starter.is_bye) {
    return playerActivityStyles.inactive;
  }

  // If player has points, game is finished or in progress
  const hasPoints = starter.points !== null && starter.points !== undefined && starter.points > 0;

  // Try to determine from activity key or status
  const activityKey = (starter.activity_key || '').toLowerCase();
  const gameStatus = (starter.game_status || '').toLowerCase();

  if (activityKey.includes('live') || gameStatus.includes('live') || gameStatus.includes('progress')) {
    return playerActivityStyles.live;
  }

  if (activityKey.includes('final') || gameStatus.includes('final') || gameStatus.includes('complete')) {
    return playerActivityStyles.finished;
  }

  if (hasPoints) {
    return playerActivityStyles.finished;
  }

  if (activityKey.includes('inactive') || activityKey.includes('bye')) {
    return playerActivityStyles.inactive;
  }

  // Default to upcoming if no clear status
  return playerActivityStyles.upcoming;
}
