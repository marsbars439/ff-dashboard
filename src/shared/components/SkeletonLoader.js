/**
 * Base Skeleton Loader Component
 * Provides a shimmer loading effect for skeleton screens
 */
import React from 'react';

/**
 * SkeletonLoader - Base skeleton component with shimmer animation
 * @param {Object} props
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.width - Width of skeleton (default: 100%)
 * @param {string} props.height - Height of skeleton (default: 1rem)
 * @param {boolean} props.circle - Whether to render as circle
 * @returns {JSX.Element}
 */
export function SkeletonLoader({ className = '', width = '100%', height = '1rem', circle = false }) {
  const baseClasses = 'skeleton-loader animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]';
  const shapeClasses = circle ? 'rounded-full' : 'rounded';

  return (
    <div
      className={`${baseClasses} ${shapeClasses} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/**
 * SkeletonCard - Skeleton loader for card components
 */
export function SkeletonCard({ className = '' }) {
  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm ${className}`}>
      <div className="p-4 space-y-3">
        <SkeletonLoader height="1.5rem" width="60%" />
        <SkeletonLoader height="1rem" width="40%" />
        <div className="space-y-2 pt-2">
          <SkeletonLoader height="0.75rem" width="100%" />
          <SkeletonLoader height="0.75rem" width="90%" />
          <SkeletonLoader height="0.75rem" width="95%" />
        </div>
      </div>
    </div>
  );
}

/**
 * SkeletonTable - Skeleton loader for table components
 */
export function SkeletonTable({ rows = 5, columns = 4, className = '' }) {
  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden bg-white ${className}`}>
      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, idx) => (
            <SkeletonLoader key={`header-${idx}`} height="1rem" width="80%" />
          ))}
        </div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={`row-${rowIdx}`} className="p-3">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <SkeletonLoader key={`cell-${rowIdx}-${colIdx}`} height="0.875rem" width={colIdx === 0 ? '60%' : '70%'} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * SkeletonMatchup - Skeleton loader for matchup cards
 */
export function SkeletonMatchup({ className = '' }) {
  return (
    <div className={`rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm ${className}`}>
      {/* Matchup Header */}
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        {/* Home Team */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 space-y-2">
              <SkeletonLoader height="1rem" width="70%" />
              <SkeletonLoader height="0.75rem" width="50%" />
            </div>
            <div className="flex-shrink-0">
              <SkeletonLoader height="1.5rem" width="3rem" />
            </div>
          </div>
        </div>

        {/* Away Team */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-shrink-0">
              <SkeletonLoader height="1.5rem" width="3rem" />
            </div>
            <div className="flex-1 min-w-0 space-y-2 text-right">
              <SkeletonLoader height="1rem" width="70%" className="ml-auto" />
              <SkeletonLoader height="0.75rem" width="50%" className="ml-auto" />
            </div>
          </div>
        </div>
      </div>

      {/* Expand Button */}
      <div className="border-t border-gray-200 p-2 flex items-center justify-center">
        <SkeletonLoader height="1rem" width="6rem" />
      </div>
    </div>
  );
}

/**
 * SkeletonLineup - Skeleton loader for team lineup
 */
export function SkeletonLineup({ players = 9, className = '' }) {
  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm ${className}`}>
      {/* Lineup Header */}
      <div className="px-3 py-2 border-b bg-gray-50 space-y-1">
        <SkeletonLoader height="0.875rem" width="50%" />
        <SkeletonLoader height="0.75rem" width="40%" />
      </div>

      {/* Player Rows */}
      <ul className="divide-y divide-gray-200">
        {Array.from({ length: players }).map((_, idx) => (
          <li key={`player-${idx}`} className="px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <SkeletonLoader height="0.75rem" width="2.5rem" />
                <div className="space-y-1 flex-1">
                  <SkeletonLoader height="0.875rem" width="60%" />
                  <SkeletonLoader height="0.625rem" width="40%" />
                </div>
              </div>
              <SkeletonLoader height="1rem" width="2rem" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * SkeletonRankingCard - Skeleton loader for ranking/record cards
 */
export function SkeletonRankingCard({ className = '' }) {
  return (
    <div className={`card-tertiary ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-3 flex-1">
          <SkeletonLoader circle height="2.5rem" width="2.5rem" />
          <div className="space-y-1.5 flex-1">
            <SkeletonLoader height="1rem" width="50%" />
            <SkeletonLoader height="0.75rem" width="70%" />
          </div>
        </div>
        <SkeletonLoader height="1.5rem" width="3rem" />
      </div>
      <div className="flex justify-between">
        <SkeletonLoader height="0.75rem" width="30%" />
        <SkeletonLoader height="0.75rem" width="30%" />
      </div>
    </div>
  );
}

/**
 * SkeletonText - Simple text skeleton
 */
export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, idx) => (
        <SkeletonLoader
          key={`text-${idx}`}
          height="0.75rem"
          width={idx === lines - 1 ? '80%' : '100%'}
        />
      ))}
    </div>
  );
}

export default SkeletonLoader;
