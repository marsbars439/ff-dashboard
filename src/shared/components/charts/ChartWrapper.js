/**
 * Chart Wrapper Component
 * Base wrapper for all chart components with consistent styling
 */

import React from 'react';

export const ChartWrapper = ({ title, subtitle, children, className = '' }) => {
  return (
    <div className={`card-secondary ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-base sm:text-lg md:text-xl font-bold" style={{ color: 'var(--ff-color-text-strong)' }}>
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--ff-color-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className="chart-container">
        {children}
      </div>
    </div>
  );
};

export default ChartWrapper;
