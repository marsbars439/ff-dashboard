/**
 * Chart Wrapper Component
 * Base wrapper for all chart components with consistent styling
 */

import React from 'react';

export const ChartWrapper = ({ title, subtitle, children, className = '' }) => {
  return (
    <div className={className}>
      {(title || subtitle) && (
        <div className="mb-2">
          {title && (
            <h4 className="text-xs sm:text-sm font-semibold" style={{ color: 'var(--ff-color-text-strong)' }}>
              {title}
            </h4>
          )}
          {subtitle && (
            <p className="text-[10px] sm:text-xs mt-0.5" style={{ color: 'var(--ff-color-text-muted)' }}>
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
